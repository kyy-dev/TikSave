const form = document.querySelector("#tool-form");
const actionSelect = document.querySelector("#action");
const fieldsContainer = document.querySelector("#dynamic-fields");
const description = document.querySelector("#tool-description");
const resultContent = document.querySelector("#result-content");
const submitButton = document.querySelector("#submit-button");
const copyButton = document.querySelector("#copy-button");
const clearButton = document.querySelector("#clear-button");
const themeToggle = document.querySelector("#theme-toggle");
const comingSoonNote = document.querySelector("#coming-soon-note");
const downloadSettings = document.querySelector("#download-settings");
let latestResult = null;

const fieldsByAction = {
  download: {
    description: "Masukkan tautan TikTok. Pilihan tanpa watermark, dengan watermark, dan lagu akan muncul jika tersedia.",
    fields: [
      { name: "url", label: "URL video TikTok", type: "url", required: true, placeholder: "https://www.tiktok.com/@akun/video/..." },
    ],
  },
  search: {
    description: "Cari pengguna, siaran langsung, atau video. Cookie TikTok diperlukan oleh pustaka.",
    fields: [
      { name: "keyword", label: "Kata kunci", type: "text", required: true, placeholder: "Nama akun atau topik" },
      { name: "type", label: "Jenis pencarian", type: "select", value: "user", options: [["user", "Pengguna"], ["live", "Live"], ["video", "Video"]] },
      { name: "page", label: "Halaman", type: "number", value: "1", min: "1", max: "10000" },
      { name: "cookie", label: "Cookie TikTok", type: "password", required: true, autocomplete: "off", help: "Dikirim hanya untuk permintaan ini." },
    ],
  },
  stalk: {
    description: "Tampilkan informasi profil publik dari nama akun.",
    fields: [{ name: "username", label: "Username", type: "text", required: true, placeholder: "@namaakun" }],
  },
  comments: {
    description: "Ambil komentar dari video TikTok.",
    fields: [
      { name: "url", label: "URL video TikTok", type: "url", required: true, placeholder: "https://www.tiktok.com/@akun/video/..." },
      { name: "limit", label: "Batas komentar", type: "number", value: "20", min: "1", max: "100" },
    ],
  },
  posts: {
    description: "Ambil postingan terbaru dari nama akun.",
    fields: [
      { name: "username", label: "Username", type: "text", required: true, placeholder: "@namaakun" },
      { name: "limit", label: "Batas postingan", type: "number", value: "30", min: "1", max: "100" },
    ],
  },
  reposts: {
    description: "Ambil repost dari nama akun.",
    fields: [
      { name: "username", label: "Username", type: "text", required: true, placeholder: "@namaakun" },
      { name: "limit", label: "Batas repost", type: "number", value: "30", min: "1", max: "100" },
      { name: "filterDeletedPost", label: "Saring postingan yang sudah dihapus", type: "checkbox" },
    ],
  },
  liked: {
    description: "Tampilkan video yang disukai akun. Cookie TikTok diperlukan dan akses bergantung pada pengaturan privasi akun.",
    fields: [
      { name: "username", label: "Username", type: "text", required: true, placeholder: "@namaakun" },
      { name: "limit", label: "Batas video", type: "number", value: "30", min: "1", max: "100" },
      { name: "cookie", label: "Cookie TikTok", type: "password", required: true, autocomplete: "off", help: "Dikirim hanya untuk permintaan ini." },
    ],
  },
  collection: {
    description: "Ambil video dari ID atau tautan koleksi TikTok.",
    fields: [
      { name: "idOrUrl", label: "ID atau URL koleksi", type: "text", required: true, placeholder: "ID koleksi atau URL TikTok" },
      { name: "page", label: "Halaman", type: "number", value: "1", min: "1", max: "10000" },
      { name: "count", label: "Jumlah video", type: "number", value: "5", min: "1", max: "100" },
    ],
  },
  playlist: {
    description: "Ambil video dari ID atau tautan playlist TikTok.",
    fields: [
      { name: "idOrUrl", label: "ID atau URL playlist", type: "text", required: true, placeholder: "ID playlist atau URL TikTok" },
      { name: "page", label: "Halaman", type: "number", value: "1", min: "1", max: "10000" },
      { name: "count", label: "Jumlah video", type: "number", value: "5", min: "1", max: "100" },
    ],
  },
  trending: {
    description: "Ambil konten yang sedang ditampilkan sebagai trending oleh TikTok.",
    fields: [],
  },
  "trending-creators": {
    description: "Ambil daftar kreator trending dari TikTok.",
    fields: [],
  },
  "music-videos": {
    description: "Cari video yang menggunakan ID atau tautan musik tertentu.",
    fields: [
      { name: "idOrUrl", label: "ID atau URL musik", type: "text", required: true, placeholder: "ID musik atau URL TikTok" },
      { name: "page", label: "Halaman", type: "number", value: "1", min: "1", max: "10000" },
      { name: "count", label: "Jumlah video", type: "number", value: "30", min: "1", max: "100" },
    ],
  },
  "music-detail": {
    description: "Tampilkan detail audio dari ID atau tautan musik. Cookie TikTok diperlukan.",
    fields: [
      { name: "idOrUrl", label: "ID atau URL musik", type: "text", required: true, placeholder: "ID musik atau URL TikTok" },
      { name: "cookie", label: "Cookie TikTok", type: "password", required: true, autocomplete: "off", help: "Dikirim hanya untuk permintaan ini." },
    ],
  },
};

function createField(field) {
  const wrapper = document.createElement("div");
  wrapper.className = field.type === "checkbox" ? "checkbox-field" : "field-wrap";

  if (field.type === "checkbox") {
    const label = document.createElement("label");
    label.className = "checkbox-label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = field.name;
    input.id = `field-${field.name}`;
    label.append(input, document.createTextNode(field.label));
    wrapper.append(label);
    return wrapper;
  }

  const label = document.createElement("label");
  label.className = "field-label";
  label.htmlFor = `field-${field.name}`;
  label.textContent = field.label;

  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    for (const [value, text] of field.options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
  } else {
    input = document.createElement("input");
    input.type = field.type;
  }

  input.id = `field-${field.name}`;
  input.name = field.name;
  input.required = Boolean(field.required);
  if (field.value !== undefined) input.value = field.value;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.autocomplete) input.autocomplete = field.autocomplete;
  if (field.min) input.min = field.min;
  if (field.max) input.max = field.max;

  wrapper.append(label, input);
  if (field.help) {
    const help = document.createElement("span");
    help.className = "field-help";
    help.textContent = field.help;
    wrapper.append(help);
  }
  return wrapper;
}

function renderFields() {
  const config = fieldsByAction[actionSelect.value];
  fieldsContainer.replaceChildren(...config.fields.map(createField));
  description.textContent = config.description;
  comingSoonNote.hidden = actionSelect.value === "download";
  downloadSettings.hidden = actionSelect.value !== "download";
}

function setResultState(kind, title, detail) {
  resultContent.replaceChildren();
  resultContent.setAttribute("aria-busy", kind === "loading" ? "true" : "false");
  const state = document.createElement("div");
  state.className = `${kind}-state`;
  const heading = document.createElement("p");
  heading.textContent = title;
  const message = document.createElement("span");
  message.textContent = detail;
  state.append(heading, message);
  resultContent.append(state);
}

function collectLinks(value, path = "", links = [], depth = 0) {
  if (depth > 8 || links.length >= 100 || value === null || value === undefined) return links;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "http:") {
          links.push({ url: value, path: path || "Tautan" });
        }
      } catch {}
    }
    return links;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLinks(item, `${path}[${index + 1}]`, links, depth + 1));
  } else if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      collectLinks(item, path ? `${path}.${key}` : key, links, depth + 1),
    );
  }
  return links;
}

function readablePath(path) {
  return path
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .slice(-3)
    .join(" / ");
}

function renderSuccess(result) {
  latestResult = result;
  copyButton.disabled = false;
  resultContent.replaceChildren();
  resultContent.setAttribute("aria-busy", "false");

  const downloadChoices = result?.result?.downloadChoices;
  if (Array.isArray(downloadChoices)) {
    const section = document.createElement("section");
    section.className = "download-choices";
    const heading = document.createElement("h3");
    heading.textContent = "Pilihan download";
    section.append(heading);

    if (downloadChoices.length) {
      const list = document.createElement("ul");
      downloadChoices.forEach((choice, index) => {
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = choice.label;
        const link = document.createElement("a");
        link.className = "download-link";
        link.href = choice.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const extension = choice.format === "music" ? "mp3" : choice.format === "image" ? "jpg" : "mp4";
        link.download = `tiksave-${choice.format}-${index + 1}.${extension}`;
        link.setAttribute("aria-label", `Unduh ${choice.label}`);
        link.textContent = "Unduh";
        row.append(label, link);
        list.append(row);
      });
      section.append(list);
    }

    const comingSoon = result.result.comingSoon;
    if (Array.isArray(comingSoon) && comingSoon.length) {
      const notice = document.createElement("p");
      notice.className = "coming-soon-result";
      notice.textContent = `Coming soon untuk tautan ini: ${comingSoon.join(", ")}.`;
      section.append(notice);
    } else if (!downloadChoices.length) {
      const note = document.createElement("p");
      note.className = "result-note";
      note.textContent = "Belum ada tautan media yang bisa diunduh dari hasil ini.";
      section.append(note);
    }
    resultContent.append(section);
  } else {
    const links = collectLinks(result);
    if (links.length) {
      const linksSection = document.createElement("div");
      linksSection.className = "media-links";
      const heading = document.createElement("h3");
      heading.textContent = "Tautan dari hasil";
      const list = document.createElement("ul");
      links.forEach((item, index) => {
        const listItem = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = readablePath(item.path) || `Tautan ${index + 1}`;
        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Buka";
        listItem.append(label, link);
        list.append(listItem);
      });
      linksSection.append(heading, list);
      resultContent.append(linksSection);
    } else {
      const note = document.createElement("p");
      note.className = "result-note";
      note.textContent = "Respons tidak berisi tautan media yang bisa dibuka. Periksa data JSON untuk detailnya.";
      resultContent.append(note);
    }
  }

  const details = document.createElement("details");
  details.className = "json-details";
  const summary = document.createElement("summary");
  summary.textContent = "Lihat data JSON";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(result, null, 2);
  details.append(summary, pre);
  resultContent.append(details);
}

function formValues() {
  const values = {};
  new FormData(form).forEach((value, key) => {
    const input = form.elements.namedItem(key);
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      values[key] = input.checked;
    } else {
      values[key] = String(value);
    }
  });
  values.version = document.querySelector("#download-version").value;
  values.showOriginalResponse = document.querySelector("#original-response").checked;
  return values;
}

async function runTool(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;

  latestResult = null;
  copyButton.disabled = true;
  submitButton.disabled = true;
  setResultState("loading", "Memproses permintaan...", "TikSave sedang meminta data dari TikTok.");

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: actionSelect.value, values: formValues() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    renderSuccess(data.result);
  } catch (error) {
    setResultState("error", "Permintaan tidak berhasil.", error.message || "Periksa koneksi lalu coba lagi.");
  } finally {
    submitButton.disabled = false;
  }
}

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.querySelector(".theme-label").textContent = dark ? "Mode terang" : "Mode gelap";
  try {
    localStorage.setItem("tiksave-theme", dark ? "dark" : "light");
  } catch {}
}

function restoreTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("tiksave-theme") || "light";
  } catch {}
  setTheme(savedTheme === "dark");
}

actionSelect.addEventListener("change", renderFields);
form.addEventListener("submit", runTool);
clearButton.addEventListener("click", () => {
  form.reset();
  actionSelect.value = "download";
  renderFields();
  latestResult = null;
  copyButton.disabled = true;
  setResultState("empty", "Hasil belum ada.", "Pilih fitur dan jalankan permintaan untuk mulai.");
});
copyButton.addEventListener("click", async () => {
  if (!latestResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    copyButton.textContent = "Tersalin";
    window.setTimeout(() => {
      copyButton.textContent = "Salin JSON";
    }, 1600);
  } catch {
    copyButton.textContent = "Gagal menyalin";
    window.setTimeout(() => {
      copyButton.textContent = "Salin JSON";
    }, 1600);
  }
});
themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme !== "dark");
});

restoreTheme();
renderFields();
