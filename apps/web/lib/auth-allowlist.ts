const AUTH_ALLOWED_EMAILS_ENV_VAR = "AUTH_ALLOWED_EMAILS";
const AUTH_ALLOWED_EMAIL_DOMAINS_ENV_VAR = "AUTH_ALLOWED_EMAIL_DOMAINS";

function parseCommaSeparatedValues(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return null;
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain) {
    return null;
  }

  return `${localPart}@${domain}`;
}

function normalizeDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^@+/, "");
  if (!normalized || normalized.includes("@")) {
    return null;
  }

  return normalized;
}

export function getAuthAllowlist() {
  const allowedEmails = [
    ...new Set(
      parseCommaSeparatedValues(process.env[AUTH_ALLOWED_EMAILS_ENV_VAR])
        .map((entry) => normalizeEmail(entry))
        .filter((entry) => entry !== null),
    ),
  ];

  const allowedDomains = [
    ...new Set(
      parseCommaSeparatedValues(process.env[AUTH_ALLOWED_EMAIL_DOMAINS_ENV_VAR])
        .map((entry) => normalizeDomain(entry))
        .filter((entry) => entry !== null),
    ),
  ];

  return {
    enabled: allowedEmails.length > 0 || allowedDomains.length > 0,
    allowedEmails,
    allowedDomains,
  };
}

export function isAllowedEmail(email: string | undefined): boolean {
  const allowlist = getAuthAllowlist();
  if (!allowlist.enabled) {
    return true;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const domain = normalizedEmail.split("@")[1];
  if (!domain) {
    return false;
  }

  return (
    allowlist.allowedEmails.includes(normalizedEmail) ||
    allowlist.allowedDomains.includes(domain)
  );
}

export const AUTH_ACCESS_DENIED_ERROR_CODE = "access_denied";

export function getAuthErrorMessage(code: string | null | undefined) {
  switch (code) {
    case AUTH_ACCESS_DENIED_ERROR_CODE:
      return "This deployment only allows approved email accounts.";
    case "vercel_not_configured":
      return "Vercel sign-in is not configured for this deployment.";
    default:
      return null;
  }
}
