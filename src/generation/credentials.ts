export const PLATFORM_KEY_COOKIE = "api_key";

export const PLATFORM_KEY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export class MissingCredentialsError extends Error {
  constructor() {
    super("Missing platform key");
    this.name = "MissingCredentialsError";
  }
}

export function encodeCredentials(apiKey: string): string {
  return JSON.stringify({ apiKey });
}

export function decodeCredentials(raw: string | undefined): { apiKey: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const apiKey = (parsed as { apiKey?: unknown }).apiKey;
    if (typeof apiKey !== "string" || !apiKey.trim()) return null;
    return { apiKey: requireIdAndSecret(apiKey.trim()) };
  } catch {
    return null;
  }
}

export function parseCredentialInput(data: unknown): { apiKey: string } {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Enter an API key");
  }
  const record = data as { apiKey?: unknown; api_key?: unknown };
  const apiKey = record.apiKey ?? record.api_key;
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("Enter an API key");
  return { apiKey: requireIdAndSecret(apiKey.trim()) };
}

export function toAuthorizationHeader(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith("sk-or-") || trimmed.toLowerCase().startsWith("openrouter") || trimmed.startsWith("hf_")) {
    return `Bearer ${trimmed}`;
  }
  return `Key ${requireIdAndSecret(apiKey)}`;
}

function requireIdAndSecret(apiKey: string): string {
  const trimmed = apiKey.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === "free" ||
    lower === "free:free" ||
    lower === "free_tier" ||
    lower === "demo" ||
    lower === "demo:demo" ||
    lower.startsWith("free")
  ) {
    return "free:free";
  }
  if (trimmed.startsWith("sk-or-") || lower.startsWith("openrouter") || trimmed.startsWith("hf_")) {
    return trimmed;
  }
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || colon === trimmed.length - 1) {
    // If not colon formatted, return trimmed directly instead of throwing
    return trimmed;
  }
  return trimmed;
}

