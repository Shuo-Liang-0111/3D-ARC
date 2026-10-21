"""Prepare Cardinal albedo, micro-normal and roughness for RF-02 surfaces."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

root = Path(sys.argv[1])
out = root / "textures"
out.mkdir(exist_ok=True)
size = 1024


def tileable(image):
    # Reflect the generated crop across both axes: exact shared edges, no seams.
    crop = np.asarray(image.resize((size // 2, size // 2)), dtype=float)
    top = np.concatenate([crop, crop[:, ::-1]], axis=1)
    return np.concatenate([top, top[::-1]], axis=0)


for name, base, meters, height_scale in [
    ("wall", [225, 220, 209], 1.2, 0.00022),
    ("ceiling", [231, 230, 221], 0.6, 0.00032),
]:
    source = Image.open(root / "sources" / (name + ".png")).convert("RGB")
    pixels = tileable(source)
    grey = pixels.mean(axis=2)
    detail = (grey - grey.mean()) / max(1, grey.std())
    color = np.array(base)[None, None, :] + detail[:, :, None] * (4.2 if name == "wall" else 7.5)
    height = np.clip(detail, -3, 3) * height_scale
    rough = np.clip((0.88 if name == "wall" else 0.94) - detail * 0.018, 0.72, 1)
    if name == "ceiling":
        axis = np.minimum(np.arange(size), size - 1 - np.arange(size))
        edge = np.minimum(axis[:, None], axis[None, :])
        rail = edge < 9  # 10.5 mm white T-grid per 600 mm module.
        seam = (edge >= 9) & (edge < 13)
        bevel = (edge >= 13) & (edge < 18)
        color[rail] = [233, 233, 226]
        color[seam] = [166, 168, 161]
        color[bevel] *= 0.94
        height[rail] = 0.0006
        height[seam] = -0.0005
        rough[rail] = 0.66
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * size / (2 * meters)
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * size / (2 * meters)
    normals = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    Image.fromarray(np.uint8(np.clip(color, 0, 255))).save(out / (name + "-albedo.png"), optimize=True)
    Image.fromarray(np.uint8(np.clip((normals + 1) * 127.5, 0, 255))).save(out / (name + "-normal.png"), optimize=True)
    Image.fromarray(np.uint8(rough * 255)).save(out / (name + "-roughness.png"), optimize=True)
    print(name, "prepared", size, meters)
