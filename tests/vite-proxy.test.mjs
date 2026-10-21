import assert from "node:assert/strict";
import test from "node:test";
import createViteConfig from "../vite.config.js";

test("Vite test servers proxy HTTP and WebSocket requests to the managed production service", () => {
  const config = createViteConfig({ command: "serve", mode: "development" });

  assert.deepEqual(config.server.proxy["/api"], {
    target: "http://127.0.0.1:4176",
    ws: true,
  });
  assert.equal(config.publicDir, "public");
});
