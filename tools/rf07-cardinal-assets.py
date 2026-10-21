import json
import hashlib
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('public/local-assets/cardinal/rf07')
REQUESTS = ROOT / 'requests'
MANIFESTS = ROOT / 'manifests'
SOURCE_MODELS = ROOT / 'models' / 'source'
SOURCE_TEXTURES = ROOT / 'textures' / 'source'
REFERENCES = ROOT / 'references'
HELPER = Path('/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py')

COMMON = (
    'Y-up, metric scale, front facing positive Z, centered bottom pivot. '
    'One isolated game-ready object only. Clean watertight topology, real thickness, '
    'beveled manufactured edges, physically based materials with base color, normal, '
    'roughness, metallic and AO. No floor, wall, room, pedestal, character, robot, '
    'hands, floating parts, baked lighting, neon, arrows, UI, readable text, logo, '
    'trademark, watermark or extra objects. Export GLB for Three.js.'
)

ASSETS = {
    'class_ii_a2_bsc': ('Class II A2 biological safety cabinet for an operating Chinese BSL-2 lab, '
        '1.50 m wide x 2.18 m high x 0.78 m deep. White powder-coated steel body, stainless work surface, '
        'front sash glass, intake grille, control panel, rear service depth, leveling feet; front opening must remain clear.', [1.50, 2.18, 0.78]),
    'receiving_bench_equipment_bank': ('Seven-point-nine meter specimen receiving bench equipment bank, 7.90 m wide x 1.75 m high x 1.00 m deep. '
        'Modular stainless lower cabinets, black phenolic worktop, backsplash, LIMS monitor, barcode printer, benchtop centrifuge and compact PCR analyzer, all structurally mounted as one bank.', [7.90, 1.75, 1.00]),
    'specimen_transfer_cart': ('Mobile stainless three-tier specimen transfer cart, 1.05 m wide x 1.15 m high x 0.58 m deep. '
        'Three perforated shelves, four posts, two locking casters, push handle, lidded carrier and tube rack; all four casters must touch the ground.', [1.05, 1.15, 0.58]),
    'cold_chain_packing_island': ('Cold-chain packing island for a BSL-2 laboratory, 4.80 m wide x 1.72 m high x 1.60 m deep. '
        'Stainless cabinet base, black phenolic worktop, bumper corners and a small consumables rack; long working edge faces positive Z and feet contact the floor.', [4.80, 1.72, 1.60]),
    'dry_reagent_cabinet': ('Closed dry reagent cabinet, 2.20 m wide x 2.20 m high x 0.78 m deep. '
        'White powder-coated steel carcass, two safety-glass doors, vertical handles, four interior shelves visible through glass and solid leveling base.', [2.20, 2.20, 0.78]),
    'handwash_eyewash_station': ('Hands-free laboratory handwash and eyewash station, 1.42 m wide x 1.80 m high x 2.65 m deep. '
        'Stainless sink bench, ceramic basin, gooseneck faucet, knee-operated panel, soap dispenser and wall-mounted eyewash head; service side can be flush to a wall.', [1.42, 1.80, 2.65]),
    'ppe_locker_bank': ('PPE locker bank for a cleanroom anteroom, 2.80 m wide x 2.10 m high x 0.82 m deep. '
        'Four powder-coated steel lockers, door seams, handles, ventilation slots and continuous plinth; doors face positive Z and base rests on floor.', [2.80, 2.10, 0.82]),
    'medical_refrigerator': ('Medical 2–8 degree Celsius refrigerator, 0.76 m wide x 1.98 m high x 0.82 m deep. '
        'White insulated cabinet, dark door gasket, triple-glazed door, vertical handle, controller header, temperature display, shelves, compressor grille and four leveling feet.', [0.76, 1.98, 0.82]),
    'p650_transport_case': ('P650 insulated biological sample transport case, 0.62 m wide x 0.468 m high x 0.505 m deep including handle. '
        'Dark insulated case body, aluminum protective corners, latches, temperature logger LCD and LED, UN3373-style diamond without readable text, rigid carry handle; bottom must be flat.', [0.62, 0.468, 0.505]),
    'pcm_cooling_plate': ('Reusable 2–8 degree Celsius PCM cooling plate, 0.19 m wide x 0.046 m high x 0.13 m deep. '
        'Blue sealed polymer plate with gasket seam and recessed label area, no liquid leak, flat bottom for a transport-case slot.', [0.19, 0.046, 0.13]),
    'secondary_specimen_carrier': ('Sealed secondary biological specimen carrier, 0.18 m wide x 0.159 m high x 0.11 m deep. '
        'Impact-resistant amber/blue/green polymer shell, transparent lid, foam insert, three cryovials and blank medical label plate; base flat and stable.', [0.18, 0.159, 0.11]),
    'medical_waste_bin': ('Yellow foot-operated biohazard medical waste bin, 0.42 m wide x 0.80 m high x 0.36 m deep. '
        'Lidded ABS body, dark foot pedal, recessed blank biohazard marking area and stable flat base.', [0.42, 0.80, 0.36]),
}

SURFACES = {
    'epoxy_floor': 'Seamless 2 m by 2 m tileable light-gray laboratory epoxy floor surface, subtle cleaning swirls, restrained roller wear and tiny aggregate variation, orthographic top-down, no perspective, no horizon, no border, no shadow, no furniture, no text, no logo, no baked lighting.',
    'cleanroom_wall': 'Seamless 1.2 m by 3.3 m tileable warm-white washable cleanroom wall panel surface, subtle vertical panel seam and restrained use marks, straight-on orthographic view, no perspective, no horizon, no border, no shadow, no furniture, no text, no logo, no baked lighting.',
}

REFERENCE_PROMPTS = {
    'class_ii_a2_bsc': 'Photorealistic isolated product reference of one modern Class II A2 biological safety cabinet, white powder-coated steel, stainless work surface, clear open front sash, intake grille, controller and leveling feet. Complete object in three-quarter front view showing front, right side and top. Neutral light-gray seamless studio background, straight engineering proportions, no crop, no room, no floor accessory, no text, no logo, no labels, no dimensions, no extras.',
    'handwash_eyewash_station': 'Photorealistic isolated product reference of one compact hands-free laboratory handwash and eyewash station, stainless sink cabinet, ceramic basin, gooseneck faucet, knee control, soap dispenser and twin eyewash head. Complete object in three-quarter front view showing front, right side and top. Neutral light-gray seamless studio background, no wall, no signs, no measurement plaques, no text, no logo, no labels, no dimensions, no extras.',
    'pcm_cooling_plate': 'Photorealistic isolated product reference of one simple reusable blue PCM cold plate for a P650 transport case, a flat sealed rectangular polymer slab with rounded corners, gasket seam, shallow ribs and one blank recessed label area. Complete object in three-quarter front view showing top, front and right side. Neutral light-gray seamless studio background, no feet, no controls, no machine parts, no text, no logo, no labels, no extras.',
    'p650_transport_case': 'Photorealistic isolated product reference of one P650 insulated biological sample transport case, dark rigid rectangular body, aluminum protective corners, two latches, temperature logger display, rigid centered carry handle and flat stable bottom. Complete object in three-quarter front view showing front, right side and top. Neutral light-gray seamless studio background, no specimen, no text, no logo, no readable labels, no extras.',
    'secondary_specimen_carrier': 'Photorealistic isolated product reference of one sealed secondary biological specimen carrier, compact impact-resistant colored polymer box, transparent lid, foam insert and three cryovials visible inside, blank medical label plate, flat stable bottom. Complete object in three-quarter front view showing front, right side and top. Neutral light-gray seamless studio background, no text, no logo, no readable labels, no hands, no extras.',
}

def write_model(name, description, size):
    prompt = (f'Photorealistic real-world laboratory equipment asset. {description} '
              f'Target dimensions approximately {size[0]} m x {size[1]} m x {size[2]} m. '
              + COMMON)
    payload = {'prompt': prompt, 'taskType': 'text_to_model', 'qualityPreset': 'high-highpoly',
               'outputFormat': 'glb', 'geometryQuality': 'detailed', 'enablePbr': True,
               'texture': True, 'pivotToCenterBottom': True, 'refineAfterGeneration': False}
    (REQUESTS / f'{name}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')

def generate_requests():
    REQUESTS.mkdir(parents=True, exist_ok=True)
    for name, (description, size) in ASSETS.items():
        write_model(name, description, size)
    for name, prompt in SURFACES.items():
        payload = {'prompt': prompt, 'resolution': '4k', 'aspectRatio': '1:1', 'quality': 'advanced', 'transparentBackground': False}
        (REQUESTS / f'{name}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'generated {len(ASSETS)} model requests and {len(SURFACES)} surface requests')

def generate_reference_requests():
    REQUESTS.mkdir(parents=True, exist_ok=True)
    for name, prompt in REFERENCE_PROMPTS.items():
        payload = {'prompt': prompt, 'resolution': '2k', 'aspectRatio': '4:3', 'quality': 'advanced', 'transparentBackground': False}
        (REQUESTS / f'{name}_reference.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'generated {len(REFERENCE_PROMPTS)} reference requests')

def load_manifest():
    path = MANIFESTS / 'generation.json'
    if path.exists():
        return json.loads(path.read_text())
    return {'level': 'RF-07', 'provider': 'Cardinal', 'assets': {}}

def save_manifest(manifest):
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    (MANIFESTS / 'generation.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

def helper_json(*args):
    completed = subprocess.run([sys.executable, str(HELPER), *args], check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)

def submit_requests():
    manifest = load_manifest()
    entries = [(name, 'model3d') for name in ASSETS] + [(name, 'image') for name in SURFACES]
    for name, kind in entries:
        existing = manifest['assets'].get(name, {})
        if existing.get('taskId'):
            print(f'{name}: reuse {existing["taskId"]}')
            continue
        result = helper_json('submit', kind, '--file', str(REQUESTS / f'{name}.json'))
        manifest['assets'][name] = {
            'type': kind,
            'requestFile': str(REQUESTS / f'{name}.json'),
            'taskId': result['taskId'],
            'status': result['status'],
        }
        save_manifest(manifest)
        print(f'{name}: {result["taskId"]} {result["status"]}')

def submit_references():
    manifest = load_manifest()
    references = manifest.setdefault('references', {})
    for name in REFERENCE_PROMPTS:
        existing = references.get(name, {})
        if existing.get('taskId') and existing.get('status') not in {'failed', 'cancelled'}:
            print(f'{name}: reuse {existing["taskId"]}')
            continue
        request_file = REQUESTS / f'{name}_reference.json'
        result = helper_json('submit', 'image', '--file', str(request_file))
        attempts = list(existing.get('attempts', []))
        if existing.get('taskId'):
            attempts.append({'taskId': existing['taskId'], 'status': existing.get('status'), 'error': existing.get('error')})
        references[name] = {
            'requestFile': str(request_file),
            'taskId': result['taskId'],
            'status': result['status'],
            'attempts': attempts,
        }
        save_manifest(manifest)
        print(f'{name}: {result["taskId"]} {result["status"]}')

def refresh_status():
    manifest = load_manifest()
    entries = list(manifest['assets'].items()) + [(f'reference:{name}', entry) for name, entry in manifest.get('references', {}).items()]
    for name, entry in entries:
        if entry.get('status') in {'completed', 'failed', 'cancelled'}:
            continue
        result = helper_json('task', entry['taskId'])
        entry['status'] = result['status']
        entry['progress'] = result.get('progress')
        entry['error'] = result.get('error')
        print(f'{name}: {entry["status"]} {entry.get("progress") or 0}%')
    save_manifest(manifest)

def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def archive_existing(path, label):
    if not path.exists():
        return
    rejected = path.parent.parent / 'rejected'
    rejected.mkdir(parents=True, exist_ok=True)
    candidate = rejected / f'{label}{path.suffix}'
    suffix = 1
    while candidate.exists():
        candidate = rejected / f'{label}-{suffix}{path.suffix}'
        suffix += 1
    path.replace(candidate)
    print(f'archived stale artifact {candidate}')


def download_completed():
    manifest = load_manifest()
    SOURCE_MODELS.mkdir(parents=True, exist_ok=True)
    SOURCE_TEXTURES.mkdir(parents=True, exist_ok=True)
    for name, entry in manifest['assets'].items():
        if entry.get('status') != 'completed' or entry.get('sourceArtifact'):
            continue
        output = SOURCE_MODELS / f'{name}.highpoly.glb' if entry['type'] == 'model3d' else SOURCE_TEXTURES / f'{name}-basecolor.png'
        archive_existing(output, f'{name}-{entry["taskId"]}-stale')
        helper_json('artifact', entry['taskId'], '--output', str(output))
        entry['sourceArtifact'] = str(output)
        entry['sourceSha256'] = sha256(output)
        entry['sourceBytes'] = output.stat().st_size
        save_manifest(manifest)
        print(f'{name}: downloaded {output}')
    REFERENCES.mkdir(parents=True, exist_ok=True)
    for name, entry in manifest.get('references', {}).items():
        if entry.get('status') != 'completed' or entry.get('artifact'):
            continue
        output = REFERENCES / f'{name}.png'
        archive_existing(output, f'{name}-{entry["taskId"]}-stale')
        helper_json('artifact', entry['taskId'], '--output', str(output))
        entry['artifact'] = str(output)
        entry['sha256'] = sha256(output)
        entry['bytes'] = output.stat().st_size
        save_manifest(manifest)
        print(f'reference:{name}: downloaded {output}')

def submit_image_replacements():
    manifest = load_manifest()
    for name in REFERENCE_PROMPTS:
        reference = manifest.get('references', {}).get(name, {})
        if reference.get('status') != 'completed' or not reference.get('artifact'):
            print(f'{name}: reference not ready')
            continue
        if not reference.get('sourceImageId'):
            upload = helper_json('upload-model-source', reference['artifact'])
            reference['sourceImageId'] = upload['sourceImageId']
            save_manifest(manifest)
        request_file = REQUESTS / f'{name}_image_to_model.json'
        payload = {'sourceImageId': reference['sourceImageId'], 'taskType': 'image_to_model',
                   'qualityPreset': 'high-highpoly', 'outputFormat': 'glb', 'geometryQuality': 'detailed',
                   'enablePbr': True, 'texture': True, 'pivotToCenterBottom': True, 'refineAfterGeneration': False}
        request_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        entry = manifest['assets'][name]
        if entry.get('taskType') == 'image_to_model' and entry.get('status') not in {'failed', 'cancelled'}:
            print(f'{name}: reuse {entry["taskId"]}')
            continue
        entry.setdefault('attempts', []).append({'taskId': entry['taskId'], 'status': entry['status'], 'error': entry.get('error')})
        result = helper_json('submit', 'model3d', '--file', str(request_file))
        entry.update({'requestFile': str(request_file), 'taskId': result['taskId'], 'status': result['status'],
                      'progress': 0, 'error': None, 'taskType': 'image_to_model', 'sourceImageId': reference['sourceImageId']})
        entry.pop('sourceArtifact', None)
        entry.pop('sourceSha256', None)
        entry.pop('sourceBytes', None)
        save_manifest(manifest)
        print(f'{name}: {result["taskId"]} {result["status"]}')

def poll_and_download():
    while True:
        refresh_status()
        manifest = load_manifest()
        statuses = [entry['status'] for entry in manifest['assets'].values()]
        if statuses and all(status in {'completed', 'failed', 'cancelled'} for status in statuses):
            download_completed()
            return
        time.sleep(15)

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'generate'
    {'generate': generate_requests, 'generate-references': generate_reference_requests,
     'submit': submit_requests, 'submit-references': submit_references,
     'submit-image-replacements': submit_image_replacements,
     'status': refresh_status, 'download': download_completed, 'poll': poll_and_download}[action]()

if __name__ == '__main__':
    main()
