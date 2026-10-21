// Published gameplay bundles keep their own HTML. The current entry owns the menu.
const menuPattern = /<nav\b(?=[^>]*\bclass=["'][^"']*\blevel-select\b)[^>]*>[\s\S]*?<\/nav>/i;
const scriptPattern = /<script\b[^>]*\bdata-arc-level-menu\b[^>]*>[\s\S]*?<\/script>\s*/gi;

export function getLevelMenu(html) {
  return html.match(menuPattern)?.[0] ?? null;
}

// Serialized into each entry so even archived bundles use the canonical router.
export function installLevelNavigation(document, window) {
  const menu = document.querySelector(".level-select");
  if (!menu) return;
  const shell = document.querySelector("#game-shell");
  const links = [...menu.querySelectorAll("[data-level-option]")];
  const selectedValue = (attribute) =>
    document.querySelector("[" + attribute + '][aria-pressed="true"]')?.getAttribute(attribute);

  function synchronizeLinks() {
    const current = new URL(window.location.href);
    const activeLevel = shell?.dataset.level || current.searchParams.get("level") || "rf01";
    const settings = {
      view: shell?.dataset.viewMode || selectedValue("data-view-option") || current.searchParams.get("view"),
      robot: selectedValue("data-robot-option") || current.searchParams.get("robot"),
      control: shell?.dataset.controlMode || selectedValue("data-control-option") || current.searchParams.get("control"),
    };
    for (const link of links) {
      const url = new URL("/", current);
      const agent = current.searchParams.get("mode") === "agent"
        || (current.searchParams.has("episode") && current.searchParams.has("browser_token"));
      url.searchParams.set("mode", agent ? "agent" : "play");
      url.searchParams.set("level", link.dataset.levelOption);
      for (const [name, value] of Object.entries(settings)) {
        if (value) url.searchParams.set(name, value);
      }
      if (link.href !== url.href) link.href = url.href;
      const selected = link.dataset.levelOption === activeLevel;
      link.classList.toggle("selected", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function navigate(event) {
    const link = event.target.closest?.("[data-level-option]");
    if (!link || !menu.contains(link)) return;
    synchronizeLinks();
    // Stop archived per-link handlers from routing through their old entry.
    event.stopImmediatePropagation();
    if (event.type !== "click" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.location.assign(link.href);
  }
  document.addEventListener("click", navigate, true);
  document.addEventListener("auxclick", navigate, true);
  menu.addEventListener("contextmenu", synchronizeLinks);
  // Old bundles rewrite hrefs after loading and after view/control changes.
  const observer = new window.MutationObserver(synchronizeLinks);
  observer.observe(menu, { subtree: true, attributes: true, attributeFilter: ["href"] });
  if (shell) observer.observe(shell, {
    attributes: true, attributeFilter: ["data-level", "data-view-mode", "data-control-mode"],
  });
  synchronizeLinks();
}

export function synchronizeLevelMenu(html, canonicalHtml) {
  if (!getLevelMenu(html)) return html;
  const menu = getLevelMenu(canonicalHtml);
  if (!menu) throw new Error("The canonical entry is missing its level menu");
  const synchronized = html.replace(menuPattern, () => menu).replace(scriptPattern, "");
  const script = '<script data-arc-level-menu>(' + installLevelNavigation.toString() + ')(document, window);</script>\n';
  return synchronized.replace(/<\/body>/i, () => script + "</body>");
}
