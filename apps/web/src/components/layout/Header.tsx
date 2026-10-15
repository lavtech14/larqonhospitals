"use client";

import { useState } from "react";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

export default function Header() {
  const user = useStaffUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await apiRequest<{ message: string }>("/auth/logout", {
        method: "POST",
      });

      // Full navigation clears the current page's in-memory demo state.
      window.location.replace("/login");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.replace("/login");
        return;
      }

      setError("Could not log out. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <header className="topbar staff-topbar">
      <span>Larqon Hospitals / Staff workspace</span>

      <div className="header-account">
        <div className="header-identity">
          <strong>{user.fullName}</strong>
          <span>{user.roles.join(", ").replaceAll("_", " ")}</span>
        </div>

        <button
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={logout}
        >
          {busy ? "Logging out..." : "Log out"}
        </button>
      </div>

      {error && (
        <p className="header-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
