import { ApiError } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export interface PatientUser {
  id: string;
  patientId: string;
  email: string;
  fullName: string;
  mrn: string;
  mustChangePassword: boolean;
}

export interface PatientAuthResponse {
  user: PatientUser;
}

let refreshPromise: Promise<void> | null = null;

async function responseError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null);
  let message = `Request failed (${response.status}).`;

  if (data && typeof data === "object" && "message" in data) {
    if (typeof data.message === "string") {
      message = data.message;
    } else if (
      Array.isArray(data.message) &&
      data.message.every((item) => typeof item === "string")
    ) {
      message = data.message.join(" ");
    }
  }

  return new ApiError(message, response.status, data);
}

async function sendRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(25_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;

    throw new ApiError(
      "Cannot reach the server or the request timed out. Please try again.",
      0,
    );
  }
}

async function refreshWithTabLock(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new ApiError(
      "Automatic patient session renewal is unavailable. Sign in again.",
      401,
    );
  }

  const signal = AbortSignal.timeout(25_000);

  try {
    await navigator.locks.request(
      "larqon-patient-session-refresh",
      { mode: "exclusive", signal },
      async () => {
        // Another tab may already have refreshed the shared cookies.
        const session = await sendRequest("/patient/auth/me", {
          signal,
        });

        if (session.ok) return;

        if (session.status !== 401) {
          throw await responseError(session);
        }

        const response = await sendRequest("/patient/auth/refresh", {
          method: "POST",
          signal,
        });

        if (!response.ok) {
          throw await responseError(response);
        }
      },
    );
  } catch (error) {
    if (signal.aborted) {
      throw new ApiError(
        "Patient session renewal timed out. Please try again.",
        0,
      );
    }

    throw error;
  }
}

function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshWithTabLock().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function patientApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/patient/")) {
    throw new Error("Patient API requests must use /patient/ routes.");
  }

  if (path === "/patient/auth/refresh") {
    throw new Error("Patient session refresh is managed by the API helper.");
  }

  let response = await sendRequest(path, options);

  const canRefresh =
    path !== "/patient/auth/login" && path !== "/patient/auth/change-password";

  if (response.status === 401 && canRefresh) {
    await refreshSession();

    // Retry the original request once, preserving its body and headers.
    response = await sendRequest(path, options);
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
