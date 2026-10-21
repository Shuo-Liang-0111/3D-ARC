"""Photorealize RF-08 in six-view batches while preserving camera registration."""
import argparse
import json
import os
from pathlib import Path

import cv2
import numpy as np
import OpenEXR
import torch
from PIL import Image
from torchvision.transforms.functional import to_tensor

from embodied_gen.models.texture_model import build_texture_gen_pipe


PROMPT = (
    "photorealistic compact industrial electrical service room, documentary "
    "architectural photography, aged concrete, oxidized painted steel, subtle "
    "dust, realistic fluorescent lighting, natural exposure, detailed materials, "
    "preserve exact room geometry and camera"
)
NEGATIVE = (
    "illustration, CGI, game render, plastic, neon, geometry changes, extra doors, "
    "extra machinery, people, text, logo, blur, fisheye, duplicate objects"
)


def read_exr(path: Path) -> np.ndarray:
    channels = OpenEXR.File(str(path)).channels()
    if "V" in channels:
        return channels["V"].pixels
    if all(name in channels for name in ("X", "Y", "Z")):
        return np.stack([channels[name].pixels for name in ("X", "Y", "Z")], -1)
    raise RuntimeError(f"Unsupported EXR channels in {path}: {list(channels)}")


def make_controls(root: Path, frame: dict, size: int):
    color = Image.open(root / frame["file_path"]).convert("RGB").resize((size, size))
    normal = read_exr(root / frame["normal_path"])[..., :3]
    depth = read_exr(root / frame["depth_path"])
    if depth.ndim == 3:
        depth = depth[..., 0]
    normal = cv2.resize(normal, (size, size), interpolation=cv2.INTER_AREA)
    depth = cv2.resize(depth, (size, size), interpolation=cv2.INTER_NEAREST)
    valid = np.isfinite(depth) & (depth > 0.04) & (depth < 12.0)
    normal = np.clip(normal * 0.5 + 0.5, 0, 1)
    normal[~valid] = 0

    # The texture ControlNet expects normal, position and mask channels. Rebuild a
    # stable world-position encoding from Blender's camera truth and Z pass.
    meta = frame["_meta"]
    focal = 0.5 * size / np.tan(0.5 * meta["camera_angle_x"])
    yy, xx = np.mgrid[:size, :size]
    rays = np.stack(((xx - size / 2) / focal, -(yy - size / 2) / focal, -np.ones_like(xx)), -1)
    rays /= np.linalg.norm(rays, axis=-1, keepdims=True)
    local = rays * depth[..., None]
    c2w = np.asarray(frame["transform_matrix"], dtype=np.float32)
    world = local @ c2w[:3, :3].T + c2w[:3, 3]
    lo = np.array([-3.0, -3.0, -0.25], np.float32)
    hi = np.array([3.0, 3.0, 3.25], np.float32)
    position = np.clip((world - lo) / (hi - lo), 0, 1)
    position[~valid] = 0
    control = torch.cat((
        to_tensor(normal.astype(np.float32)),
        to_tensor(position.astype(np.float32)),
        torch.from_numpy(valid.astype(np.float32))[None],
    ), 0)
    return color, control


def grid_pil(images, size):
    canvas = Image.new("RGB", (size * 3, size * 2))
    for index, image in enumerate(images):
        canvas.paste(image, ((index % 3) * size, (index // 3) * size))
    return canvas


def split_grid(image, size):
    return [image.crop(((i % 3) * size, (i // 3) * size, (i % 3 + 1) * size, (i // 3 + 1) * size)) for i in range(6)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--weights", default="./external/EmbodiedGen/weights")
    parser.add_argument("--controlnet")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--view-size", type=int, default=512)
    parser.add_argument("--batch-limit", type=int)
    parser.add_argument("--strength", type=float, default=0.32)
    args = parser.parse_args()
    os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
    root, output = Path(args.dataset), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    meta = json.loads((root / "transforms.json").read_text())
    frames = meta["frames"]
    for frame in frames:
        frame["_meta"] = meta

    pipe = build_texture_gen_pipe(
        base_ckpt_dir=args.weights,
        controlnet_ckpt=args.controlnet,
        ip_adapt_scale=0,
        device=args.device,
    )
    batch_count = (len(frames) + 5) // 6
    if args.batch_limit is not None:
        batch_count = min(batch_count, args.batch_limit)
    for batch in range(batch_count):
        current = frames[batch * 6: batch * 6 + 6]
        if len(current) < 6:
            current += current[-1:] * (6 - len(current))
        prepared = [make_controls(root, frame, args.view_size) for frame in current]
        init = grid_pil([item[0] for item in prepared], args.view_size)
        control = torch.cat((
            torch.cat([item[1] for item in prepared[:3]], 2),
            torch.cat([item[1] for item in prepared[3:]], 2),
        ), 1)[None]
        generator = torch.Generator(device=args.device).manual_seed(80800 + batch)
        result = pipe(
            prompt=PROMPT,
            negative_prompt=NEGATIVE,
            image=init,
            control_image=control,
            controlnet_conditioning_scale=0.75,
            control_guidance_end=0.9,
            strength=args.strength,
            num_inference_steps=28,
            guidance_scale=5.5,
            generator=generator,
        ).images[0]
        for frame, crop in zip(current, split_grid(result, args.view_size)):
            source_size = Image.open(root / frame["file_path"]).size
            crop.resize(source_size, Image.Resampling.LANCZOS).save(
                output / Path(frame["file_path"]).name
            )
        print(f"completed batch {batch + 1}/{batch_count}", flush=True)


if __name__ == "__main__":
    main()
