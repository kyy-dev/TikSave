const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("./server");
const { createServer } = app;

let server;
let baseUrl;
const calls = [];
let downloaderResult = { status: "success", result: { ok: true } };

test("exports an HTTP server for Vercel", async () => {
  assert.equal(typeof app.listen, "function");
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${app.address().port}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /TikSave/);
  } finally {
    await new Promise((resolve, reject) =>
      app.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

const mockApi = Object.fromEntries(
  [
    "Downloader",
    "Search",
    "StalkUser",
    "GetVideoComments",
    "GetUserPosts",
    "GetUserReposts",
    "GetUserLiked",
    "Collection",
    "Playlist",
    "Trending",
    "TrendingCreators",
    "GetVideosByMusicId",
    "GetMusicDetail",
  ].map((method) => [
    method,
    async (...args) => {
      calls.push({ method, args });
      return { status: "success", result: { ok: true } };
    },
  ]),
);
mockApi.Downloader = async (...args) => {
  calls.push({ method: "Downloader", args });
  return downloaderResult;
};

before(async () => {
  server = createServer({ api: mockApi });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("serves the website shell", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /TikSave/);
  assert.match(html, /google-adsense-account.*ca-pub-1733536931464613/);
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(response.headers.get("content-security-policy"), /pagead2\.googlesyndication\.com/);
});

test("serves the AdSense ads.txt declaration", async () => {
  const response = await fetch(`${baseUrl}/ads.txt`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  assert.equal(
    (await response.text()).trim(),
    "google.com, pub-1733536931464613, DIRECT, f08c47fec0942fa0",
  );
});

test("returns successful plain-text health checks for API GET and POST", async () => {
  for (const method of ["GET", "POST"]) {
    const response = await fetch(`${baseUrl}/api/health`, { method });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    assert.equal(await response.text(), "");
  }
});

test("serves the credits page with upstream project attribution", async () => {
  const response = await fetch(`${baseUrl}/credits`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Kredit dan ucapan terima kasih/);
  assert.match(html, /google-adsense-account.*ca-pub-1733536931464613/);
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(html, /TobyG74\/tiktok-api-dl/);
  assert.match(html, /SSSTik/);
  assert.match(html, /MusicalDown/);
  assert.match(html, /versi 1\.3\.7/);
  assert.match(html, /Fetch untuk meminta data/);
  assert.match(html, /tidak berafiliasi/);
  assert.equal((await fetch(`${baseUrl}/credits.js`)).status, 200);
});

test("dispatches a search with required cookie without persisting it", async () => {
  calls.length = 0;
  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "search",
      values: { keyword: "musik", type: "video", cookie: "sessionid=secret", page: "2" },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls[0].method, "Search");
  assert.equal(calls[0].args[1].cookie, "sessionid=secret");
  assert.equal(JSON.stringify(await response.json()).includes("sessionid=secret"), false);
});

test("rejects non-TikTok links before calling the library", async () => {
  calls.length = 0;
  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "download", values: { url: "https://example.com/video" } }),
  });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("rejects unknown feature names", async () => {
  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "does-not-exist", values: {} }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /tidak tersedia/i);
});

test("dispatches each library feature from the website API", async () => {
  const cases = [
    ["download", { url: "https://www.tiktok.com/@user/video/123", version: "v1" }, "Downloader"],
    ["search", { keyword: "dance", type: "user", cookie: "sid=1" }, "Search"],
    ["stalk", { username: "@user" }, "StalkUser"],
    ["comments", { url: "https://www.tiktok.com/@user/video/123" }, "GetVideoComments"],
    ["posts", { username: "user" }, "GetUserPosts"],
    ["reposts", { username: "user" }, "GetUserReposts"],
    ["liked", { username: "user", cookie: "sid=1" }, "GetUserLiked"],
    ["collection", { idOrUrl: "12345" }, "Collection"],
    ["playlist", { idOrUrl: "12345" }, "Playlist"],
    ["trending", {}, "Trending"],
    ["trending-creators", {}, "TrendingCreators"],
    ["music-videos", { idOrUrl: "12345" }, "GetVideosByMusicId"],
    ["music-detail", { idOrUrl: "12345", cookie: "sid=1" }, "GetMusicDetail"],
  ];

  for (const [action, values, method] of cases) {
    calls.length = 0;
    const response = await fetch(`${baseUrl}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, values }),
    });
    assert.equal(response.status, 200, `${action} returned an error`);
    assert.equal(calls[0].method, method);
  }
});

test("classifies available video and music download links", async () => {
  downloaderResult = {
    status: "success",
    result: {
      type: "video",
      videoHD: "https://media.example/video-hd.mp4",
      videoSD: "https://media.example/video-sd.mp4",
      videoWatermark: "https://media.example/video-watermark.mp4",
      music: "https://media.example/audio.mp3",
    },
  };

  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "download",
      values: { url: "https://www.tiktok.com/@user/video/123" },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls.at(-1).args[1].version, "v1");
  assert.deepEqual(
    body.result.result.downloadChoices.map(({ format, label }) => ({ format, label })),
    [
      { format: "no-watermark", label: "Video tanpa WM · HD" },
      { format: "no-watermark", label: "Video tanpa WM · SD" },
      { format: "watermark", label: "Video dengan WM" },
      { format: "music", label: "Lagu · MP3" },
    ],
  );
  assert.deepEqual(body.result.result.comingSoon, []);
  assert.equal(body.result.result.videoHD, downloaderResult.result.videoHD);
});

test("labels unavailable download formats as coming soon", async () => {
  downloaderResult = {
    status: "success",
    result: {
      type: "video",
      videoSD: "https://media.example/video-sd.mp4",
    },
  };

  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "download",
      values: { url: "https://www.tiktok.com/@user/video/123" },
    }),
  });
  const body = await response.json();

  assert.deepEqual(
    body.result.result.downloadChoices.map(({ label }) => label),
    ["Video tanpa WM · SD"],
  );
  assert.deepEqual(body.result.result.comingSoon, ["Video dengan watermark", "Lagu"]);
});

test("supports API v1 and v2 playAddr results as no-watermark downloads", async () => {
  for (const version of ["v1", "v2"]) {
    downloaderResult = {
      status: "success",
      result: {
        type: "video",
        video: {
          playAddr: [`https://media.example/${version}-play.mp4`],
          ...(version === "v1" ? { downloadAddr: ["https://media.example/v1-download.mp4"] } : {}),
        },
        music: { playUrl: [`https://media.example/${version}-music.mp3`] },
      },
    };

    const response = await fetch(`${baseUrl}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "download",
        values: { url: "https://www.tiktok.com/@user/video/123", version },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(calls.at(-1).args[1].version, version);
    assert.deepEqual(
      body.result.result.downloadChoices.map(({ format }) => format),
      version === "v1" ? ["no-watermark", "watermark", "music"] : ["no-watermark", "music"],
    );
    assert.equal(body.result.result.downloadChoices[0].url, `https://media.example/${version}-play.mp4`);
  }
});
