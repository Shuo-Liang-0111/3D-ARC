import * as THREE from "three";
// Coordinates measured on the normalized 0.32 m wrench mesh.
export const WRENCH_GRIP=Object.freeze({x:.035,y:.020,z:0});
export const WRENCH_JAW=Object.freeze({x:-.123,y:.020,z:0});
// The shaft crosses the palm; its thickness follows the palm normal.
export const WRENCH_IN_HAND=new THREE.Quaternion().setFromRotationMatrix(
 new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,-1,0)));
export function wrenchToolRotation(handRotation){return handRotation.clone().multiply(WRENCH_IN_HAND);}
export function wrenchHandRotation(toolRotation){return toolRotation.clone().multiply(WRENCH_IN_HAND.clone().invert());}
export function placeWrenchAtGrip(root,handPosition,handRotation,mount=WRENCH_IN_HAND){
 root.quaternion.copy(handRotation).multiply(mount);
 root.position.copy(handPosition).sub(new THREE.Vector3(WRENCH_GRIP.x,WRENCH_GRIP.y,WRENCH_GRIP.z).applyQuaternion(root.quaternion));
}
export function wrenchJawPosition(root){return new THREE.Vector3(WRENCH_JAW.x,WRENCH_JAW.y,WRENCH_JAW.z).applyQuaternion(root.quaternion).add(root.position);}
export function wrenchValveHandPoint(valve,toolRotation){
 return valve.clone().sub(new THREE.Vector3(WRENCH_JAW.x-WRENCH_GRIP.x,WRENCH_JAW.y-WRENCH_GRIP.y,WRENCH_JAW.z-WRENCH_GRIP.z).applyQuaternion(toolRotation));
}
export function wrenchJawEffector(mount){
 return new THREE.Vector3(WRENCH_JAW.x-WRENCH_GRIP.x,WRENCH_JAW.y-WRENCH_GRIP.y,WRENCH_JAW.z-WRENCH_GRIP.z).applyQuaternion(mount).add(new THREE.Vector3(.14,.04,0));
}
