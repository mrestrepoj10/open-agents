import type { FetchFunction } from "@ai-sdk/provider-utils";
import { and, eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { getCodexAccount, updateCodexAccountTokens } from "@/lib/db/accounts";
import {
  buildCodexAccountMetadata,
  CODEX_API_BASE_URL,
  CODEX_DUMMY_API_KEY,
  refreshCodexToken,
  type CodexJwtClaims,
} from "./oauth";
import { createCodexFetch } from "./fetch";

export interface UserCodexAuthInfo {
  accessToken: string;
  expiresAt: number | null;
  accountId: string;
  metadata: CodexJwtClaims;
}

async function loadCodexAccountRow(userId: string) {
  const result = await db
    .select({
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      expiresAt: accounts.expiresAt,
      metadata: accounts.metadata,
    })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "openai-codex")),
    )
    .limit(1);

  return result[0] ?? null;
}

function toAuthInfo(params: {
  accessToken: string;
  expiresAt: Date | null;
  metadata: CodexJwtClaims;
}): UserCodexAuthInfo | null {
  const accountId = params.metadata.chatgptAccountId;
  if (!accountId) {
    return null;
  }

  return {
    accessToken: params.accessToken,
    expiresAt: params.expiresAt
      ? Math.floor(params.expiresAt.getTime() / 1000)
      : null,
    accountId,
    metadata: params.metadata,
  };
}

export async function getUserCodexAuthInfo(
  userId: string,
): Promise<UserCodexAuthInfo | null> {
  const row = await loadCodexAccountRow(userId);
  if (!row?.accessToken) {
    return null;
  }

  const now = Date.now();
  const expiresAtMs = row.expiresAt?.getTime() ?? null;
  const isExpired = expiresAtMs !== null && expiresAtMs - 60_000 <= now;
  const decryptedAccessToken = decrypt(row.accessToken);
  const metadata = (row.metadata as CodexJwtClaims | null) ?? {};

  if (!isExpired) {
    return toAuthInfo({
      accessToken: decryptedAccessToken,
      expiresAt: row.expiresAt,
      metadata,
    });
  }

  if (!row.refreshToken) {
    return null;
  }

  const refreshed = await refreshCodexToken(decrypt(row.refreshToken));
  const refreshedMetadata = buildCodexAccountMetadata({
    idToken: refreshed.idToken,
    accessToken: refreshed.accessToken,
  });

  await updateCodexAccountTokens(userId, {
    accessToken: encrypt(refreshed.accessToken),
    refreshToken: encrypt(refreshed.refreshToken),
    expiresAt: refreshed.expiresAt ?? undefined,
    metadata: {
      ...metadata,
      ...refreshedMetadata,
    },
  });

  return toAuthInfo({
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    metadata: {
      ...metadata,
      ...refreshedMetadata,
    },
  });
}

export interface CodexModelConfig {
  kind: "openai-compatible";
  baseURL: string;
  apiKey: string;
  headers: Record<string, string>;
  name: "openai";
  fetch: FetchFunction;
}

export async function getUserCodexModelConfig(
  userId: string,
): Promise<CodexModelConfig | null> {
  const auth = await getUserCodexAuthInfo(userId);
  if (!auth) {
    return null;
  }

  return {
    kind: "openai-compatible",
    baseURL: CODEX_API_BASE_URL,
    apiKey: CODEX_DUMMY_API_KEY,
    name: "openai",
    fetch: createCodexFetch(),
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "ChatGPT-Account-Id": auth.accountId,
      "OpenAI-Beta": "responses=experimental",
      originator: "codex_cli_rs",
      accept: "text/event-stream",
    },
  };
}

export async function getUserCodexAccountSummary(userId: string) {
  const account = await getCodexAccount(userId);
  if (!account) {
    return null;
  }

  const metadata = account.metadata ?? {};
  return {
    email:
      typeof metadata.email === "string" ? metadata.email : account.username,
    chatgptPlanType:
      typeof metadata.chatgptPlanType === "string"
        ? metadata.chatgptPlanType
        : null,
    chatgptAccountId:
      typeof metadata.chatgptAccountId === "string"
        ? metadata.chatgptAccountId
        : null,
    expiresAt: account.expiresAt?.toISOString() ?? null,
  };
}
