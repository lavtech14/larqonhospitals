type RegistrationOperation = {
  fingerprint: string;
  key: string;
};

function storageName(userId: string) {
  return `larqon:patient-registration:${userId}`;
}

export async function getRegistrationKey(
  userId: string,
  body: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );

  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const name = storageName(userId);

  let previous: RegistrationOperation | null = null;

  try {
    const stored = sessionStorage.getItem(name);

    if (stored) {
      const parsed: unknown = JSON.parse(stored);

      if (
        parsed &&
        typeof parsed === "object" &&
        "fingerprint" in parsed &&
        "key" in parsed &&
        typeof parsed.fingerprint === "string" &&
        typeof parsed.key === "string" &&
        /^[a-f0-9-]{36}$/i.test(parsed.key)
      ) {
        previous = {
          fingerprint: parsed.fingerprint,
          key: parsed.key,
        };
      }
    }
  } catch {
    throw new Error(
      "Unable to prepare registration storage. Check browser storage settings.",
    );
  }

  if (previous?.fingerprint === fingerprint) {
    return previous.key;
  }

  const key = crypto.randomUUID();

  try {
    sessionStorage.setItem(name, JSON.stringify({ fingerprint, key }));
  } catch {
    throw new Error(
      "Unable to retain a safe retry key. Registration was not submitted.",
    );
  }

  return key;
}

export function clearRegistrationKey(userId: string) {
  try {
    sessionStorage.removeItem(storageName(userId));
  } catch {
    // Registration already succeeded. Do not present it as a failed save.
  }
}
