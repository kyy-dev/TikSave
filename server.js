const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const Tiktok = require("@tobyg74/tiktok-api-dl");

const publicDirectory = path.join(__dirname, "public");
const bodyLimit = 64 * 1024;
const requestTimeout = 45_000;
const requestCounts = new Map();
const windowMs = 60_000;
const requestLimit = 30;

const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/credits", ["credits.html", "text/html; charset=utf-8"]],
  ["/credits/", ["credits.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/credits.js", ["credits.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

class RequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function readText(value, label, { required = true, maxLength = 500 } = {}) {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new RequestError(`${label} harus berupa teks.`);
  }

  const text = value.trim();
  if (required && !text) throw new RequestError(`${label} wajib diisi.`);
  if (text.length > maxLength) throw new RequestError(`${label} terlalu panjang.`);
  return text;
}

function readNumber(value, label, { defaultValue, max = 100 } = {}) {
  const number = value === undefined || value === "" ? defaultValue : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RequestError(`${label} harus berupa angka antara 1 dan ${max}.`);
  }
  return number;
}

function readUsername(value) {
  const username = readText(value, "Username", { maxLength: 24 }).replace(/^@/, "");
  if (!/^[\w.]+$/.test(username)) {
    throw new RequestError("Username hanya boleh berisi huruf, angka, titik, dan garis bawah.");
  }
  return username;
}

function readTikTokUrl(value, label = "URL TikTok") {
  const text = readText(value, label, { maxLength: 2048 });
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new RequestError(`${label} tidak valid.`);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (hostname !== "tiktok.com" && !hostname.endsWith(".tiktok.com")) ||
    url.username ||
    url.password
  ) {
    throw new RequestError(`Gunakan ${label.toLowerCase()} dari domain TikTok.`);
  }
  return url.toString();
}

function readTikTokIdOrUrl(value, label) {
  const text = readText(value, label, { maxLength: 2048 });
  if (/^https?:\/\//i.test(text)) return readTikTokUrl(text, label);
  if (!/^[\w.-]{1,200}$/.test(text)) {
    throw new RequestError(`${label} harus berupa ID atau URL TikTok.`);
  }
  return text;
}

function readCookie(value) {
  const cookie = readText(value, "Cookie TikTok", { maxLength: 10_000 });
  if (/[<>]/.test(cookie)) throw new RequestError("Format cookie TikTok tidak valid.");
  return cookie;
}

function readProxy(value) {
  const proxy = readText(value, "Proxy", { required: false, maxLength: 2048 });
  if (!proxy) return undefined;

  let url;
  try {
    url = new URL(proxy);
  } catch {
    throw new RequestError("Alamat proxy tidak valid.");
  }
  if (!["http:", "https:", "socks5:", "socks5h:"].includes(url.protocol) || !url.hostname) {
    throw new RequestError("Proxy harus memakai HTTP, HTTPS, SOCKS5, atau SOCKS5H.");
  }
  return proxy;
}

function firstMediaUrl(value) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {}
  }
  return undefined;
}

function addDownloadChoices(response) {
  if (response?.status !== "success" || !response.result || typeof response.result !== "object") {
    return response;
  }

  const result = response.result;
  const choices = [];
  const missing = [];

  if (result.type === "video") {
    const highQuality = firstMediaUrl(result.videoHD);
    const standardQuality = firstMediaUrl(result.videoSD) || firstMediaUrl(result.video?.playAddr);
    const watermarked =
      firstMediaUrl(result.videoWatermark) || firstMediaUrl(result.video?.downloadAddr);
    const music =
      firstMediaUrl(result.music?.playUrl) ||
      firstMediaUrl(result.music) ||
      firstMediaUrl(result.direct);

    if (highQuality) {
      choices.push({ format: "no-watermark", label: "Video tanpa WM · HD", url: highQuality });
    } else if (standardQuality) {
      choices.push({ format: "no-watermark", label: "Video tanpa WM · SD", url: standardQuality });
    } else {
      missing.push("Video tanpa watermark");
    }

    if (standardQuality && highQuality) {
      choices.push({ format: "no-watermark", label: "Video tanpa WM · SD", url: standardQuality });
    }
    if (watermarked) {
      choices.push({ format: "watermark", label: "Video dengan WM", url: watermarked });
    } else {
      missing.push("Video dengan watermark");
    }
    if (music) {
      choices.push({ format: "music", label: "Lagu · MP3", url: music });
    } else {
      missing.push("Lagu");
    }
  } else if (result.type === "music") {
    const music =
      firstMediaUrl(result.music?.playUrl) ||
      firstMediaUrl(result.music) ||
      firstMediaUrl(result.direct);
    if (music) {
      choices.push({ format: "music", label: "Lagu · MP3", url: music });
    } else {
      missing.push("Lagu");
    }
  } else if (result.type === "image" && Array.isArray(result.images)) {
    result.images.forEach((image, index) => {
      const url = firstMediaUrl(image);
      if (url) choices.push({ format: "image", label: `Foto ${index + 1}`, url });
    });
  }

  return {
    ...response,
    result: {
      ...result,
      downloadChoices: choices,
      comingSoon: missing,
    },
  };
}

async function runFeature(api, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new RequestError("Permintaan tidak valid.");
  }

  const values = payload.values && typeof payload.values === "object" ? payload.values : {};
  const action = readText(payload.action, "Fitur", { maxLength: 40 });
  const proxy = readProxy(values.proxy);

  switch (action) {
    case "download": {
      const url = readTikTokUrl(values.url);
      const version = readText(values.version || "v1", "Versi downloader", { maxLength: 2 });
      if (!["v1", "v2", "v3"].includes(version)) {
        throw new RequestError("Pilih versi downloader v1, v2, atau v3.");
      }
      const result = await api.Downloader(url, {
        version,
        proxy,
        showOriginalResponse: values.showOriginalResponse === true,
      });
      return addDownloadChoices(result);
    }
    case "search": {
      const keyword = readText(values.keyword, "Kata kunci", { maxLength: 100 });
      const type = readText(values.type, "Jenis pencarian", { maxLength: 10 });
      if (!["user", "live", "video"].includes(type)) {
        throw new RequestError("Pilih jenis pencarian user, live, atau video.");
      }
      return api.Search(keyword, {
        type,
        cookie: readCookie(values.cookie),
        page: readNumber(values.page, "Halaman", { defaultValue: 1, max: 10_000 }),
        proxy,
      });
    }
    case "stalk":
      return api.StalkUser(readUsername(values.username), { proxy });
    case "comments":
      return api.GetVideoComments(readTikTokUrl(values.url), {
        commentLimit: readNumber(values.limit, "Batas komentar", { defaultValue: 20 }),
        proxy,
      });
    case "posts":
      return api.GetUserPosts(readUsername(values.username), {
        postLimit: readNumber(values.limit, "Batas postingan", { defaultValue: 30 }),
        proxy,
      });
    case "reposts":
      return api.GetUserReposts(readUsername(values.username), {
        postLimit: readNumber(values.limit, "Batas repost", { defaultValue: 30 }),
        filterDeletedPost: values.filterDeletedPost === true,
        proxy,
      });
    case "liked":
      return api.GetUserLiked(readUsername(values.username), {
        cookie: readCookie(values.cookie),
        postLimit: readNumber(values.limit, "Batas video", { defaultValue: 30 }),
        proxy,
      });
    case "collection":
      return api.Collection(readTikTokIdOrUrl(values.idOrUrl, "ID atau URL koleksi"), {
        page: readNumber(values.page, "Halaman", { defaultValue: 1, max: 10_000 }),
        count: readNumber(values.count, "Jumlah video", { defaultValue: 5 }),
        proxy,
      });
    case "playlist":
      return api.Playlist(readTikTokIdOrUrl(values.idOrUrl, "ID atau URL playlist"), {
        page: readNumber(values.page, "Halaman", { defaultValue: 1, max: 10_000 }),
        count: readNumber(values.count, "Jumlah video", { defaultValue: 5 }),
        proxy,
      });
    case "trending":
      return api.Trending({ proxy });
    case "trending-creators":
      return api.TrendingCreators({ proxy });
    case "music-videos":
      return api.GetVideosByMusicId(readTikTokIdOrUrl(values.idOrUrl, "ID atau URL musik"), {
        page: readNumber(values.page, "Halaman", { defaultValue: 1, max: 10_000 }),
        count: readNumber(values.count, "Jumlah video", { defaultValue: 30 }),
        proxy,
      });
    case "music-detail":
      return api.GetMusicDetail(readTikTokIdOrUrl(values.idOrUrl, "ID atau URL musik"), {
        cookie: readCookie(values.cookie),
        proxy,
      });
    default:
      throw new RequestError("Fitur yang dipilih tidak tersedia.");
  }
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(text);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > bodyLimit) throw new RequestError("Permintaan terlalu besar.", 413);
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError("Format permintaan tidak valid.");
  }
}

function takeRequestSlot(address) {
  const now = Date.now();
  const recent = (requestCounts.get(address) || []).filter((time) => now - time < windowMs);
  if (recent.length >= requestLimit) return false;
  recent.push(now);
  requestCounts.set(address, recent);
  return true;
}

function sanitizeError(error, payload) {
  let message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Permintaan ke TikTok gagal.";
  for (const secret of [payload?.values?.cookie, payload?.values?.proxy]) {
    if (typeof secret === "string" && secret) message = message.split(secret).join("[disamarkan]");
  }
  return message.slice(0, 500);
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new RequestError("Permintaan ke TikTok melewati batas waktu.", 504)),
      milliseconds,
    );
    Promise.resolve(promise).then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createServer({ api = Tiktok } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const file = staticFiles.get(url.pathname);

    if (request.method === "GET" && file) {
      try {
        const content = await fs.readFile(path.join(publicDirectory, file[0]));
        response.writeHead(200, {
          "content-type": file[1],
          "cache-control": "no-cache",
          "content-security-policy":
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; media-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        });
        response.end(content);
      } catch (error) {
        console.error(`Static file error: ${error.message}`);
        sendJson(response, 500, { error: "Halaman tidak dapat dimuat." });
      }
      return;
    }

    if (
      url.pathname === "/api/health" &&
      (request.method === "GET" || request.method === "POST")
    ) {
      sendText(response, 200);
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/run") {
      sendJson(response, 404, { error: "Halaman tidak ditemukan." });
      return;
    }

    const address = request.socket.remoteAddress || "unknown";
    if (!takeRequestSlot(address)) {
      sendJson(response, 429, { error: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." });
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
      const result = await withTimeout(runFeature(api, payload), requestTimeout);

      if (result?.status === "error") {
        sendJson(
          response,
          422,
          { error: sanitizeError(result.message || "TikTok tidak dapat memproses permintaan ini.", payload) },
        );
        return;
      }
      sendJson(response, 200, { result });
    } catch (error) {
      const statusCode = error instanceof RequestError ? error.statusCode : 502;
      if (!(error instanceof RequestError)) {
        console.error(`TikTok request error: ${sanitizeError(error, payload)}`);
      }
      sendJson(response, statusCode, { error: sanitizeError(error, payload) });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error("PORT harus berupa angka antara 1 dan 65535.");
    process.exitCode = 1;
  } else {
    createServer().listen(port, host, () => {
      console.log(`TikSave tersedia di http://${host}:${port}`);
    });
  }
}

module.exports = { createServer, runFeature };
