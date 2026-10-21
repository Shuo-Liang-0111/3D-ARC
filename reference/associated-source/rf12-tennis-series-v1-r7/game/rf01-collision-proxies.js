export const RF01_COLLISION_ASSET_URL = "/local-assets/cardinal/rf01/collision/rf01_static_collision.glb";

export const RF01_COLLISION_PROXIES = Object.freeze([
  { name: "COLLIDER_WORKSHOP_FRONT_LEFT", position: [-4.1625, 2.3, -1.28], size: [2.075, 4.6, 0.12] },
  { name: "COLLIDER_WORKSHOP_FRONT_DOOR", position: [-1, 2.3, -1.28], size: [4.25, 4.6, 0.12] },
  { name: "COLLIDER_WORKSHOP_FRONT_RIGHT", position: [3.1625, 2.3, -1.28], size: [4.075, 4.6, 0.12] },
  { name: "COLLIDER_WORKSHOP_BACK", position: [0, 2.3, -6.92], size: [10.04, 4.6, 0.16] },
  { name: "COLLIDER_WORKSHOP_WEST", position: [-5.01, 2.3, -4.1], size: [0.12, 4.6, 5.52] },
  { name: "COLLIDER_WORKSHOP_EAST", position: [5.01, 2.3, -4.1], size: [0.12, 4.6, 5.52] },
  { name: "COLLIDER_WORKSHOP_INTERIOR", position: [0, 2.2, -4.1], size: [9.9, 4.4, 5.4] },
  { name: "COLLIDER_FIRE_SAFETY_STATION", position: [8.8, 0.9, -0.9], size: [0.5, 1.8, 1.4] },
].map((proxy) => Object.freeze({
  ...proxy,
  position: Object.freeze(proxy.position),
  size: Object.freeze(proxy.size),
})));

export function collisionProxyId(name) {
  return name.toLowerCase().replace(/^collider_/, "").replaceAll("_", "-");
}

export const RF01_COLLISION_PROXY_RECTS = Object.freeze(RF01_COLLISION_PROXIES.map((proxy) => Object.freeze({
  id: collisionProxyId(proxy.name),
  minX: proxy.position[0] - proxy.size[0] / 2,
  maxX: proxy.position[0] + proxy.size[0] / 2,
  minZ: proxy.position[2] - proxy.size[2] / 2,
  maxZ: proxy.position[2] + proxy.size[2] / 2,
})));
