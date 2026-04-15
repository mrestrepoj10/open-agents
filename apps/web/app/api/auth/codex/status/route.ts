import { getUserCodexAccountSummary } from "@/lib/codex/token";
import { getServerSession } from "@/lib/session/get-server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const account = await getUserCodexAccountSummary(session.user.id);
    return Response.json({
      connected: account !== null,
      account,
    });
  } catch (error) {
    console.error("Failed to load Codex status:", error);
    return Response.json(
      { error: "Failed to load Codex status" },
      { status: 500 },
    );
  }
}
