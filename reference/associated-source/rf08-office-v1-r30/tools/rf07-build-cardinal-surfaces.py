import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path('public/local-assets/cardinal/rf07')
SOURCE = ROOT / 'textures' / 'source'
RUNTIME = ROOT / 'textures' / 'runtime'
MANIFEST = ROOT / 'manifests' / 'surfaces.json'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def seamless_edges(image, size=2048, blend=256):
    array = np.asarray(image.resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32).copy()
    for index in range(blend):
        ratio = index / max(blend - 1, 1)
        weight = 0.5 * (1 + np.cos(np.pi * ratio))
        average = (array[:, index].copy() + array[:, -1 - index].copy()) * 0.5
        array[:, index] = array[:, index] * (1 - weight) + average * weight
        array[:, -1 - index] = array[:, -1 - index] * (1 - weight) + average * weight
    for index in range(blend):
        ratio = index / max(blend - 1, 1)
        weight = 0.5 * (1 + np.cos(np.pi * ratio))
        average = (array[index].copy() + array[-1 - index].copy()) * 0.5
        array[index] = array[index] * (1 - weight) + average * weight
        array[-1 - index] = array[-1 - index] * (1 - weight) + average * weight
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))


def pbr_maps(base, strength, roughness_center, ao_strength):
    gray = np.asarray(base.convert('L'), dtype=np.float32) / 255.0
    dx = (np.roll(gray, -1, axis=1) - np.roll(gray, 1, axis=1)) * strength
    dy = (np.roll(gray, -1, axis=0) - np.roll(gray, 1, axis=0)) * strength
    normal = np.stack((-dx, dy, np.ones_like(gray)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal = np.clip((normal * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8)
    variation = gray - gray.mean()
    roughness = np.clip(roughness_center + variation * 34, 120, 245).astype(np.uint8)
    ao = np.clip(245 + variation * ao_strength, 205, 255).astype(np.uint8)
    return Image.fromarray(normal), Image.fromarray(roughness), Image.fromarray(ao)


def build(name, *, blur, saturation, contrast, tint, strength, roughness, ao_strength):
    source_path = SOURCE / f'{name}-basecolor.png'
    image = Image.open(source_path).convert('RGB').filter(ImageFilter.GaussianBlur(blur))
    image = ImageEnhance.Color(image).enhance(saturation)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    tiled = seamless_edges(image)
    array = np.asarray(tiled, dtype=np.float32)
    array *= np.asarray(tint, dtype=np.float32)[None, None, :]
    base = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
    normal, roughness_map, ao = pbr_maps(base, strength, roughness, ao_strength)
    outputs = {
        'baseColor': RUNTIME / f'{name}-basecolor.webp',
        'normal': RUNTIME / f'{name}-normal.webp',
        'roughness': RUNTIME / f'{name}-roughness.webp',
        'ao': RUNTIME / f'{name}-ao.webp',
    }
    base.save(outputs['baseColor'], 'WEBP', quality=90, method=6)
    normal.save(outputs['normal'], 'WEBP', quality=90, method=6)
    roughness_map.save(outputs['roughness'], 'WEBP', quality=92, method=6)
    ao.save(outputs['ao'], 'WEBP', quality=92, method=6)
    return {
        'source': str(source_path),
        'tileSizePixels': [2048, 2048],
        'maps': {key: {'path': str(path), 'bytes': path.stat().st_size, 'sha256': sha256(path)} for key, path in outputs.items()},
    }


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    manifest = {'level': 'RF-07', 'surfaces': {}}
    manifest['surfaces']['epoxy_floor'] = build(
        'epoxy_floor', blur=1.4, saturation=0.42, contrast=0.78,
        tint=(0.86, 0.94, 0.95), strength=1.45, roughness=172, ao_strength=20,
    )
    wall_path = SOURCE / 'cleanroom_wall-basecolor.png'
    if wall_path.exists():
        manifest['surfaces']['cleanroom_wall'] = build(
            'cleanroom_wall', blur=0.8, saturation=0.28, contrast=0.68,
            tint=(1.00, 0.995, 0.94), strength=0.72, roughness=205, ao_strength=12,
        )
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))


main()
