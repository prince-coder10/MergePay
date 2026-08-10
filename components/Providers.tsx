"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { useConnection } from "wagmi";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

// Build the theme once outside the component to avoid recreating on each render.
// borderRadius must be "small" | "medium" | "large" — "none" maps to border=0
// which crashes the internal cuer QR code library.
const rainbowTheme = darkTheme({
  accentColor: "#ccff00",
  accentColorForeground: "#050505",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

/**
 * Inner component that has access to wagmi hooks (useConnection).
 * Must be rendered inside WagmiProvider.
 */
function AuthenticatedRainbowKit({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const { address, status } = useConnection();
  const isConnected = status === "connected";

  // Track whether the wallet was previously connected.
  // This prevents the logout effect from firing on initial mount / page reload
  // before wagmi has had a chance to reconnect from localStorage.
  const wasConnectedRef = useRef(false);

  // On mount, check if the user has an existing session cookie
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    }
    checkSession();
  }, []);

  // Track connection state transitions
  useEffect(() => {
    if (isConnected) {
      // Mark that the wallet has been connected at least once in this session
      wasConnectedRef.current = true;
    }
  }, [isConnected]);

  // When the wallet genuinely disconnects (was connected → now disconnected),
  // call logout and reset auth status.
  useEffect(() => {
    if (!isConnected && wasConnectedRef.current && authStatus === "authenticated") {
      wasConnectedRef.current = false;
      fetch("/api/auth/logout", { method: "POST" }).then(() => {
        setAuthStatus("unauthenticated");
      });
    }
  }, [isConnected, authStatus]);

  const authAdapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const res = await fetch("/api/auth/nonce");
          const data = await res.json();
          return data.nonce;
        },

        createMessage: ({ nonce, address: walletAddress }) => {
          // Return the exact message format the backend expects.
          // RainbowKit passes in the connected wallet address automatically.
          return `Sign in to MergePay with nonce: ${nonce}`;
        },

        verify: async ({ message, signature }) => {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: address,
              signature: signature,
            }),
          });

          if (res.ok) {
            setAuthStatus("authenticated");
            return true;
          }
          return false;
        },

        signOut: async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          setAuthStatus("unauthenticated");
        },
      }),
    [address]
  );

  return (
    <RainbowKitAuthenticationProvider adapter={authAdapter} status={authStatus}>
      <RainbowKitProvider theme={rainbowTheme}>
        {children}
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthenticatedRainbowKit>
          {children}
        </AuthenticatedRainbowKit>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
