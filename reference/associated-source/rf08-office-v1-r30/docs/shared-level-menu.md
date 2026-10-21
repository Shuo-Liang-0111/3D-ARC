# Shared level selection

The `.level-select` navigation in the root `index.html` is the source of truth
for the ordered level IDs and labels. Add new entries there together with their
runtime loaders in `game/app.js`.

The Vite `unified-level-menu` plugin applies this menu to source/build HTML and
direct public release HTML. The pinned gameplay responses in `vite.config.js`
also call its synchronizer. Published gameplay bundles and scene assets keep
their existing versions.

A small inline navigation handler routes every level selection through `/`.
This lets an old release open a newer level instead of asking its old runtime
loader to handle an unknown ID. It preserves the active view, robot, control
mode and play/agent mode, while discarding parameters tied to the previous
task. Ctrl/Command-click and middle-click retain normal browser behavior.

The handler also repairs links rewritten by an archived bundle after a view
change. The page highlights only the active level. No separate copied menu
needs to be maintained inside published releases.

Run `node --test tests/level-menu.test.mjs` for menu/runtime parity, archived
24/32/36-item menus, root routing, selection/preferences and release middleware
regressions. Run the production build after changes to the plugin.

For deployment verification, compare the ordered menu on every canonical
level URL with `index.html`, check the pinned release headers, and open a newly
added level from an old published page in the browser.
