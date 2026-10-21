import { WebSocket } from "ws";

// An abandoned browser TCP connection must not hold a simulation slot forever.
export function bridgeMujoco(client, { upstreamUrl, heartbeatMs = 15000, handshakeTimeout = 8000 }) {
  const upstream = new WebSocket(upstreamUrl, { handshakeTimeout });
  const pending = [];
  let alive = true;
  let closed = false;
  const finish = () => {
    if (closed) return false;
    closed = true;
    clearInterval(heartbeat);
    pending.length = 0;
    return true;
  };
  const abort = () => {
    if (!finish()) return;
    client.terminate();
    upstream.terminate();
  };
  const heartbeat = setInterval(() => {
    if (!alive || client.readyState !== WebSocket.OPEN) return abort();
    alive = false;
    client.ping();
  }, heartbeatMs);
  heartbeat.unref();
  client.on("pong", () => { alive = true; });
  client.on("message", (message, isBinary) => {
    if (closed) return;
    if (upstream.readyState === WebSocket.OPEN) upstream.send(message, { binary: isBinary });
    else if (upstream.readyState === WebSocket.CONNECTING) {
      pending.push([message, isBinary]);
      if (pending.length > 8) pending.shift();
    }
  });
  upstream.on("open", () => {
    if (closed || client.readyState !== WebSocket.OPEN) return upstream.terminate();
    pending.splice(0).forEach(([message, isBinary]) => upstream.send(message, { binary: isBinary }));
  });
  upstream.on("message", (message, isBinary) => {
    if (!closed && client.readyState === WebSocket.OPEN) client.send(message, { binary: isBinary });
  });
  client.on("close", () => { if (finish()) upstream.terminate(); });
  upstream.on("close", (code, reason) => {
    if (!finish()) return;
    if (client.readyState === WebSocket.OPEN) client.close([1005, 1006, 1015].includes(code) ? 1011 : code, reason);
  });
  client.on("error", abort);
  upstream.on("error", abort);
  return upstream;
}
