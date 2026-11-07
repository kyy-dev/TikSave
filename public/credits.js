const themeToggle = document.querySelector("#theme-toggle");

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.querySelector(".theme-label").textContent = dark ? "Mode terang" : "Mode gelap";
  try {
    localStorage.setItem("tiksave-theme", dark ? "dark" : "light");
  } catch {}
}

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("tiksave-theme") || "light";
} catch {}
setTheme(savedTheme === "dark");

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme !== "dark");
});
