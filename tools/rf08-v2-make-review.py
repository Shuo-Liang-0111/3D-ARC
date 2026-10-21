"""Create browser-friendly source/photoreal review sheets without altering images."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def fit(image, size):
    copy = image.copy(); copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (18, 20, 20)); canvas.paste(copy, ((size[0]-copy.width)//2, (size[1]-copy.height)//2)); return canvas


def main():
    p=argparse.ArgumentParser(); p.add_argument("--dataset",required=True); a=p.parse_args(); root=Path(a.dataset); review=root/"review"; review.mkdir(exist_ok=True)
    sources=sorted((root/"source_rgb").glob("*.png")); photos=sorted((root/"photoreal").glob("*.png"))
    rows=[]
    for i,(src,dst) in enumerate(zip(sources,photos)):
        card=Image.new("RGB",(1024,548),(10,12,12)); draw=ImageDraw.Draw(card)
        card.paste(fit(Image.open(src).convert("RGB"),(500,500)),(4,40)); card.paste(fit(Image.open(dst).convert("RGB"),(500,500)),(520,40))
        draw.text((12,12),f"VIEW {i:03d}  |  BLENDER SOURCE",fill=(210,220,216)); draw.text((528,12),"PHOTOREALIZED",fill=(220,245,120)); card.save(review/f"compare_{i:03d}.jpg",quality=92)
        rows.append(f'<figure><img loading="lazy" src="compare_{i:03d}.jpg"><figcaption>VIEW {i:03d}</figcaption></figure>')
    html='''<!doctype html><meta charset="utf-8"><title>RF-08 v2 Review</title><style>body{margin:0;background:#090c0c;color:#dce6e1;font:14px system-ui}header{position:sticky;top:0;background:#0c1111ee;padding:16px;z-index:2;border-bottom:1px solid #344}h1{margin:0 0 5px;font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(620px,1fr));gap:14px;padding:14px}figure{margin:0;background:#101515;border:1px solid #293332;padding:6px}img{width:100%;display:block}figcaption{padding:5px 2px;color:#9baa9f}</style><header><h1>RF-08 v2 — 人工审核门</h1><div>左：Blender RGB-D 对应 RGB；右：照片级写实化。未获批准不会训练 3DGS。</div></header><main class="grid">'''+''.join(rows)+"</main>"
    (review/"index.html").write_text(html)
    (root/"review_manifest.json").write_text(json.dumps({"views":len(rows),"status":"awaiting_user_review","next_step":"3DGS only after approval"},indent=2))


if __name__=="__main__": main()
