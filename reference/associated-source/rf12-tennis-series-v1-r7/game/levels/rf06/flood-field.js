import {LEVEL,HOME} from "./home-layout.js";
export const STEP=.10,NX=107,NZ=79,MINX=-5.3,MINZ=-3.9;
const blocking=LEVEL.staticColliders.filter(r=>!/dining|coffee|bench|pesticide-shelf|wrench-shelf|tool-rack/.test(r.id));
export function waterFloor(x,z){return x>-5.28&&x<5.28&&z>-3.88&&z<3.88&&!blocking.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ);}
const distance=new Float32Array(NX*NZ).fill(1e4),heap=[];
function push(v){heap.push(v);let i=heap.length-1;while(i){let p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p;}heap[i]=v;}
function pop(){const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let k=i*2+1;if(k+1<heap.length&&heap[k+1][0]<heap[k][0])k++;if(heap[k][0]>=v[0])break;heap[i]=heap[k];i=k;}heap[i]=v;}return top;}
const index=(x,z)=>Math.round((z-MINZ)/STEP)*NX+Math.round((x-MINX)/STEP);
const source=index(HOME.overflow.x,2.98);distance[source]=0;push([0,source]);
while(heap.length){
 const [d,i]=pop();if(d>distance[i]+1e-5)continue;
 const x=i%NX,z=Math.floor(i/NX);
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const xx=x+dx,zz=z+dz;if(xx<0||xx>=NX||zz<0||zz>=NZ)continue;
  const wx=MINX+xx*STEP,wz=MINZ+zz*STEP;if(!waterFloor(wx,wz))continue;
  if(dx&&dz&&(!waterFloor(MINX+x*STEP,wz)||!waterFloor(wx,MINZ+z*STEP)))continue;
  const j=zz*NX+xx,nd=d+STEP*Math.hypot(dx,dz);
  if(nd<distance[j]-1e-5){distance[j]=nd;push([nd,j]);}
 }
}
const ordered=Array.from(distance).filter(d=>d<9999).sort((a,b)=>a-b);
export const FLOOD={distance,NX,NZ,STEP,MINX,MINZ};
export function floodReach(litres){return litres<=.001?-1:ordered[Math.min(ordered.length-1,Math.floor(litres*.55/(STEP*STEP)))];}
export function floorDistance(x,z){return distance[index(x,z)]??1e4;}
export function isWet(x,z,litres){return waterFloor(x,z)&&floorDistance(x,z)<=floodReach(litres);}
