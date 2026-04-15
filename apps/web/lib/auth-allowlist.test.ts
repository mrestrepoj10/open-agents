import { afterEach, describe, expect, test } from "bun:test";
import {
  AUTH_ACCESS_DENIED_ERROR_CODE,
  getAuthAllowlist,
  getAuthErrorMessage,
  isAllowedEmail,
} from "./auth-allowlist";

const originalAllowedEmails = process.env.AUTH_ALLOWED_EMAILS;
const originalAllowedDomains = process.env.AUTH_ALLOWED_EMAIL_DOMAINS;

afterEach(() => {
  process.env.AUTH_ALLOWED_EMAILS = originalAllowedEmails;
  process.env.AUTH_ALLOWED_EMAIL_DOMAINS = originalAllowedDomains;
});

describe("auth allowlist", () => {
  test("allows all emails when no allowlist is configured", () => {
    delete process.env.AUTH_ALLOWED_EMAILS;
    delete process.env.AUTH_ALLOWED_EMAIL_DOMAINS;

    expect(getAuthAllowlist()).toEqual({
      enabled: false,
      allowedEmails: [],
      allowedDomains: [],
    });
    expect(isAllowedEmail("person@example.com")).toBe(true);
  });

  test("matches exact emails and domains after normalization", () => {
    process.env.AUTH_ALLOWED_EMAILS =
      " person@example.com,PERSON@example.com, second@example.org ";
    process.env.AUTH_ALLOWED_EMAIL_DOMAINS =
      " example.com, @vercel.com, example.com ";

    expect(getAuthAllowlist()).toEqual({
      enabled: true,
      allowedEmails: ["person@example.com", "second@example.org"],
      allowedDomains: ["example.com", "vercel.com"],
    });
    expect(isAllowedEmail("PERSON@example.com")).toBe(true);
    expect(isAllowedEmail("user@vercel.com")).toBe(true);
    expect(isAllowedEmail("user@other.com")).toBe(false);
  });

  test("denies missing or malformed emails when allowlist is enabled", () => {
    process.env.AUTH_ALLOWED_EMAIL_DOMAINS = "example.com";
    delete process.env.AUTH_ALLOWED_EMAILS;

    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail("not-an-email")).toBe(false);
  });

  test("maps auth error codes to user-facing messages", () => {
    expect(getAuthErrorMessage(AUTH_ACCESS_DENIED_ERROR_CODE)).toBe(
      "This deployment only allows approved email accounts.",
    );
    expect(getAuthErrorMessage("vercel_not_configured")).toBe(
      "Vercel sign-in is not configured for this deployment.",
    );
    expect(getAuthErrorMessage("unknown")).toBeNull();
  });
});
