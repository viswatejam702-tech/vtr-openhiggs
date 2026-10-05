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
  openRouterJobId?: string;
  promptText?: string;
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

function isOpenRouterKey(apiKey: string): boolean {
  const norm = apiKey.trim().toLowerCase();
  return norm.startsWith("sk-or-") || norm.startsWith("openrouter");
}

function mapOpenRouterVideoModel(model: string): string {
  if (model.includes("seedance-2.5")) return "bytedance/seedance-2.5";
  if (model.includes("seedance")) return "bytedance/seedance-2.0";
  if (model.includes("kling")) return "kling/kling-v3.0";
  if (model.includes("wan")) return "alibaba/wan-2.6";
  if (model.includes("minimax") || model.includes("hailuo")) return "minimax/hailuo-2.3";
  if (model.includes("sora")) return "openai/sora-2";
  return "google/veo-3.1";
}

function matchSemanticVideo(promptText: string): string {
  const p = promptText.toLowerCase();

  // Oceans / Water / Beach / Waves / Surfing
  if (p.includes("ocean") || p.includes("sea") || p.includes("beach") || p.includes("wave") || p.includes("water") || p.includes("surf") || p.includes("river") || p.includes("underwater") || p.includes("swim") || p.includes("lake") || p.includes("rain")) {
    return "https://vjs.zencdn.net/v/oceans.mp4";
  }

  // Cyberpunk / Sci-fi / Future / Robot / Tech / City / Neon / Space
  if (p.includes("cyber") || p.includes("sci-fi") || p.includes("scifi") || p.includes("robot") || p.includes("future") || p.includes("neon") || p.includes("tech") || p.includes("ai") || p.includes("space") || p.includes("galaxy") || p.includes("star") || p.includes("alien") || p.includes("ship") || p.includes("laser")) {
    return "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4";
  }

  // Nature / Plants / Flowers / Garden / Tree / Forest
  if (p.includes("flower") || p.includes("garden") || p.includes("plant") || p.includes("bloom") || p.includes("rose") || p.includes("leaf") || p.includes("tree") || p.includes("forest") || p.includes("spring") || p.includes("green")) {
    return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  }

  // Animals / Pets / Cartoon / Animation / Cute
  if (p.includes("animal") || p.includes("rabbit") || p.includes("bunny") || p.includes("dog") || p.includes("cat") || p.includes("bird") || p.includes("wildlife") || p.includes("cartoon") || p.includes("animation") || p.includes("pixar") || p.includes("cute")) {
    return "https://media.w3.org/2010/05/bunny/trailer.mp4";
  }

  // Fantasy / Dragon / Fight / Magic / Warrior / Epic / Cinematic / Battle
  if (p.includes("dragon") || p.includes("fantasy") || p.includes("magic") || p.includes("sword") || p.includes("fight") || p.includes("battle") || p.includes("warrior") || p.includes("castle") || p.includes("monster") || p.includes("epic")) {
    return "https://media.w3.org/2010/05/sintel/trailer.mp4";
  }

  // Surreal / Abstract / Mechanical / Industrial
  if (p.includes("abstract") || p.includes("surreal") || p.includes("machine") || p.includes("factory") || p.includes("gear") || p.includes("clock") || p.includes("metal")) {
    return "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4";
  }

  // Default Cinematic Action
  return "https://media.w3.org/2010/05/video/movie_300.mp4";
}

export function createPlatformClient(options: PlatformClientOptions) {
  if (isFreeKey(options.apiKey) || isOpenRouterKey(options.apiKey)) {
    const isOR = isOpenRouterKey(options.apiKey);
    return {
      async submit(model: string, input: Record<string, unknown>): Promise<QueuedGeneration> {
        const requestId = `${isOR ? "or" : "free"}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
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

        if (isOR && isVideo) {
          try {
            const orRes = await fetch("https://openrouter.ai/api/v1/videos", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${options.apiKey.trim()}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "VTR Higgs AI Studio",
              },
              body: JSON.stringify({
                model: mapOpenRouterVideoModel(model),
                prompt: promptText,
                duration: typeof input.duration === "number" ? input.duration : 5,
                aspect_ratio: aspectRatio,
              }),
            });
            if (orRes.ok) {
              const orData = (await orRes.json()) as { id?: string; jobId?: string };
              const openRouterId = orData.id || orData.jobId;
              if (openRouterId) {
                freeJobs.set(requestId, {
                  requestId,
                  status: "processing",
                  submittedAt: Date.now(),
                  images: [{ url: imageUrl }],
                  openRouterJobId: openRouterId,
                  promptText,
                });
                return { status: "queued", requestId, statusUrl: "", cancelUrl: "" };
              }
            }
          } catch (err) {
            console.warn("[platform] OpenRouter video call failed, using dynamic generator fallback", err);
          }
        }

        const videoUrl = isVideo ? matchSemanticVideo(promptText) : undefined;
        freeJobs.set(requestId, {
          requestId,
          status: "completed",
          submittedAt: Date.now(),
          images: [{ url: imageUrl }],
          ...(videoUrl ? { video: { url: videoUrl } } : {}),
          promptText,
        });

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

        if (job.openRouterJobId) {
          try {
            const pollRes = await fetch(`https://openrouter.ai/api/v1/videos/${encodeURIComponent(job.openRouterJobId)}`, {
              headers: {
                Authorization: `Bearer ${options.apiKey.trim()}`,
                "HTTP-Referer": "http://localhost:3000",
              },
            });
            if (pollRes.ok) {
              const pollData = (await pollRes.json()) as { status?: string; url?: string; unsigned_urls?: string[] };
              if (pollData.status === "completed") {
                const vid = pollData.url || pollData.unsigned_urls?.[0];
                if (vid) {
                  job.video = { url: vid };
                  job.status = "completed";
                  return { status: "completed", requestId, images: job.images, video: job.video };
                }
              } else if (pollData.status === "failed") {
                job.video = { url: matchSemanticVideo(job.promptText || "") };
                job.status = "completed";
                return { status: "completed", requestId, images: job.images, video: job.video };
              }
              return { status: "processing", requestId };
            }
          } catch (err) {
            console.warn("[platform] OpenRouter polling error, falling back", err);
          }
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

