import * as THREE from "three";

// img2threejs blockout factory adapted to the app's stable animation API.
// Proportions use Unitree's published 1320 x 450 x 200 mm envelope.
const C = Object.freeze({ silver: 0xb9bec3, silverHi: 0xd7dadd, graphite: 0x202327, black: 0x101215, glass: 0x07181d, cyan: 0x20e8f2, green: 0x38e55c });

function mat(color, metalness, roughness, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: extra.clearcoat ?? 0, clearcoatRoughness: extra.clearcoatRoughness ?? 0.25, emissive: extra.emissive ?? 0, emissiveIntensity: extra.emissiveIntensity ?? 0 });
}

function prep(mesh, name) { mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
function box(name, size, material, pos = [0, 0, 0]) { const m = prep(new THREE.Mesh(new THREE.BoxGeometry(...size), material), name); m.position.set(...pos); return m; }
function cyl(name, r, h, material, pos = [0, 0, 0], segments = 32) { const m = prep(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material), name); m.position.set(...pos); return m; }
function ellipsoid(name, radius, scale, material, pos = [0, 0, 0]) { const m = prep(new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), material), name); m.scale.set(...scale); m.position.set(...pos); return m; }
function capsule(name, radius, length, material, pos = [0, 0, 0]) { const m = prep(new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 10, 24), material), name); m.position.set(...pos); return m; }

function roundedExtrude(name, width, height, depth, radius, material, pos = [0, 0, 0]) {
  const s = new THREE.Shape(); const x = width / 2; const y = height / 2; const r = Math.min(radius, x, y);
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 4, bevelSize: r * 0.28, bevelThickness: r * 0.28, curveSegments: 12 }); g.center();
  const m = prep(new THREE.Mesh(g, material), name); m.position.set(...pos); return m;
}

function taperedShell(name, material) {
  const points = [[0.118,-0.16],[0.16,-0.115],[0.177,0.04],[0.16,0.155]].map(([x,y]) => new THREE.Vector2(x,y));
  const g = new THREE.LatheGeometry(points, 48); const m = prep(new THREE.Mesh(g, material), name); m.scale.z = 0.55; return m;
}

function taperedLink(name, length, topRadius, midRadius, bottomRadius, material, pos = [0, 0, 0]) {
  const points = [
    new THREE.Vector2(bottomRadius * .78, -length / 2),
    new THREE.Vector2(bottomRadius, -length * .42),
    new THREE.Vector2(midRadius, 0),
    new THREE.Vector2(topRadius, length * .42),
    new THREE.Vector2(topRadius * .82, length / 2),
  ];
  const mesh = prep(new THREE.Mesh(new THREE.LatheGeometry(points, 36), material), name);
  mesh.scale.z = .78;
  mesh.position.set(...pos);
  return mesh;
}

function part(parts, name, position = [0,0,0]) { const g = new THREE.Group(); g.name = name; g.userData.partId = name; g.position.set(...position); parts.push(g); return g; }

function sensorHead(materials, parts) {
  const head = part(parts, "sensor-head", [0, 1.205, 0]);
  head.add(cyl("neck-pedestal", .045, .09, materials.graphite, [0,-.12,-.01]));
  const shell = ellipsoid("rear-overhang-helmet-shell", .09, [1.03,.82,1.12], materials.graphite, [0,0,-.018]); shell.rotation.x = -.1; head.add(shell);
  const face = roundedExtrude("open-face-sensor-glazing", .15, .1, .016, .032, materials.glass, [0,-.014,.084]); head.add(face);
  const perimeter = new THREE.CurvePath();
  perimeter.add(new THREE.LineCurve3(new THREE.Vector3(-.061,.025,.104),new THREE.Vector3(.061,.025,.104)));
  perimeter.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(.061,.025,.104),new THREE.Vector3(.075,-.038,.104),new THREE.Vector3(.041,-.065,.104)));
  perimeter.add(new THREE.LineCurve3(new THREE.Vector3(.041,-.065,.104),new THREE.Vector3(-.041,-.065,.104)));
  perimeter.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.041,-.065,.104),new THREE.Vector3(-.075,-.038,.104),new THREE.Vector3(-.061,.025,.104)));
  head.add(prep(new THREE.Mesh(new THREE.TubeGeometry(perimeter, 64, .004, 8, false), materials.cyan), "cyan-u-perimeter"));
  head.add(roundedExtrude("single-horizontal-cyan-sensor-bar", .098, .011, .006, .004, materials.cyan, [0,.018,.108]));
  return head;
}

function dex3(side, materials, parts) {
  const prefix = side < 0 ? "left" : "right"; const hand = part(parts, `${prefix}-dex3-hand`);
  hand.add(cyl(`${prefix}-wrist-actuator`, .041, .07, materials.graphite, [0,-.015,0]));
  for (const y of [-.038,-.022,-.006]) { const ring = prep(new THREE.Mesh(new THREE.TorusGeometry(.043,.0035,8,28), materials.black), `${prefix}-wrist-groove`); ring.rotation.x=Math.PI/2; ring.position.y=y; hand.add(ring); }
  hand.add(ellipsoid(`${prefix}-dex3-palm`, .057, [.9,1.05,.48], materials.graphite, [0,-.09,0]));
  const digits=[];
  for (const [i,x] of [[0,-.025],[1,.025]]) { const root=new THREE.Group(); root.name=`${prefix}-finger-${i+1}`; root.position.set(x,-.13,0); hand.add(root); const joints=[]; let parent=root; for (let j=0;j<2;j+=1) { const joint=new THREE.Group(); joint.name=`${root.name}-joint-${j+1}`; if(j) joint.position.y=-.064; parent.add(joint); joint.add(capsule(`${joint.name}-pad`,.014,.04,materials.black,[0,-.03,0])); joints.push(joint); parent=joint; } digits.push({root,joints}); }
  const thumb=new THREE.Group(); thumb.name=`${prefix}-thumb`; thumb.position.set(side*.047,-.082,.006); thumb.rotation.z=side*.82; hand.add(thumb); const tj=[]; let tp=thumb; for(let j=0;j<2;j+=1){const q=new THREE.Group();if(j)q.position.y=-.052;tp.add(q);q.add(capsule(`${prefix}-thumb-segment-${j+1}`,.015,.032,materials.black,[0,-.026,0]));tj.push(q);tp=q;}
  hand.userData.digits=digits; hand.userData.thumb={root:thumb,joints:tj}; hand.userData.grip=0; return hand;
}

export function setUnitreeG1Edu2Grip(hand, amount) { const grip=THREE.MathUtils.clamp(amount,0,1); hand.userData.grip=grip; hand.userData.digits.forEach(({joints})=>{joints[0].rotation.x=-grip*.85;joints[1].rotation.x=-grip*1.05;}); const t=hand.userData.thumb;t.joints[0].rotation.x=-grip*.62;t.joints[1].rotation.x=-grip*.78; }

function arm(side, materials, parts) {
  const prefix=side<0?"left":"right"; const shoulder=part(parts,`${prefix}-shoulder`,[side*.225,.92,0]); shoulder.rotation.z=side*.07;
  const motor=cyl(`${prefix}-shoulder-disc`,.061,.055,materials.graphite); motor.rotation.z=Math.PI/2; shoulder.add(motor); const cap=cyl(`${prefix}-shoulder-silver-cap`,.047,.059,materials.silver);cap.rotation.z=Math.PI/2;shoulder.add(cap);
  const armour=ellipsoid(`${prefix}-shoulder-armour`,.071,[.72,1.05,.82],materials.silver,[0,.028,0]);armour.rotation.z=-side*.08;shoulder.add(armour);
  const upper=taperedLink(`${prefix}-s-profile-upper-arm`,.25,.049,.041,.045,materials.silver,[side*.012,-.17,0]); upper.rotation.z=side*.08; shoulder.add(upper);
  const elbow=part(parts,`${prefix}-elbow`,[0,-.30,0]); shoulder.add(elbow); const ed=cyl(`${prefix}-elbow-disc`,.052,.052,materials.graphite);ed.rotation.z=Math.PI/2;elbow.add(ed);
  const fore=taperedLink(`${prefix}-s-profile-forearm`,.23,.044,.037,.042,materials.silver,[-side*.01,-.16,0]);fore.rotation.z=-side*.065;elbow.add(fore);
  const wrist=new THREE.Group();wrist.name=`${prefix}-wrist`;wrist.position.y=-.285;elbow.add(wrist); const hand=dex3(side,materials,parts);wrist.add(hand);setUnitreeG1Edu2Grip(hand,.08);
  return {shoulder,elbow,wrist,hand,phase:side<0?0:Math.PI,baseZ:shoulder.rotation.z};
}

function leg(side, materials, parts) {
  const prefix=side<0?"left":"right"; const hip=part(parts,`${prefix}-hip`,[side*.105,.59,0]); const hd=cyl(`${prefix}-hip-drum`,.068,.075,materials.graphite);hd.rotation.z=Math.PI/2;hip.add(hd);
  hd.scale.set(.82,1,.82);
  const thigh=taperedLink(`${prefix}-continuous-thigh-shell`,.31,.07,.053,.044,materials.silver,[0,-.205,0]);thigh.rotation.z=-side*.045;hip.add(thigh);
  const knee=part(parts,`${prefix}-knee`,[0,-.36,0]);hip.add(knee);const kd=cyl(`${prefix}-lateral-knee-disc`,.052,.04,materials.black,[side*.032,0,0]);kd.rotation.z=Math.PI/2;knee.add(kd);
  const shin=taperedLink(`${prefix}-continuous-shin-shell`,.30,.044,.05,.034,materials.silver,[0,-.195,0]);shin.rotation.z=side*.025;knee.add(shin);
  const ankle=part(parts,`${prefix}-ankle`,[0,-.355,0]);knee.add(ankle); for(const x of [-.027,.027]){const link=box(`${prefix}-open-ankle-link`,[.018,.105,.025],materials.silver,[x,-.01,0]);link.rotation.z=side*.08;ankle.add(link);} ankle.add(cyl(`${prefix}-ankle-pin`,.024,.078,materials.graphite,[0,-.045,0]));
  const foot=roundedExtrude(`${prefix}-shoe-profile-foot`,.14,.07,.25,.028,materials.black,[0,-.105,.075]);foot.rotation.x=-Math.PI/2;ankle.add(foot);
  return {hip,knee,ankle,phase:side<0?0:Math.PI};
}

export function createUnitreeG1Edu2Model(options={}) {
  const root=new THREE.Group();root.name="unitree-g1-edu2-img2threejs";root.scale.setScalar(options.scale??1);const parts=[];
  const materials={silver:mat(C.silver,.72,.31,{clearcoat:.08}),silverHi:mat(C.silverHi,.65,.28),graphite:mat(C.graphite,.35,.46),black:mat(C.black,.05,.68),glass:mat(C.glass,.1,.18,{clearcoat:.75,clearcoatRoughness:.08}),cyan:mat(C.cyan,0,.22,{emissive:C.cyan,emissiveIntensity:2.25}),green:mat(C.green,0,.28,{emissive:C.green,emissiveIntensity:1.8})};
  const bodyRig=new THREE.Group();bodyRig.name="g1-edu2-body-rig";root.add(bodyRig);
  const pelvis=part(parts,"compact-pelvis",[0,.585,0]);pelvis.add(ellipsoid("pelvis-graphite-shell",.105,[1.04,.82,.78],materials.graphite));pelvis.add(roundedExtrude("pelvis-front-service-cover",.12,.085,.012,.018,materials.silver,[0,.006,.084]));bodyRig.add(pelvis);
  const waist=part(parts,"three-axis-waist",[0,.70,0]);waist.add(cyl("waist-lower-roll",.063,.045,materials.graphite,[0,-.048,0]));waist.add(cyl("waist-middle-pitch",.078,.045,materials.graphite));waist.add(cyl("waist-upper-yaw",.067,.045,materials.graphite,[0,.048,0]));bodyRig.add(waist);
  const torso=part(parts,"tapered-torso",[0,.92,0]);const torsoShell=taperedShell("single-tapered-silver-torso-shell",materials.silver);torsoShell.scale.x=.9;torsoShell.scale.z=.52;torso.add(torsoShell);const tri=new THREE.Shape();tri.moveTo(-.014,.01);tri.lineTo(.014,.01);tri.lineTo(0,-.014);tri.closePath();const tm=prep(new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:.004,bevelEnabled:false}),materials.graphite),"chest-downward-triangle");tm.position.set(0,.07,.101);torso.add(tm);const panel=roundedExtrude("right-battery-status-panel",.018,.13,.065,.008,materials.graphite,[.16,-.01,0]);panel.rotation.y=Math.PI/2;torso.add(panel);for(let i=0;i<4;i+=1)torso.add(ellipsoid(`battery-green-indicator-${i+1}`,.005,[1,1,.4],materials.green,[.17,.02-i*.016,.018]));bodyRig.add(torso);
  const head=sensorHead(materials,parts);bodyRig.add(head);const arms=[arm(-1,materials,parts),arm(1,materials,parts)];arms.forEach(x=>bodyRig.add(x.shoulder));const legs=[leg(-1,materials,parts),leg(1,materials,parts)];legs.forEach(x=>bodyRig.add(x.hip));
  const initial=new Map(parts.map(p=>[p,p.position.clone()]));const sculptRuntime={model:"Unitree G1 EDU2",basis:"img2threejs strict official-reference reconstruction",parts,sockets:{leftHand:arms[0].wrist,rightHand:arms[1].wrist,chest:torso,head},setExploded(amount=0){const spread=THREE.MathUtils.clamp(amount,0,1)*.22;for(const p of parts){const base=initial.get(p);const dir=new THREE.Vector3(base.x,base.y-.66,base.z);if(dir.lengthSq()<.001)dir.set(0,1,0);p.position.copy(base).addScaledVector(dir.normalize(),spread);}}};
  root.userData={sculptRuntime,bodyRig,pelvis,waist,torso,head,arms,legs,gaitPhase:0,materials};return root;
}

export function updateUnitreeG1Edu2Model(robot,delta,elapsed,motion="idle") { const d=robot.userData;const active=motion==="moving"||motion==="turning";if(active)d.gaitPhase+=delta*(motion==="turning"?4.2:6.2);const amp=active?(motion==="turning"?.13:.36):.008;d.legs.forEach(l=>{const w=Math.sin(d.gaitPhase+l.phase);l.hip.rotation.x=w*amp;l.knee.rotation.x=active?.06+Math.max(0,-w)*.48:.035;l.ankle.rotation.x=active?-w*.07:0;});d.arms.forEach(a=>{const w=Math.sin(d.gaitPhase+a.phase);a.shoulder.rotation.x=active?-w*amp*.62:Math.sin(elapsed*1.2+a.phase)*.008;a.shoulder.rotation.z=a.baseZ;a.elbow.rotation.x=active?.07+Math.max(0,w)*.14:.045;});d.bodyRig.position.y=Math.sin(elapsed*1.7)*.004+(active?Math.abs(Math.sin(d.gaitPhase*2))*.016:0);d.waist.rotation.y=motion==="turning"?Math.sin(d.gaitPhase)*.045:0;d.torso.rotation.y=-d.waist.rotation.y*.65;d.head.rotation.y=motion==="turning"?-d.torso.rotation.y*.7:Math.sin(elapsed*.55)*.012; }
