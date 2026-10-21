import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket, WebSocketServer } from "ws";
import { bridgeMujoco } from "../server/mujoco-bridge.mjs";

async function fixture(t, autoPong = true) {
  const simulation = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(simulation, "listening");
  const gateway = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(gateway, "listening");
  gateway.on("connection", client => bridgeMujoco(client, {
    upstreamUrl: `ws://127.0.0.1:${simulation.address().port}`, heartbeatMs: 40,
  }));
  const connected = once(simulation, "connection");
  const client = new WebSocket(`ws://127.0.0.1:${gateway.address().port}`, { autoPong });
  client.on("error", () => {});
  t.after(async () => {
    client.terminate();
    for (const server of [gateway, simulation]) {
      for (const peer of server.clients) peer.terminate();
      await new Promise(resolve => server.close(resolve));
    }
  });
  await once(client, "open");
  const [peer] = await connected;
  return { client, peer };
}

test("an unresponsive browser releases its simulation slot", { timeout: 3000 }, async t => {
  const { client, peer } = await fixture(t, false);
  await Promise.all([once(client, "close"), once(peer, "close")]);
  assert.equal(peer.readyState, WebSocket.CLOSED);
});

test("healthy idle clients survive heartbeat and relay commands and state", { timeout: 3000 }, async t => {
  const { client, peer } = await fixture(t);
  await delay(180);
  assert.equal(client.readyState, WebSocket.OPEN);
  const received = once(peer, "message");
  client.send("command");
  assert.equal((await received)[0].toString(), "command");
  const state = once(client, "message");
  peer.send("state");
  assert.equal((await state)[0].toString(), "state");
  const released = once(peer, "close");
  client.close();
  await released;
});

test("capacity rejection preserves its retryable close code", { timeout: 3000 }, async t => {
  const { client, peer } = await fixture(t);
  const closed = once(client, "close");
  peer.close(1013, "simulation capacity reached");
  const [code, reason] = await closed;
  assert.equal(code, 1013);
  assert.equal(reason.toString(), "simulation capacity reached");
});
