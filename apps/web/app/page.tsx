import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthErrorMessage } from "@/lib/auth-allowlist";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";
import { getServerSession } from "@/lib/session/get-server-session";
import { HomePage } from "./home-page";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Review recent runs and start new sessions in Open Agents.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
  }>;
}) {
  const session = await getServerSession();
  if (session?.user) {
    redirect("/sessions");
  }

  const resolvedSearchParams = await searchParams;
  const authErrorCode = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;
  const resolvedAuthError = getAuthErrorMessage(authErrorCode);

  const store = await cookies();
  const hasSessionCookie = Boolean(store.get(SESSION_COOKIE_NAME)?.value);

  return (
    <HomePage
      authErrorMessage={resolvedAuthError}
      hasSessionCookie={hasSessionCookie}
      lastRepo={null}
    />
  );
}
