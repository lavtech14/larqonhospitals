const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
};

export type AuthResponse = {
  user: StaffUser;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event("larqon:unauthorized"));
    }
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

    throw new ApiError(message, response.status);
  }

  return data as T;
}
