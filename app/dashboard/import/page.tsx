"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTradovateSyncStore } from "@/store/tradovate-sync-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useTradovateSyncContext } from "@/context/tradovate-sync-context";
import logger from '@/lib/logger';
import { reportError } from '@/lib/observability/report-error'
import { apiRequest } from '@/lib/api/client';

export default function ImportCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tradovateStore = useTradovateSyncStore();
  const { loadAccounts } = useTradovateSyncContext();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string>("");
  const hasProcessed = useRef(false);
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useTradovateSyncStore.persist?.onFinishHydration?.(() => {
      setStoreHydrated(true);
    });

    if (useTradovateSyncStore.persist?.hasHydrated?.()) {
      setStoreHydrated(true);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      if (!storeHydrated) {
        logger.info("Waiting for Tradovate store hydration...");
        return;
      }

      if (hasProcessed.current) {
        logger.info("Callback already processed, skipping...");
        return;
      }
      hasProcessed.current = true;

      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        logger.info({
          hasCode: !!code,
          hasState: !!state,
          state: state || 'none',
          environment: tradovateStore.environment || 'none',
          userAgent: window.navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        }, "OAuth callback received:");

        if (!code) {
          setError("No authorization code received");
          setStatus("error");
          return;
        }

        if (!state) {
          setError("No state parameter received");
          setStatus("error");
          return;
        }

        const storedOAuthState =
          tradovateStore.oauthState ??
          (typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("tradovate_oauth_state")
            : null);

        if (!storedOAuthState) {
          logger.warn({
            hasStore: !!tradovateStore,
            oauthState: tradovateStore.oauthState,
          }, "Tradovate store not properly initialized:");
          setError("OAuth state not found - please try again");
          setStatus("error");
          return;
        }

        if (state !== storedOAuthState) {
          logger.warn({
            received: state,
            expected: storedOAuthState,
            receivedLength: state.length,
            expectedLength: storedOAuthState.length,
          }, "State mismatch:");
          setError("Invalid state parameter - possible security issue");
          setStatus("error");
          return;
        }

        const response = await apiRequest<{ connected: boolean; error?: string }>(
          '/api/v1/tradovate/oauth/callback',
          {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          },
        );
        const result = response.data;

        if (!result || typeof result !== "object") {
          reportError(new Error('Invalid OAuth callback response'), {
            surface: 'client',
            operation: 'complete-tradovate-oauth',
            route: '/api/v1/tradovate/oauth/callback',
          })
          setError("Invalid response from OAuth callback handler");
          setStatus("error");
          return;
        }

        if (result.error) {
          setError(result.error || 'Import failed');
          setStatus("error");
          return;
        }

        if (!result?.connected) {
          reportError(new Error('OAuth token exchange did not complete'), {
            surface: 'client',
            operation: 'complete-tradovate-oauth',
            route: '/api/v1/tradovate/oauth/callback',
          })
          setError("OAuth connection did not complete");
          setStatus("error");
          return;
        }

        useTradovateSyncStore.setState({ oauthState: undefined });
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("tradovate_oauth_state");
        }

        try {
          await loadAccounts();
        } catch (loadError) {
          logger.warn({ error: loadError instanceof Error ? loadError.message : String(loadError) }, "Failed to refresh Tradovate synchronizations");
        }

        logger.info("OAuth flow completed successfully");
        setStatus("success");

        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'complete-tradovate-oauth',
          route: '/api/v1/tradovate/oauth/callback',
        })

        let errorMessage = "Unknown error occurred";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error && typeof error === "object" && "message" in error) {
          errorMessage = String(error.message);
        }

        setError(errorMessage);
        setStatus("error");
      }
    };

    handleCallback();
  }, [searchParams, tradovateStore, router, storeHydrated, loadAccounts]);

  const handleRetry = () => {
    hasProcessed.current = false;
    tradovateStore.clearAll();
    router.push("/dashboard");
  };

  return (
    <div className="container mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "loading" && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-5 w-5 text-success" />
            )}
            {status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
            Tradovate Sync Integration
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Processing Tradovate OAuth Redirect..."}
            {status === "success" && "Connection successful!"}
            {status === "error" && "An error occurred during connection"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Exchanging authorization code...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-2">
              <CheckCircle className="h-12 w-12 text-success mx-auto" />
              <p className="text-sm text-muted-foreground">
                Redirecting back to dashboard...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="w-full"
                >
                  Retry
                </Button>
                <Button
                  onClick={() => router.push("/dashboard")}
                  variant="secondary"
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
