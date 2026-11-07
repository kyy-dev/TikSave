const baseUrl = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000";

async function check(label, pathname, options, expectedText) {
  const response = await fetch(new URL(pathname, baseUrl), options);
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`${label}: HTTP ${response.status}`);
  }
  if (expectedText && !text.includes(expectedText)) {
    throw new Error(`${label}: respons tidak sesuai.`);
  }
  console.log(`${label}: berjalan normal (HTTP ${response.status})`);
}

async function main() {
  await check("Website", "/", undefined, "TikSave");
  await check("API lokal GET", "/api/health", { method: "GET" });
  await check("API lokal POST", "/api/health", { method: "POST" });
}

main().catch((error) => {
  console.error(`Pemeriksaan gagal: ${error.message}`);
  process.exitCode = 1;
});