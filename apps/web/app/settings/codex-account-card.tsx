"use client";

import { Bot, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { fetcher } from "@/lib/swr";

interface CodexStatusResponse {
  connected: boolean;
  account: {
    email: string | null;
    chatgptPlanType: string | null;
    chatgptAccountId: string | null;
    expiresAt: string | null;
  } | null;
}

interface CodexDeviceStartResponse {
  verificationUrl: string;
  userCode: string;
  intervalSeconds: number;
}

interface CodexDevicePollResponse {
  status?: "pending" | "connected";
  account?: {
    email: string | null;
    chatgptPlanType: string | null;
    chatgptAccountId: string;
  };
  error?: string;
}

export function CodexAccountCard() {
  const { hasCodexAccount } = useSession();
  const { mutate } = useSWRConfig();
  const {
    data,
    isLoading,
    mutate: mutateStatus,
  } = useSWR<CodexStatusResponse>(
    hasCodexAccount ? "/api/auth/codex/status" : null,
    fetcher,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deviceState, setDeviceState] =
    useState<CodexDeviceStartResponse | null>(null);
  const pollingRef = useRef<number | null>(null);

  const account = data?.account ?? null;
  const isConnected = data?.connected ?? hasCodexAccount;
  const expiresText = useMemo(() => {
    if (!account?.expiresAt) {
      return null;
    }

    try {
      return new Date(account.expiresAt).toLocaleString();
    } catch {
      return null;
    }
  }, [account?.expiresAt]);

  useEffect(() => {
    if (!dialogOpen || !deviceState) {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const response = await fetch("/api/auth/codex/device/poll", {
        method: "POST",
      });
      const body = (await response.json()) as CodexDevicePollResponse;

      if (!response.ok) {
        toast.error(body.error ?? "Failed to complete Codex login");
        setDialogOpen(false);
        setDeviceState(null);
        return;
      }

      if (body.status === "connected") {
        await Promise.all([mutate("/api/auth/info"), mutateStatus()]);
        toast.success("Codex connected");
        setDialogOpen(false);
        setDeviceState(null);
      }
    };

    void poll();
    pollingRef.current = window.setInterval(
      () => void poll(),
      Math.max(deviceState.intervalSeconds, 3) * 1000,
    );

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [dialogOpen, deviceState, mutate, mutateStatus]);

  async function handleConnect() {
    setStarting(true);
    try {
      const response = await fetch("/api/auth/codex/device/start", {
        method: "POST",
      });
      const body = (await response.json()) as
        | CodexDeviceStartResponse
        | { error?: string };

      if (!response.ok || !("userCode" in body)) {
        throw new Error(
          "error" in body
            ? (body.error ?? "Failed to start Codex login")
            : "Failed to start Codex login",
        );
      }

      setDeviceState(body);
      setDialogOpen(true);
    } catch (error) {
      console.error("Failed to start Codex device login:", error);
      toast.error("Failed to start Codex login");
    } finally {
      setStarting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/auth/codex/disconnect", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to disconnect Codex");
      }

      await Promise.all([
        mutate("/api/auth/info"),
        mutateStatus(
          { connected: false, account: null },
          { revalidate: false },
        ),
      ]);
      toast.success("Codex disconnected");
    } catch (error) {
      console.error("Failed to disconnect Codex:", error);
      toast.error("Failed to disconnect Codex");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-muted/10">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Bot className="h-5 w-5" />
            <span className="text-sm font-medium">Codex Subscription</span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {isLoading && hasCodexAccount ? (
            <div className="text-sm text-muted-foreground">
              Loading Codex connection...
            </div>
          ) : !isConnected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your ChatGPT Codex subscription for OpenAI models.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Connect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {account?.email ?? "Connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account?.chatgptPlanType
                    ? `Plan: ${account.chatgptPlanType}`
                    : "ChatGPT plan connected"}
                  {expiresText
                    ? ` · Token refresh tracked until ${expiresText}`
                    : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen) {
            setDeviceState(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Codex Subscription</DialogTitle>
            <DialogDescription>
              Open the verification page, sign in with ChatGPT, and enter the
              one-time code below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border/50 bg-muted/20 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verification code
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[0.3em]">
                {deviceState?.userCode ?? "------"}
              </div>
            </div>

            <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
              <a
                href={deviceState?.verificationUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-foreground hover:underline"
              >
                Open verification page
                <ExternalLink className="size-4" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              This dialog will close automatically after the subscription login
              completes.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setDeviceState(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
