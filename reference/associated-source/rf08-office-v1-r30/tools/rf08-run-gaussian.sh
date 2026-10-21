#!/usr/bin/env bash
set -euo pipefail
ROOT=./external/EmbodiedGen/outputs/rf08_gaussian
ARC=.
EMB=./external/EmbodiedGen
PY=/opt/arc-runtime/envs/embodiedgen/bin/python
BLENDER="$EMB/thirdparty/infinigen/blender/blender"
export LD_LIBRARY_PATH=/opt/arc-runtime/envs/build_311/lib:${LD_LIBRARY_PATH:-}
export OPENCV_IO_ENABLE_OPENEXR=1
export CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES:-0}

if [[ ! -f "$ROOT/transforms.json" ]]; then
  "$BLENDER" -b --python "$ARC/tools/rf08-build-dataset.py" -- --output-root "$ROOT" --views 48
fi
"$PY" "$ARC/tools/rf08-photorealize.py" --dataset "$ROOT" --output "$ROOT/images"
"$PY" "$ARC/tools/rf08-write-colmap.py" --dataset "$ROOT"
cd "$EMB"
"$PY" -m embodied_gen.trainer.gsplat_trainer default \
  --data-dir "$ROOT" --result-dir "$ROOT/model" --max-steps 10000 \
  --eval-steps 10000 --save-steps 10000 --ply-steps 10000 \
  --packed --antialiased --sh-degree 2
mkdir -p "$ARC/public/local-assets/gaussian/rf08"
cp "$ROOT/model/ply/point_cloud_9999.ply" "$ARC/public/local-assets/gaussian/rf08/rf08_photoreal.ply"
