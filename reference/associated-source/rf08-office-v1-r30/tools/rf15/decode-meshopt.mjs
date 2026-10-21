import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptDecoder } from '../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

const [inputPath, outputPath] = process.argv.slice(2);
const input = readFileSync(inputPath);
const jsonLength = input.readUInt32LE(12);
const document = JSON.parse(input.toString('utf8', 20, 20 + jsonLength));
const binary = input.subarray(28 + jsonLength);
await MeshoptDecoder.ready;
const chunks = [];
let byteOffset = 0;
for (const view of document.bufferViews) {
  const extension = view.extensions?.EXT_meshopt_compression;
  let payload;
  if (extension) {
    const compressed = binary.subarray(extension.byteOffset, extension.byteOffset + extension.byteLength);
    payload = Buffer.from(await MeshoptDecoder.decodeGltfBufferAsync(extension.count, extension.byteStride, compressed, extension.mode, extension.filter));
    delete view.extensions.EXT_meshopt_compression;
    if (!Object.keys(view.extensions).length) delete view.extensions;
  } else {
    if (view.buffer !== 0) throw new Error('Unexpected external buffer');
    payload = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  }
  view.buffer = 0;
  view.byteOffset = byteOffset;
  view.byteLength = payload.length;
  const padding = Buffer.alloc((4 - payload.length % 4) % 4);
  chunks.push(payload, padding);
  byteOffset += payload.length + padding.length;
}
document.buffers = [{ byteLength: byteOffset }];
for (const key of ['extensionsRequired', 'extensionsUsed']) document[key] = (document[key] || []).filter(name => name !== 'EXT_meshopt_compression');
const json = Buffer.from(JSON.stringify(document));
const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJson.length + byteOffset, 8);
header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(byteOffset); binaryHeader.writeUInt32LE(0x004e4942, 4);
writeFileSync(outputPath, Buffer.concat([header, paddedJson, binaryHeader, ...chunks]));
