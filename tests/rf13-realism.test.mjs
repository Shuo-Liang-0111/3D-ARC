import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { REVISION, PREPARATIONS, STATIC_BOXES } from "../game/levels/rf13/level.js";
import { CLINIC_FURNISHINGS } from "../game/levels/rf13/furnishings.js";
import { readGlb, assetBounds, nodeBounds } from "../tools/rf13-asset-metrics.mjs";

const root = `public/local-assets/levels/rf13/${REVISION}/`;
test("clinical trolley matches the moving collision envelope and floor support", () => {
  const document = readGlb(root + "trolley.glb");
  const bounds = assetBounds(document);
  const size = bounds.getSize(new Vector3()).toArray();
  const target = PREPARATIONS.find(item => item.id === "trolley").size;
  assert.ok(Math.abs(bounds.min.y) < 0.005);
  size.forEach((value, axis) => assert.ok(Math.abs(value - target[axis]) < 0.025, `trolley axis ${axis}: ${value}`));
});
test("clinic shell includes genuine ceiling, door structure and fitted medical equipment", () => {
  const document = readGlb(root + "environment.glb");
  for (const name of ["cutaway-ceiling", "waiting-health-information-board", ...CLINIC_FURNISHINGS.map(item => item.id)]) {
    assert.ok(document.nodes.some(node => node.name === name), `missing ${name}`);
  }
  assert.ok(document.nodes.some(node => node.name.startsWith("clinical-basin-installed")));
  assert.equal(document.nodes.filter(node => node.name.startsWith("diagnostic-panel-installed") && node.mesh === undefined).length, 2);
  assert.ok(document.nodes.some(node => node.mesh !== undefined && node.extras?.cutawayCeiling === true));
  assert.ok(document.materials.some(material => material.normalTexture));
  assert.ok(document.materials.some(material => material.emissiveFactor?.some(value => value > 0)));
});
test("fitted equipment has useful dimensions instead of shrinking along a swapped axis", () => {
  const panel = assetBounds(readGlb(root + "diagnostic-panel-fitted.glb")).getSize(new Vector3());
  assert.ok(panel.x > 0.44 && panel.x < 0.48);
  assert.ok(panel.y > 0.38 && panel.y < 0.60);
  assert.ok(panel.z > 0.08 && panel.z < 0.18);
  const basin = assetBounds(readGlb(root + "clinical-basin-fitted.glb")).getSize(new Vector3());
  assert.ok(basin.x > 0.53 && basin.x < 0.57);
  assert.ok(basin.z > 0.43 && basin.z < 0.55);
  assert.ok(basin.y > 0.35 && basin.y < 0.60);
});

test("exported privacy curtains clear the beds and match their collision boxes", () => {
  const document = readGlb(root + "environment.glb");
  for (const curtain of CLINIC_FURNISHINGS.filter(item => item.id.startsWith("privacy-curtain-"))) {
    const index = document.nodes.findIndex(node => node.name === curtain.id);
    assert.ok(index >= 0, `missing ${curtain.id}`);
    const bounds = nodeBounds(document, index);
    const bed = STATIC_BOXES.find(item => item.id === curtain.id.replace("privacy-curtain", "exam-bed"));
    assert.ok(bounds.max.x < bed.position[0] - bed.size[0] / 2 - 0.05, "curtain must not pass through mattress");
    assert.ok(Math.abs(bounds.min.y - 0.40) < 0.03, "curtain hem remains above floor");
    for (const [axis, field] of ["x", "y", "z"].entries()) {
      assert.ok(bounds.min[field] >= curtain.position[axis] - curtain.size[axis] / 2 - 0.01);
      assert.ok(bounds.max[field] <= curtain.position[axis] + curtain.size[axis] / 2 + 0.01);
    }
  }
});
