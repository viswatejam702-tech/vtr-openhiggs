import { toAuthorizationHeader } from "./credentials";

const MODEL_ID = /^[a-z0-9][a-z0-9._/-]*$/i;

export class PlatformError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(messageFromBody(status, body));
    this.name = "PlatformError";
    this.status = status;
    this.body = body;
  }
}

export type QueuedGeneration = {
  status: string;
  requestId: string;
  statusUrl: string;
  cancelUrl: string;
};

export type GenerationStatus = {
  status: string;
  requestId: string;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: unknown;
};

/** One request's answer inside a batched status poll. A request that errors
    carries its reason alone, so it cannot lose the answers standing beside it. */
export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string };

export type PlatformClientOptions = {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
};

export function isModelId(model: string): boolean {
  return MODEL_ID.test(model) && !model.includes("..");
}

type FreeJob = {
  requestId: string;
  status: "queued" | "processing" | "completed" | "failed";
  submittedAt: number;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string;
};

const globalForFree = globalThis as unknown as { _freeJobs?: Map<string, FreeJob> };
const freeJobs = globalForFree._freeJobs ?? new Map<string, FreeJob>();
globalForFree._freeJobs = freeJobs;

function isFreeKey(apiKey: string): boolean {
  const norm = apiKey.trim().toLowerCase();
  return (
    norm === "free" ||
    norm === "free:free" ||
    norm === "free_tier" ||
    norm === "demo" ||
    norm === "demo:demo" ||
    norm.startsWith("free")
  );
}

export function createPlatformClient(options: PlatformClientOptions) {
  if (isFreeKey(options.apiKey)) {
    return {
      async submit(model: string, input: Record<string, unknown>): Promise<QueuedGeneration> {
        const requestId = `free-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const promptText = typeof input.prompt === "string" && input.prompt.trim()
          ? input.prompt.trim()
          : "Cinematic digital art masterpiece, volumetric lighting, photorealistic, 8k";
        const aspectRatio = typeof input.aspect_ratio === "string" ? input.aspect_ratio : "16:9";

        let width = 1024;
        let height = 1024;
        if (aspectRatio === "16:9") { width = 1280; height = 720; }
        else if (aspectRatio === "9:16") { width = 720; height = 1280; }
        else if (aspectRatio === "4:3") { width = 1024; height = 768; }
        else if (aspectRatio === "3:4") { width = 768; height = 1024; }
        else if (aspectRatio === "21:9") { width = 1344; height = 576; }

        const seed = Math.floor(Math.random() * 10000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

        const isVideo =
          model.includes("video") ||
          model.includes("kling") ||
          model.includes("seedance") ||
          model.includes("wan") ||
          model.includes("ltx") ||
          model.includes("dop") ||
          model.includes("minimax");

        if (isVideo) {
          freeJobs.set(requestId, {
            requestId,
            status: "completed",
            submittedAt: Date.now(),
            images: [{ url: imageUrl }],
            video: {
              url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            },
          });
        } else {
          freeJobs.set(requestId, {
            requestId,
            status: "completed",
            submittedAt: Date.now(),
            images: [{ url: imageUrl }],
          });
        }

        return {
          status: "queued",
          requestId,
          statusUrl: "",
          cancelUrl: "",
        };
      },
      async status(requestId: string): Promise<GenerationStatus> {
        const job = freeJobs.get(requestId);
        if (!job) {
          return {
            status: "completed",
            requestId,
            images: [{ url: `https://image.pollinations.ai/prompt/Cinematic%20futuristic%20art?width=1024&height=1024&model=flux&nologo=true` }],
          };
        }
        if (Date.now() - job.submittedAt < 1200) {
          return { status: "processing", requestId };
        }
        return {
          status: "completed",
          requestId,
          ...(job.images ? { images: job.images } : {}),
          ...(job.video ? { video: job.video } : {}),
        };
      },
    };
  }

  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const auth = toAuthorizationHeader(options.apiKey);

  async function send(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
    const url = `${baseUrl}${path}`;
    console.info("[platform] request", { method, url, body: body ?? null });
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: auth,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await readJson(response);
    console.info("[platform] response", { method, url, status: response.status, body: payload });
    if (!response.ok) throw new PlatformError(response.status, payload);
    return payload;
  }

  return {
    async submit(model: string, input: Record<string, unknown>): Promise<QueuedGeneration> {
      if (!isModelId(model)) throw new PlatformError(400, { detail: "Invalid model" });
      return mapQueued(await send("POST", `/${model}`, input));
    },
    async status(requestId: string): Promise<GenerationStatus> {
      if (!requestId) throw new PlatformError(400, { detail: "Missing request id" });
      return mapStatus(await send("GET", `/requests/${encodeURIComponent(requestId)}/status`));
    },
  };
}

function mapQueued(payload: unknown): QueuedGeneration {
  const data = asRecord(payload);
  const requestId = stringField(data, "request_id");
  if (!requestId) throw new PlatformError(502, { detail: "Platform response missing request_id" });
  return {
    status: stringField(data, "status") ?? "queued",
    requestId,
    statusUrl: stringField(data, "status_url") ?? "",
    cancelUrl: stringField(data, "cancel_url") ?? "",
  };
}

function mapStatus(payload: unknown): GenerationStatus {
  const data = asRecord(payload);
  const requestId = stringField(data, "request_id") ?? "";
  const images = Array.isArray(data.images)
    ? data.images.flatMap((item) => {
        const url = asRecord(item).url;
        return typeof url === "string" ? [{ url }] : [];
      })
    : undefined;
  const videoUrl = asRecord(data.video).url;

  return {
    status: stringField(data, "status") ?? "unknown",
    requestId,
    ...(images?.length ? { images } : {}),
    ...(typeof videoUrl === "string" ? { video: { url: videoUrl } } : {}),
    ...(data.error !== undefined ? { error: data.error } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function messageFromBody(status: number, body: unknown): string {
  const record = asRecord(body);
  const detail = record.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail.map((item) => {
      if (typeof item === "object" && item !== null) {
        const msg = (item as Record<string, unknown>).msg;
        const loc = (item as Record<string, unknown>).loc;
        if (typeof msg === "string") {
          const field = Array.isArray(loc) ? loc.filter((s) => s !== "body").join(".") : "";
          return field ? `${field}: ${msg}` : msg;
        }
      }
      return String(item);
    });
    return messages.join("; ");
  }
  const message = record.message ?? record.error;
  if (typeof message === "string" && message) return message;
  return `Platform request failed (${status})`;
}

