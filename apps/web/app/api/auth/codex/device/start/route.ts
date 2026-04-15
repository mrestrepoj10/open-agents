import { cookies } from "next/headers";
import { getServerSession } from "@/lib/session/get-server-session";
import { encryptJWE } from "@/lib/jwe/encrypt";
import { requestCodexDeviceCode } from "@/lib/codex/oauth";

const CODEX_DEVICE_COOKIE = "codex_device_auth";

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const deviceCode = await requestCodexDeviceCode();
    const cookieStore = await cookies();
    const token = await encryptJWE(
      {
        deviceAuthId: deviceCode.deviceAuthId,
        userCode: deviceCode.userCode,
      },
      "20m",
    );

    cookieStore.set(CODEX_DEVICE_COOKIE, token, {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 20 * 60,
      sameSite: "lax",
    });

    return Response.json({
      verificationUrl: deviceCode.verificationUrl,
      userCode: deviceCode.userCode,
      intervalSeconds: deviceCode.intervalSeconds,
    });
  } catch (error) {
    console.error("Failed to start Codex device login:", error);
    return Response.json(
      { error: "Failed to start Codex login" },
      { status: 500 },
    );
  }
}
