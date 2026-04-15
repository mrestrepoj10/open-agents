import { cookies } from "next/headers";
import { deleteCodexAccount } from "@/lib/db/accounts";
import { getServerSession } from "@/lib/session/get-server-session";

const CODEX_DEVICE_COOKIE = "codex_device_auth";

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await deleteCodexAccount(session.user.id);
    const cookieStore = await cookies();
    cookieStore.delete(CODEX_DEVICE_COOKIE);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to disconnect Codex account:", error);
    return Response.json(
      { error: "Failed to disconnect Codex account" },
      { status: 500 },
    );
  }
}
