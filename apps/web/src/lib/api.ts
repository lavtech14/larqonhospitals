const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  mustChangePassword: boolean;
  permissions?: string[];
};

export type AuthResponse = {
  user: StaffUser;
};

let refreshPromise: Promise<void> | null = null;

function notifyUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("larqon:unauthorized"));
  }
}

async function responseError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null);

  let message = `Request failed (${response.status}).`;

  if (data && typeof data === "object" && "message" in data) {
    const serverMessage = data.message;

    if (typeof serverMessage === "string") {
      message = serverMessage;
    } else if (
      Array.isArray(serverMessage) &&
      serverMessage.every((item) => typeof item === "string")
    ) {
      message = serverMessage.join(" ");
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
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }
}

async function refreshWithTabLock(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new ApiError(
      "Automatic session renewal is unavailable. Please sign in again.",
      401,
    );
  }

  // Bounds time spent waiting for the lock and making refresh requests.
  const signal = AbortSignal.timeout(25_000);

  try {
    await navigator.locks.request(
      "larqon-session-refresh",
      { mode: "exclusive", signal },
      async () => {
        // Another tab may have restored the access cookie while we waited.
        const sessionResponse = await sendRequest("/auth/me", {
          signal,
        });

        if (sessionResponse.ok) {
          return;
        }

        if (sessionResponse.status !== 401) {
          throw await responseError(sessionResponse);
        }

        const refreshResponse = await sendRequest("/auth/refresh", {
          method: "POST",
          signal,
        });

        if (!refreshResponse.ok) {
          throw await responseError(refreshResponse);
        }
      },
    );
  } catch (error) {
    if (signal.aborted) {
      throw new ApiError("Session renewal timed out. Please try again.", 0);
    }

    throw error;
  }
}

function refreshSession(): Promise<void> {
  // Share one refresh operation across requests within this tab.
  if (!refreshPromise) {
    refreshPromise = refreshWithTabLock().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Refresh is coordinated internally; don't call it directly from components.
  if (path === "/auth/refresh") {
    throw new ApiError("Session refresh is managed by the API helper.", 0);
  }

  let response = await sendRequest(path, options);

  const canRefresh = path !== "/auth/login" && path !== "/auth/change-password";

  if (response.status === 401 && canRefresh) {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        notifyUnauthorized();
      }

      throw error;
    }

    // Retry only once. Do not retry network failures automatically.
    response = await sendRequest(path, options);
  }

  if (!response.ok) {
    const error = await responseError(response);

    if (response.status === 401 && path !== "/auth/login") {
      notifyUnauthorized();
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
