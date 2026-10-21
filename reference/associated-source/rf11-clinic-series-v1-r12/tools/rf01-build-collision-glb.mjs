import fs from "node:fs";
import path from "node:path";
import { RF01_COLLISION_PROXIES } from "../game/rf01-collision-proxies.js";

const outputPath = process.argv[2] ?? "public/local-assets/cardinal/rf01/collision/rf01_static_collision.glb";
const positions = new Float32Array([
  -0.5, -0.5, -0.5,
  0.5, -0.5, -0.5,
  0.5, 0.5, -0.5,
  -0.5, 0.5, -0.5,
  -0.5, -0.5, 0.5,
  0.5, -0.5, 0.5,
  0.5, 0.5, 0.5,
  -0.5, 0.5, 0.5,
]);
const indices = new Uint16Array([
  0, 2, 1, 0, 3, 2,
  4, 5, 6, 4, 6, 7,
  0, 1, 5, 0, 5, 4,
  3, 7, 6, 3, 6, 2,
  0, 4, 7, 0, 7, 3,
  1, 2, 6, 1, 6, 5,
]);

const positionBytes = Buffer.from(positions.buffer);
const indexBytes = Buffer.from(indices.buffer);
const binaryLength = positionBytes.length + indexBytes.length;
const binary = Buffer.alloc((binaryLength + 3) & ~3);
positionBytes.copy(binary, 0);
indexBytes.copy(binary, positionBytes.length);

const document = {
  asset: { version: "2.0", generator: "RF-01 collision proxy builder" },
  scene: 0,
  scenes: [{ name: "RF01_STATIC_COLLISION", nodes: RF01_COLLISION_PROXIES.map((_, index) => index) }],
  nodes: RF01_COLLISION_PROXIES.map((proxy) => ({
    name: proxy.name,
    mesh: 0,
    translation: proxy.position,
    scale: proxy.size,
    extras: { collision: true, shape: "box" },
  })),
  meshes: [{
    name: "COLLIDER_UNIT_BOX",
    primitives: [{
      attributes: { POSITION: 0 },
      indices: 1,
      mode: 4,
    }],
  }],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 8,
      type: "VEC3",
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    {
      bufferView: 1,
      componentType: 5123,
      count: indices.length,
      type: "SCALAR",
      min: [0],
      max: [7],
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
    { buffer: 0, byteOffset: positionBytes.length, byteLength: indexBytes.length, target: 34963 },
  ],
  buffers: [{ byteLength: binary.length }],
};

const jsonSource = Buffer.from(JSON.stringify(document));
const jsonLength = (jsonSource.length + 3) & ~3;
const json = Buffer.alloc(jsonLength, 0x20);
jsonSource.copy(json);
const glb = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
glb.write("glTF", 0);
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(json.length, 12);
glb.write("JSON", 16);
json.copy(glb, 20);
const binaryHeader = 20 + json.length;
glb.writeUInt32LE(binary.length, binaryHeader);
glb.write("BIN\0", binaryHeader + 4);
binary.copy(glb, binaryHeader + 8);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, glb);
console.log(`Wrote ${RF01_COLLISION_PROXIES.length} collision proxies to ${outputPath} (${glb.length} bytes)`);
