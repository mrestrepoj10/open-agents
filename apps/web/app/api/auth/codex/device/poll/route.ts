import { cookies } from "next/headers";
import { deleteCodexAccount, upsertCodexAccount } from "@/lib/db/accounts";
import { encrypt } from "@/lib/crypto";
import { decryptJWE } from "@/lib/jwe/decrypt";
import { getServerSession } from "@/lib/session/get-server-session";
import {
  buildCodexAccountMetadata,
  exchangeCodexAuthorizationCode,
  pollCodexDeviceCode,
} from "@/lib/codex/oauth";

const CODEX_DEVICE_COOKIE = "codex_device_auth";

interface PendingCodexDeviceAuth {
  deviceAuthId: string;
  userCode: string;
}

function clearCodexDeviceCookie(store: Awaited<ReturnType<typeof cookies>>) {
  store.delete(CODEX_DEVICE_COOKIE);
}

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(CODEX_DEVICE_COOKIE)?.value;
  const pendingAuth = cookieValue
    ? await decryptJWE<PendingCodexDeviceAuth>(cookieValue)
    : undefined;

  if (!pendingAuth?.deviceAuthId || !pendingAuth.userCode) {
    return Response.json(
      { error: "No active Codex login attempt" },
      { status: 400 },
    );
  }

  try {
    const authorizationCode = await pollCodexDeviceCode(pendingAuth);
    if (!authorizationCode) {
      return Response.json({ status: "pending" });
    }

    const tokens = await exchangeCodexAuthorizationCode(authorizationCode);
    const metadata = buildCodexAccountMetadata({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
    });

    if (!metadata.chatgptAccountId) {
      clearCodexDeviceCookie(cookieStore);
      await deleteCodexAccount(session.user.id);
      return Response.json(
        { error: "Codex account did not include a ChatGPT account id" },
        { status: 400 },
      );
    }

    await upsertCodexAccount({
      userId: session.user.id,
      externalUserId:
        metadata.chatgptUserId ?? metadata.chatgptAccountId ?? session.user.id,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      expiresAt: tokens.expiresAt ?? undefined,
      username: metadata.email ?? session.user.email ?? "codex",
      metadata,
    });

    clearCodexDeviceCookie(cookieStore);

    return Response.json({
      status: "connected",
      account: {
        email: metadata.email ?? session.user.email ?? null,
        chatgptPlanType: metadata.chatgptPlanType ?? null,
        chatgptAccountId: metadata.chatgptAccountId,
      },
    });
  } catch (error) {
    console.error("Failed to complete Codex device login:", error);
    clearCodexDeviceCookie(cookieStore);
    return Response.json(
      { error: "Failed to complete Codex login" },
      { status: 500 },
    );
  }
}
