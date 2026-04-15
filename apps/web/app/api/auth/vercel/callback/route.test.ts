import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";

const cookieValues = new Map<string, string>();
const deletedCookies: string[] = [];

const exchangeVercelCodeMock = mock(async () => ({
  access_token: "access-token",
  expires_in: 3600,
  refresh_token: "refresh-token",
  scope: "openid email profile offline_access",
}));

const getVercelUserInfoMock = mock(async () => ({
  sub: "vercel-user-1",
  email: "person@example.com",
  name: "Example Person",
  preferred_username: "example-person",
  picture: "https://example.com/avatar.png",
}));

const upsertUserMock = mock(async () => "user-1");
const encryptMock = mock(() => "encrypted-value");
const encryptJWEMock = mock(async () => "session-token");

mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { value } : undefined;
    },
    delete: (name: string) => {
      deletedCookies.push(name);
      cookieValues.delete(name);
    },
  }),
}));

mock.module("@/lib/vercel/oauth", () => ({
  exchangeVercelCode: exchangeVercelCodeMock,
  getVercelUserInfo: getVercelUserInfoMock,
}));

mock.module("@/lib/db/users", () => ({
  upsertUser: upsertUserMock,
}));

mock.module("@/lib/crypto", () => ({
  encrypt: encryptMock,
}));

mock.module("@/lib/jwe/encrypt", () => ({
  encryptJWE: encryptJWEMock,
}));

const routeModulePromise = import("./route");

const originalEnv = {
  NEXT_PUBLIC_VERCEL_APP_CLIENT_ID:
    process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID,
  VERCEL_APP_CLIENT_SECRET: process.env.VERCEL_APP_CLIENT_SECRET,
  AUTH_ALLOWED_EMAILS: process.env.AUTH_ALLOWED_EMAILS,
  AUTH_ALLOWED_EMAIL_DOMAINS: process.env.AUTH_ALLOWED_EMAIL_DOMAINS,
  VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER,
  VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  NODE_ENV: process.env.NODE_ENV,
};

function createRequest(origin = "https://open-harness.example") {
  const url = `${origin}/api/auth/vercel/callback?code=code-123&state=state-123`;
  return {
    nextUrl: new URL(url),
    url,
  } as NextRequest;
}

beforeEach(() => {
  cookieValues.clear();
  deletedCookies.length = 0;
  cookieValues.set("vercel_auth_state", "state-123");
  cookieValues.set("vercel_code_verifier", "verifier-123");
  cookieValues.set("vercel_auth_redirect_to", "/sessions");

  exchangeVercelCodeMock.mockClear();
  getVercelUserInfoMock.mockClear();
  upsertUserMock.mockClear();
  encryptMock.mockClear();
  encryptJWEMock.mockClear();

  Object.assign(process.env, {
    NEXT_PUBLIC_VERCEL_APP_CLIENT_ID: "client-id",
    VERCEL_APP_CLIENT_SECRET: "client-secret",
    AUTH_ALLOWED_EMAILS: "",
    AUTH_ALLOWED_EMAIL_DOMAINS: "",
    VERCEL_GIT_REPO_OWNER: "vercel-labs",
    VERCEL_GIT_REPO_SLUG: "open-harness",
    VERCEL_PROJECT_PRODUCTION_URL: "",
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "",
    NODE_ENV: "test",
  });
});

afterEach(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_VERCEL_APP_CLIENT_ID:
      originalEnv.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID,
    VERCEL_APP_CLIENT_SECRET: originalEnv.VERCEL_APP_CLIENT_SECRET,
    AUTH_ALLOWED_EMAILS: originalEnv.AUTH_ALLOWED_EMAILS,
    AUTH_ALLOWED_EMAIL_DOMAINS: originalEnv.AUTH_ALLOWED_EMAIL_DOMAINS,
    VERCEL_GIT_REPO_OWNER: originalEnv.VERCEL_GIT_REPO_OWNER,
    VERCEL_GIT_REPO_SLUG: originalEnv.VERCEL_GIT_REPO_SLUG,
    VERCEL_PROJECT_PRODUCTION_URL: originalEnv.VERCEL_PROJECT_PRODUCTION_URL,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      originalEnv.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    NODE_ENV: originalEnv.NODE_ENV,
  });
});

describe("GET /api/auth/vercel/callback", () => {
  test("allows sign-in when no auth allowlist is configured", async () => {
    getVercelUserInfoMock.mockResolvedValueOnce({
      sub: "vercel-user-1",
      email: "person@example.com",
      name: "Example Person",
      preferred_username: "example-person",
      picture: "https://example.com/avatar.png",
    });

    const { GET } = await routeModulePromise;
    const response = await GET(createRequest("https://open-agents.dev"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sessions");
    expect(upsertUserMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=session-token`,
    );
    expect(deletedCookies).toEqual([
      "vercel_auth_state",
      "vercel_code_verifier",
      "vercel_auth_redirect_to",
    ]);
  });

  test("allows sign-in for an exact allowlisted email", async () => {
    process.env.AUTH_ALLOWED_EMAILS = "person@example.com";

    const { GET } = await routeModulePromise;
    const response = await GET(createRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sessions");
    expect(upsertUserMock).toHaveBeenCalledTimes(1);
  });

  test("allows sign-in for an allowlisted domain", async () => {
    process.env.AUTH_ALLOWED_EMAIL_DOMAINS = "example.com";

    const { GET } = await routeModulePromise;
    const response = await GET(createRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sessions");
    expect(upsertUserMock).toHaveBeenCalledTimes(1);
  });

  test("rejects sign-in when the email is not on the allowlist", async () => {
    process.env.AUTH_ALLOWED_EMAILS = "allowed@example.com";

    const { GET } = await routeModulePromise;
    const response = await GET(createRequest("https://self-hosted.example"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://self-hosted.example/?error=access_denied",
    );
    expect(upsertUserMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0`,
    );
    expect(deletedCookies).toEqual([
      "vercel_auth_state",
      "vercel_code_verifier",
      "vercel_auth_redirect_to",
    ]);
  });
});
