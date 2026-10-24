"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import type { AuthResponse, StaffUser } from "@/lib/api";

const StaffContext = createContext<StaffUser | null>(null);

export function useStaffUser(): StaffUser {
  const user = useContext(StaffContext);

  if (!user) {
    throw new Error("useStaffUser must be used inside StaffSessionGate.");
  }

  return user;
}

type SessionState = {
  user: StaffUser | null;
  error: string;
};

export default function StaffSessionGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [state, setState] = useState<SessionState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let checking = false;
    let redirecting = false;
    const controller = new AbortController();

    function returnToLogin() {
      if (!active || redirecting) return;

      redirecting = true;
      setState(null);
      router.replace("/login");
    }

    async function checkSession() {
      if (!active || checking || redirecting) return;

      checking = true;

      try {
        const result = await apiRequest<AuthResponse>("/auth/me", {
          signal: controller.signal,
        });

        if (!active || redirecting) return;

        if (result.user.mustChangePassword) {
          returnToLogin();
          return;
        }

        setState({
          user: result.user,
          error: "",
        });
      } catch (error) {
        if (!active || redirecting) return;

        if (error instanceof ApiError && error.status === 401) {
          returnToLogin();
          return;
        }

        setState({
          user: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to check your session.",
        });
      } finally {
        checking = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    }

    function onFocus() {
      void checkSession();
    }

    function onUnauthorized() {
      returnToLogin();
    }

    void checkSession();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    }, 60_000);

    window.addEventListener("focus", onFocus);
    window.addEventListener("larqon:unauthorized", onUnauthorized);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("larqon:unauthorized", onUnauthorized);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, attempt]);

  if (!state) {
    return (
      <main className="session-screen">
        <p role="status">Checking your staff session...</p>
      </main>
    );
  }

  if (!state.user) {
    return (
      <main className="session-screen">
        <div className="session-card">
          <h1>Unable to verify your session</h1>
          <p className="muted" role="alert">
            {state.error}
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setState(null);
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <StaffContext.Provider value={state.user}>{children}</StaffContext.Provider>
  );
}
