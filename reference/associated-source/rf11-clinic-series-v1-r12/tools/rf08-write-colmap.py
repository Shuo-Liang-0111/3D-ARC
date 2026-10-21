"""Convert Blender camera truth and EXR depths into COLMAP and gsplat inputs."""
import argparse, json, math, os
from pathlib import Path
import numpy as np
import cv2
import OpenEXR
import torch
from PIL import Image

def rotmat2qvec(R):
    K=np.array([[R[0,0]-R[1,1]-R[2,2],0,0,0],[R[1,0]+R[0,1],R[1,1]-R[0,0]-R[2,2],0,0],[R[2,0]+R[0,2],R[2,1]+R[1,2],R[2,2]-R[0,0]-R[1,1],0],[R[1,2]-R[2,1],R[2,0]-R[0,2],R[0,1]-R[1,0],R[0,0]+R[1,1]+R[2,2]]])/3.0
    vals,vecs=np.linalg.eigh(K); q=vecs[[3,0,1,2],np.argmax(vals)]; return -q if q[0]<0 else q

def read_depth(path):
    channels=OpenEXR.File(str(path)).channels()
    if "V" not in channels: raise RuntimeError(f"Missing V channel in {path}")
    return channels["V"].pixels

def main():
    p=argparse.ArgumentParser(); p.add_argument("--dataset",required=True); p.add_argument("--stride",type=int,default=12); a=p.parse_args(); root=Path(a.dataset)
    meta=json.loads((root/"transforms.json").read_text()); sparse=root/"sparse"/"0"; sparse.mkdir(parents=True,exist_ok=True)
    w,h=meta["w"],meta["h"]; f=.5*w/math.tan(.5*meta["camera_angle_x"])
    (sparse/"cameras.txt").write_text(f"1 PINHOLE {w} {h} {f:.12f} {f:.12f} {w/2:.6f} {h/2:.6f}\n")
    image_lines=[]; points=[]; gs_frames=[]; pid=1; convert=np.diag([1,-1,-1])
    for iid,frame in enumerate(meta["frames"],1):
        c2w=np.asarray(frame["transform_matrix"],dtype=np.float64); R=convert@c2w[:3,:3].T; t=-R@c2w[:3,3]; q=rotmat2qvec(R); name=Path(frame["file_path"]).name
        image_lines.append(f"{iid} {' '.join(f'{v:.12f}' for v in q)} {' '.join(f'{v:.12f}' for v in t)} 1 {name}\n\n")
        image=np.asarray(Image.open(root/"images"/name).convert("RGB"))
        K=np.array([[f,0,w/2],[0,f,h/2],[0,0,1]],dtype=np.float32)
        gs_frames.append({"camtoworld":c2w.astype(np.float32),"K":K,"image_h":h,"image_w":w,"image":image,"image_id":iid-1})
        if iid%4!=1: continue
        depth=read_depth(root/frame["depth_path"])
        color=image
        for v in range(a.stride//2,h,a.stride):
            for u in range(a.stride//2,w,a.stride):
                d=float(depth[v,u]);
                if not np.isfinite(d) or d<=.05 or d>12: continue
                camera=np.array([(u-w/2)*d/f,-(v-h/2)*d/f,-d,1.0]); world=c2w@camera; rgb=color[v,u]
                points.append((pid,*world[:3],*map(int,rgb))); pid+=1
    (sparse/"images.txt").write_text("".join(image_lines)); (sparse/"points3D.txt").write_text("\n".join(f"{p[0]} {p[1]} {p[2]} {p[3]} {p[4]} {p[5]} {p[6]} 0.0" for p in points)+"\n")
    ply=root/"sparse_points.ply"
    with ply.open("w") as fply:
        fply.write(f"ply\nformat ascii 1.0\nelement vertex {len(points)}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
        for p in points: fply.write(f"{p[1]} {p[2]} {p[3]} {p[4]} {p[5]} {p[6]}\n")
    xyz=np.asarray([[p[1],p[2],p[3]] for p in points],dtype=np.float32)
    rgb=np.asarray([[p[4],p[5],p[6]] for p in points],dtype=np.float32)/255.0
    torch.save({"train":[x for i,x in enumerate(gs_frames) if i%8!=0],"eval":[x for i,x in enumerate(gs_frames) if i%8==0],"points":xyz,"points_rgb":rgb},root/"gs_data.pt")
    print(json.dumps({"images":len(meta["frames"]),"points":len(points),"focal":f}))
if __name__=="__main__": main()
