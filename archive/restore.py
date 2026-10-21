#!/usr/bin/env python3
"""Archive utility: restore original data from the GitHub Release; no game changes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4*1024*1024), b''):
            h.update(b)
    return h.hexdigest()

def checked_path(relative):
    p = ROOT / relative
    if not p.resolve().is_relative_to(ROOT) or '..' in Path(relative).parts:
        raise RuntimeError('Unsafe manifest path: ' + relative)
    return p

def verify(records):
    failures = []
    for row in records:
        p = checked_path(row['path'])
        if not p.is_file() or p.stat().st_size != row['bytes'] or sha(p) != row['sha256']:
            failures.append(row['path'])
    return failures

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--bundle-dir', type=Path, help='Use already downloaded release bundles')
    parser.add_argument('--fixtures', action='store_true', help='Also recreate optional historical QA symlinks')
    parser.add_argument('--overwrite', action='store_true', help='Explicitly replace locally edited data files')
    args = parser.parse_args()
    records = json.loads((ROOT/'archive/files.json').read_text(encoding='utf-8'))['files']
    if args.verify_only:
        failures = verify(records)
        print(json.dumps({'files': len(records), 'matched': len(records)-len(failures), 'mismatches': failures}, ensure_ascii=False, indent=2))
        return 1 if failures else 0
    failures = verify([r for r in records if r['storage'] == 'git'])
    if failures:
        raise RuntimeError('Git source files do not match this archive. Use an unmodified checkout: ' + ', '.join(failures[:8]))
    cache = ROOT/'.archive-cache'
    objects = cache/'objects'
    objects.mkdir(parents=True, exist_ok=True)
    bundles = json.loads((ROOT/'archive/bundles.json').read_text(encoding='utf-8'))
    required = {r['sha256']: r['bytes'] for r in records if r['storage'] == 'release-object'}
    for bundle in bundles['bundles']:
        if all((objects/k).is_file() and sha(objects/k) == k for k in bundle['objects']):
            continue
        target = args.bundle_dir/bundle['name'] if args.bundle_dir else cache/bundle['name']
        if not target.is_file() or sha(target) != bundle['sha256']:
            if args.bundle_dir:
                raise RuntimeError('Missing or corrupt local bundle: ' + str(target))
            url = f"https://github.com/{bundles['repository']}/releases/download/{bundles['tag']}/{bundle['name']}"
            part = target.with_suffix('.part')
            print('Downloading', bundle['name'], flush=True)
            with urllib.request.urlopen(url, timeout=180) as response, part.open('wb') as out:
                shutil.copyfileobj(response, out, length=4*1024*1024)
            if sha(part) != bundle['sha256']:
                raise RuntimeError('Downloaded bundle checksum mismatch: ' + bundle['name'])
            part.replace(target)
        seen = set()
        with tarfile.open(target, 'r:gz') as archive:
            for member in archive:
                key = member.name.removeprefix('objects/')
                if member.name != 'objects/'+key or key not in required or key not in bundle['objects'] or not member.isfile() or member.size != required[key] or key in seen:
                    raise RuntimeError('Unexpected bundle member')
                seen.add(key)
                dest = objects/key
                part = objects/(key+'.part')
                with archive.extractfile(member) as source, part.open('wb') as out:
                    shutil.copyfileobj(source, out, length=4*1024*1024)
                if sha(part) != key:
                    raise RuntimeError('Object checksum mismatch')
                part.replace(dest)
        if seen != set(bundle['objects']):
            raise RuntimeError('Incomplete bundle')
        print('Verified', bundle['name'], flush=True)
    count = 0
    for row in records:
        if row['storage'] != 'release-object':
            continue
        dest = checked_path(row['path'])
        if dest.exists():
            if dest.is_file() and sha(dest) == row['sha256']:
                continue
            if not args.overwrite:
                raise RuntimeError('Refusing to overwrite a changed local file: '+row['path'])
        dest.parent.mkdir(parents=True, exist_ok=True)
        # Independent copies keep current assets and frozen releases independently editable.
        shutil.copyfile(objects/row['sha256'], dest)
        count += 1
    if args.fixtures:
        for row in json.loads((ROOT/'archive/fixture-aliases.json').read_text()):
            dest = checked_path(row['path']); target = checked_path(row['target'])
            if not target.exists(): raise RuntimeError('Missing QA alias target: '+row['target'])
            if dest.is_symlink() and dest.resolve() == target.resolve(): continue
            if dest.exists(): raise RuntimeError('QA alias destination already exists: '+row['path'])
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.symlink_to(os.path.relpath(target, dest.parent), target_is_directory=target.is_dir())
    failures = verify(records)
    print(json.dumps({'restored': count, 'files': len(records), 'matched': len(records)-len(failures), 'mismatches': failures}, ensure_ascii=False))
    return 1 if failures else 0

if __name__ == '__main__':
    raise SystemExit(main())
