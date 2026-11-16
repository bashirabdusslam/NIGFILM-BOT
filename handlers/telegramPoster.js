const ORIGIN = "https://api.telegram.org";
const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 256;
const FRESH_MS = 60 * 60 * 1000;
const STALE_MS = 24 * FRESH_MS;
const TIMEOUT_MS = 3500;
const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
]);
const POSTER_CODES = new Set([
  "POSTER_CONFIG", "POSTER_NETWORK", "POSTER_TIMEOUT", "POSTER_RESPONSE", "POSTER_SIZE",
]);

function failure(code, retryable = false) {
  return Object.assign(new Error(code), {code, retryable});
}

export function telegramErrorCode(error) {
  const value = error?.cause?.code ?? error?.code;
  if (TRANSIENT_CODES.has(value) || POSTER_CODES.has(value) ||
      value === "TELEGRAM_CONFIG_INVALID" || /^TELEGRAM_HTTP_[1-5]\d{2}$/.test(typeof value === "string" ? value : "")) {
    return value;
  }
  const http = error?.response?.error_code;
  if (Number.isInteger(http) && http >= 100 && http <= 599) return `TELEGRAM_HTTP_${http}`;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "POSTER_TIMEOUT";
  return "TELEGRAM_ERROR";
}

async function request(fetcher, url, options, read) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, {
        ...options, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw failure(`TELEGRAM_HTTP_${response.status}`, response.status === 408 || response.status >= 500);
      }
      return await read(response);
    } catch (error) {
      const code = telegramErrorCode(error);
      const retryable = error?.retryable ?? (TRANSIENT_CODES.has(code) ||
        code === "POSTER_TIMEOUT" || (code === "TELEGRAM_ERROR" && error instanceof TypeError));
      if (!attempt && retryable) continue;
      throw failure(code === "TELEGRAM_ERROR" ? "POSTER_NETWORK" : code);
    }
  }
}

async function readPoster(response) {
  const size = Number(response.headers.get("content-length"));
  if (!response.body || size > MAX_POSTER_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw failure("POSTER_SIZE");
  }

  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_POSTER_BYTES) {
        await reader.cancel().catch(() => {});
        throw failure("POSTER_SIZE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = Buffer.concat(chunks, length);
  const signature = bytes.subarray(0, 12);
  let mime;
  if (signature.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) mime = "image/jpeg";
  else if (signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = "image/png";
  else if (/^GIF8[79]a/.test(signature.toString("ascii"))) mime = "image/gif";
  else if (signature.toString("ascii").startsWith("RIFF") && signature.toString("ascii", 8) === "WEBP") mime = "image/webp";
  else throw failure("POSTER_RESPONSE");
  return {bytes, mime};
}

export function createTelegramPosterLoader({botToken, fetcher = globalThis.fetch, now = Date.now} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  let cacheBytes = 0;

  function evict(id) {
    cacheBytes -= cache.get(id)?.bytes.length || 0;
    cache.delete(id);
  }

  async function download(fileId) {
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken || "")) throw failure("POSTER_CONFIG");
    const file = await request(fetcher, `${ORIGIN}/bot${botToken}/getFile`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({file_id: fileId}),
    }, response => response.json());
    const segments = typeof file?.result?.file_path === "string" ? file.result.file_path.split("/") : [];
    if (!file?.ok || !segments.length || segments.some(part => !part || part === "." || part === "..")) {
      throw failure("POSTER_RESPONSE");
    }
    const path = segments.map(encodeURIComponent).join("/");
    return request(fetcher, `${ORIGIN}/file/bot${botToken}/${path}`, {}, readPoster);
  }

  return function getPoster(fileId) {
    const saved = cache.get(fileId);
    if (saved) {
      cache.delete(fileId);
      cache.set(fileId, saved);
      if (now() - saved.savedAt < FRESH_MS) return Promise.resolve(saved);
    }
    if (inFlight.has(fileId)) return inFlight.get(fileId);

    const pending = download(fileId).then(image => {
      evict(fileId);
      const entry = {...image, savedAt: now()};
      cache.set(fileId, entry);
      cacheBytes += entry.bytes.length;
      while (cacheBytes > MAX_CACHE_BYTES || cache.size > MAX_CACHE_ENTRIES) evict(cache.keys().next().value);
      return entry;
    }).catch(error => {
      if (saved && now() - saved.savedAt < STALE_MS) return {...saved, stale: true};
      throw error;
    }).finally(() => inFlight.delete(fileId));

    inFlight.set(fileId, pending);
    return pending;
  };
}
