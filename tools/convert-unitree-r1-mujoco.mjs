#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const DEFAULT_RGBA = [0.79216, 0.81961, 0.93333, 1];
const SOURCE_REPOSITORY = "https://github.com/unitreerobotics/unitree_mujoco";
const SOURCE_REVISION = "4134cb5dc7ff1ba7f484deda48b5274b58694519";

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.({ target: this });
    }).catch((error) => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const mimeType = blob.type || "application/octet-stream";
      this.result = `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.({ target: this });
    }).catch((error) => this.onerror?.(error));
  }
}

globalThis.FileReader ??= NodeFileReader;

function parseArguments(argv) {
  const options = { source: "", out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source") options.source = argv[++index];
    else if (argument === "--out") options.out = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.source || !options.out) {
    throw new Error("Usage: node tools/convert-unitree-r1-mujoco.mjs --source <unitree_robots/r1> --out <asset.glb>");
  }
  return options;
}

function parseAttributes(tagSource) {
  const attributes = {};
  const attributePattern = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  for (const match of tagSource.matchAll(attributePattern)) attributes[match[1]] = match[2];
  return attributes;
}

function parseXml(xmlSource) {
  const documentNode = { tag: "#document", attributes: {}, children: [] };
  const stack = [documentNode];
  for (const match of xmlSource.matchAll(/<[^>]+>/g)) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!")) continue;
    if (token.startsWith("</")) {
      stack.pop();
      continue;
    }
    const selfClosing = token.endsWith("/>");
    const tagMatch = token.match(/^<\s*([^\s/>]+)/);
    if (!tagMatch) continue;
    const node = { tag: tagMatch[1], attributes: parseAttributes(token), children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return documentNode.children[0];
}

function child(node, tag) {
  return node.children.find((candidate) => candidate.tag === tag);
}

function children(node, tag) {
  return node.children.filter((candidate) => candidate.tag === tag);
}

function vector(source, fallback) {
  if (!source) return [...fallback];
  return source.trim().split(/\s+/).map(Number);
}

function transformFromAttributes(attributes) {
  const position = vector(attributes.pos, [0, 0, 0]);
  const quaternionWxyz = vector(attributes.quat, [1, 0, 0, 0]);
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion(quaternionWxyz[1], quaternionWxyz[2], quaternionWxyz[3], quaternionWxyz[0]),
    new THREE.Vector3(1, 1, 1),
  );
  return matrix;
}

function rgbaMaterial(materials, rgbaSource) {
  const rgba = vector(rgbaSource, DEFAULT_RGBA);
  const key = rgba.map((value) => value.toFixed(5)).join(":");
  if (!materials.has(key)) {
    const color = new THREE.Color(rgba[0], rgba[1], rgba[2]);
    const material = new THREE.MeshStandardMaterial({
      name: `mujoco-rgba-${key}`,
      color,
      opacity: rgba[3],
      transparent: rgba[3] < 1,
      metalness: 0.12,
      roughness: 0.52,
    });
    materials.set(key, material);
  }
  return materials.get(key);
}

function shouldIncludeGeom(bodyName, geom) {
  const attributes = geom.attributes;
  if (attributes.mesh) return attributes.group === "1" || attributes.contype === "0";
  return attributes.type === "box" && (bodyName === "torso_link" || bodyName.endsWith("_ankle_roll_link"));
}

function geometryName(bodyName, meshName, usedNames) {
  const preferred = bodyName === meshName ? `${meshName}__visual` : meshName;
  let candidate = preferred || `${bodyName}__primitive`;
  let suffix = 2;
  while (usedNames.has(candidate)) candidate = `${preferred}-${suffix++}`;
  usedNames.add(candidate);
  return candidate;
}

async function loadStlGeometry(stlLoader, filePath) {
  const file = await readFile(filePath);
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const geometry = stlLoader.parse(arrayBuffer);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

async function buildOfficialR1(sourceDirectory) {
  const xmlPath = path.join(sourceDirectory, "R1_C++.xml");
  const xmlRoot = parseXml(await readFile(xmlPath, "utf8"));
  const assetNode = child(xmlRoot, "asset");
  const worldBodyNode = child(xmlRoot, "worldbody");
  if (!assetNode || !worldBodyNode) throw new Error("R1 MuJoCo XML is missing asset or worldbody");

  const meshFiles = new Map(
    children(assetNode, "mesh").map((mesh) => [mesh.attributes.name, mesh.attributes.file]),
  );
  const stlLoader = new STLLoader();
  const geometryCache = new Map();
  const materials = new Map();
  const usedNames = new Set();
  const modelRoot = new THREE.Group();
  modelRoot.name = "unitree-r1-official-mujoco";
  modelRoot.rotation.x = -Math.PI / 2;

  let bodyCount = 0;
  let meshCount = 0;
  let primitiveCount = 0;

  async function addBody(bodyNode, parent) {
    const bodyName = bodyNode.attributes.name || `anonymous-body-${bodyCount + 1}`;
    const bodyPosition = vector(bodyNode.attributes.pos, [0, 0, 0]);
    if (Math.max(...bodyPosition.map(Math.abs)) > 5) return;

    const body = new THREE.Group();
    body.name = bodyName;
    transformFromAttributes(bodyNode.attributes).decompose(body.position, body.quaternion, body.scale);
    parent.add(body);
    usedNames.add(bodyName);
    bodyCount += 1;

    for (const geom of children(bodyNode, "geom")) {
      if (!shouldIncludeGeom(bodyName, geom)) continue;
      const meshName = geom.attributes.mesh;
      let geometry;
      if (meshName) {
        const meshFile = meshFiles.get(meshName);
        if (!meshFile) throw new Error(`Missing mesh asset declaration for ${meshName}`);
        if (!geometryCache.has(meshName)) {
          geometryCache.set(meshName, await loadStlGeometry(stlLoader, path.join(sourceDirectory, "meshes", meshFile)));
        }
        geometry = geometryCache.get(meshName);
        meshCount += 1;
      } else {
        const halfExtents = vector(geom.attributes.size, [0.05, 0.05, 0.05]);
        geometry = new THREE.BoxGeometry(halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2);
        primitiveCount += 1;
      }

      const visualName = geometryName(bodyName, meshName, usedNames);
      const visual = new THREE.Mesh(geometry, rgbaMaterial(materials, geom.attributes.rgba));
      visual.name = visualName;
      transformFromAttributes(geom.attributes).decompose(visual.position, visual.quaternion, visual.scale);
      visual.userData.source = {
        format: "MuJoCo",
        mesh: meshName || "box",
        repository: SOURCE_REPOSITORY,
        revision: SOURCE_REVISION,
      };
      body.add(visual);
    }

    for (const nestedBody of children(bodyNode, "body")) await addBody(nestedBody, body);
  }

  for (const bodyNode of children(worldBodyNode, "body")) await addBody(bodyNode, modelRoot);
  modelRoot.userData.officialAsset = {
    manufacturer: "Unitree",
    model: "R1",
    configuration: "official-unitree_mujoco-R1",
    sourceFormat: "MuJoCo XML + STL",
    sourceRepository: SOURCE_REPOSITORY,
    sourceRevision: SOURCE_REVISION,
    license: "BSD-3-Clause",
  };
  modelRoot.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(modelRoot);
  const size = bounds.getSize(new THREE.Vector3());
  const triangles = [];
  modelRoot.traverse((object) => {
    if (object.isMesh) triangles.push(object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3);
  });
  return {
    modelRoot,
    summary: {
      bodyCount,
      meshCount,
      primitiveCount,
      triangles: Math.round(triangles.reduce((sum, count) => sum + count, 0)),
      dimensionsMeters: size.toArray().map((value) => Number(value.toFixed(6))),
    },
  };
}

async function exportGlb(modelRoot, outputPath) {
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(modelRoot, {
    binary: true,
    trs: true,
    onlyVisible: true,
  });
  await writeFile(outputPath, Buffer.from(binary));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceDirectory = path.resolve(options.source);
  const outputPath = path.resolve(options.out);
  const { modelRoot, summary } = await buildOfficialR1(sourceDirectory);
  await exportGlb(modelRoot, outputPath);
  const outputBytes = (await readFile(outputPath)).byteLength;
  process.stdout.write(`${JSON.stringify({ outputPath, outputBytes, ...summary }, null, 2)}\n`);
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main().catch((error) => {
  console.error(error);
});
  process.exitCode = 1;
