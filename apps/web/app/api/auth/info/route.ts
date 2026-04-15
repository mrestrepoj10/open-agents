import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getCodexAccount, getGitHubAccount } from "@/lib/db/accounts";
import { getInstallationsByUserId } from "@/lib/db/installations";
import { userExists } from "@/lib/db/users";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";
import { getSessionFromReq } from "@/lib/session/server";
import type { SessionUserInfo } from "@/lib/session/types";

const UNAUTHENTICATED: SessionUserInfo = { user: undefined };

export async function GET(req: NextRequest) {
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromReq(req);

  if (!session?.user?.id) {
    if (cookieValue) {
      const store = await cookies();
      store.delete(SESSION_COOKIE_NAME);
    }
    return Response.json(UNAUTHENTICATED);
  }

  // Run the user-existence check in parallel with the GitHub queries
  // so there is zero added latency on the happy path.
  const [exists, ghAccount, codexAccount, installations] = await Promise.all([
    userExists(session.user.id),
    getGitHubAccount(session.user.id),
    getCodexAccount(session.user.id),
    getInstallationsByUserId(session.user.id),
  ]);

  // The session cookie (JWE) is self-contained and can outlive the user record.
  // If the user no longer exists, clear the stale cookie.
  if (!exists) {
    const store = await cookies();
    store.delete(SESSION_COOKIE_NAME);
    return Response.json(UNAUTHENTICATED);
  }

  const hasGitHubAccount = ghAccount !== null;
  const hasGitHubInstallations = installations.length > 0;
  const hasGitHub = hasGitHubAccount || hasGitHubInstallations;
  const hasCodexAccount = codexAccount !== null;

  const data: SessionUserInfo = {
    user: session.user,
    authProvider: session.authProvider,
    hasGitHub,
    hasGitHubAccount,
    hasGitHubInstallations,
    hasCodexAccount,
  };

  return Response.json(data);
}
