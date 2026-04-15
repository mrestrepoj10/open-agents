const OPENAI_AUTH_BASE_URL = "https://auth.openai.com";
const OPENAI_DEVICE_AUTH_BASE_URL = `${OPENAI_AUTH_BASE_URL}/api/accounts`;

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_DEVICE_VERIFICATION_URL = `${OPENAI_AUTH_BASE_URL}/codex/device`;
export const CODEX_DEVICE_REDIRECT_URI = `${OPENAI_AUTH_BASE_URL}/deviceauth/callback`;
export const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const CODEX_DUMMY_API_KEY = "chatgpt-oauth";

export interface CodexJwtClaims {
  email?: string;
  chatgptPlanType?: string;
  chatgptUserId?: string;
  chatgptAccountId?: string;
}

export interface CodexDeviceCode {
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  intervalSeconds: number;
}

export interface CodexAuthorizationCodeResult {
  authorizationCode: string;
  codeChallenge: string;
  codeVerifier: string;
}

export interface CodexTokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresAt: Date | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    return payload;
  } catch {
    return null;
  }
}

export function parseCodexJwtClaims(token: string): CodexJwtClaims {
  const payload = decodeJwtPayload(token);
  const auth =
    payload?.["https://api.openai.com/auth"] &&
    typeof payload["https://api.openai.com/auth"] === "object"
      ? (payload["https://api.openai.com/auth"] as Record<string, unknown>)
      : null;
  const profile =
    payload?.["https://api.openai.com/profile"] &&
    typeof payload["https://api.openai.com/profile"] === "object"
      ? (payload["https://api.openai.com/profile"] as Record<string, unknown>)
      : null;

  return {
    email:
      (typeof payload?.email === "string" ? payload.email : undefined) ??
      (typeof profile?.email === "string" ? profile.email : undefined),
    chatgptPlanType:
      typeof auth?.chatgpt_plan_type === "string"
        ? auth.chatgpt_plan_type
        : undefined,
    chatgptUserId:
      typeof auth?.chatgpt_user_id === "string"
        ? auth.chatgpt_user_id
        : typeof auth?.user_id === "string"
          ? auth.user_id
          : undefined,
    chatgptAccountId:
      typeof auth?.chatgpt_account_id === "string"
        ? auth.chatgpt_account_id
        : undefined,
  };
}

export function parseJwtExpiration(token: string): Date | null {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!exp) {
    return null;
  }

  const timestamp = Date.parse(new Date(exp * 1000).toISOString());
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

export function buildCodexAccountMetadata(params: {
  idToken?: string;
  accessToken: string;
}) {
  const idClaims = params.idToken ? parseCodexJwtClaims(params.idToken) : {};
  const accessClaims = parseCodexJwtClaims(params.accessToken);

  return {
    email: idClaims.email ?? accessClaims.email,
    chatgptPlanType:
      idClaims.chatgptPlanType ?? accessClaims.chatgptPlanType ?? undefined,
    chatgptUserId:
      idClaims.chatgptUserId ?? accessClaims.chatgptUserId ?? undefined,
    chatgptAccountId:
      idClaims.chatgptAccountId ?? accessClaims.chatgptAccountId ?? undefined,
  };
}

export async function requestCodexDeviceCode(): Promise<CodexDeviceCode> {
  const response = await fetch(
    `${OPENAI_DEVICE_AUTH_BASE_URL}/deviceauth/usercode`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CODEX_OAUTH_CLIENT_ID,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Codex device code request failed: ${response.status} ${text}`,
    );
  }

  const body = (await response.json()) as {
    device_auth_id?: string;
    user_code?: string;
    usercode?: string;
    interval?: string;
  };

  const deviceAuthId = body.device_auth_id;
  const userCode = body.user_code ?? body.usercode;
  const intervalSeconds = Number.parseInt(body.interval ?? "5", 10);

  if (!deviceAuthId || !userCode) {
    throw new Error("Codex device code response was missing required fields");
  }

  return {
    deviceAuthId,
    userCode,
    verificationUrl: CODEX_DEVICE_VERIFICATION_URL,
    intervalSeconds:
      Number.isFinite(intervalSeconds) && intervalSeconds > 0
        ? intervalSeconds
        : 5,
  };
}

export async function pollCodexDeviceCode(
  params: Pick<CodexDeviceCode, "deviceAuthId" | "userCode">,
): Promise<CodexAuthorizationCodeResult | null> {
  const response = await fetch(
    `${OPENAI_DEVICE_AUTH_BASE_URL}/deviceauth/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_auth_id: params.deviceAuthId,
        user_code: params.userCode,
      }),
    },
  );

  if (response.status === 403 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Codex device auth poll failed: ${response.status} ${text}`,
    );
  }

  const body = (await response.json()) as {
    authorization_code?: string;
    code_challenge?: string;
    code_verifier?: string;
  };

  if (!body.authorization_code || !body.code_verifier || !body.code_challenge) {
    throw new Error(
      "Codex device auth poll response was missing required fields",
    );
  }

  return {
    authorizationCode: body.authorization_code,
    codeChallenge: body.code_challenge,
    codeVerifier: body.code_verifier,
  };
}

export async function exchangeCodexAuthorizationCode(
  params: CodexAuthorizationCodeResult,
): Promise<CodexTokenExchangeResult> {
  const response = await fetch(`${OPENAI_AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.authorizationCode,
      client_id: CODEX_OAUTH_CLIENT_ID,
      code_verifier: params.codeVerifier,
      redirect_uri: CODEX_DEVICE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Codex token exchange failed: ${response.status} ${text}`);
  }

  const body = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error(
      "Codex token exchange response was missing required fields",
    );
  }

  return {
    idToken: body.id_token,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt:
      parseJwtExpiration(body.access_token) ??
      (typeof body.expires_in === "number"
        ? new Date(Date.now() + body.expires_in * 1000)
        : null),
  };
}

export async function refreshCodexToken(
  refreshToken: string,
): Promise<CodexTokenExchangeResult> {
  const response = await fetch(`${OPENAI_AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CODEX_OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Codex token refresh failed: ${response.status} ${text}`);
  }

  const body = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error("Codex token refresh response was missing required fields");
  }

  return {
    idToken: body.id_token,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt:
      parseJwtExpiration(body.access_token) ??
      (typeof body.expires_in === "number"
        ? new Date(Date.now() + body.expires_in * 1000)
        : null),
  };
}
