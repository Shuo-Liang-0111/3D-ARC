const root = document.documentElement;
const languageButtons = [...document.querySelectorAll("[data-language-button]")];
const translatedNodes = [...document.querySelectorAll("[data-zh][data-en]")];
const copyStatus = document.querySelector("#copy-status");
const liveFrame = document.querySelector("#agent-game-frame");
const liveLevelOptions = [...document.querySelectorAll("[data-agent-level]")];
const validLevels = new Set(["rf01", "rf02", "rf03", "rf04", "rf05", "rf06", "rf07", "rf08", "rf09", "rf10", "test_zpf", "test_zpf2"]);
const requestedLiveLevel = new URLSearchParams(window.location.search).get("level");
const liveLevel = validLevels.has(requestedLiveLevel) ? requestedLiveLevel : "rf01";

function resolveLanguage() {
  const query = new URLSearchParams(window.location.search).get("lang");
  if (["zh", "en"].includes(query)) return query;
  try {
    const stored = window.localStorage.getItem("arc-guide-language");
    if (["zh", "en"].includes(stored)) return stored;
  } catch {}
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function setLanguage(language) {
  root.dataset.language = language;
  root.lang = language === "zh" ? "zh-CN" : "en";
  translatedNodes.forEach((node) => { node.textContent = node.dataset[language]; });
  languageButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.languageButton === language)));
  document.title = language === "zh" ? "ARC Agent 接入指南" : "ARC Agent Integration Guide";
  try { window.localStorage.setItem("arc-guide-language", language); } catch {}
}

function publicSiteOrigin() {
  return ["http:", "https:"].includes(window.location.protocol) ? window.location.origin : "https://your-arc-site.example";
}

document.querySelectorAll("[data-site-origin]").forEach((node) => { node.textContent = publicSiteOrigin(); });
if (liveFrame) liveFrame.src = `/?mode=agent&level=${liveLevel}&view=third`;
liveLevelOptions.forEach((option) => option.classList.toggle("selected", option.dataset.agentLevel === liveLevel));
languageButtons.forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.languageButton)));

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.querySelector(`#${CSS.escape(button.dataset.copyTarget)}`);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.innerText);
      copyStatus.textContent = root.dataset.language === "zh" ? "已复制到剪贴板" : "Copied to clipboard";
      copyStatus.classList.add("visible");
      window.setTimeout(() => copyStatus.classList.remove("visible"), 1600);
    } catch {
      copyStatus.textContent = root.dataset.language === "zh" ? "复制失败，请手动选择" : "Copy failed; select the text manually";
      copyStatus.classList.add("visible");
    }
  });
});

setLanguage(resolveLanguage());
