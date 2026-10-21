import json,subprocess,time
from pathlib import Path
P=Path("./authoring/server-production/rf10-series-v2")
CLI="/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py"
prompts={
"oil_bottle":"Photorealistic single one liter Chinese household cooking oil PET bottle, upright flat base, clear amber golden oil, translucent ribbed plastic body, green screw cap, small tasteful cream and green printed label, short narrow neck with graspable shoulder, realistic physically based roughness and highlights, isolated single object, no table, no background, full bottle without cropping.",
"frying_pan":"Photorealistic single 28 cm household frying pan, open concave black nonstick cooking bowl with visibly hollow interior and thin brushed stainless steel rim, flat bottom, one long straight black bakelite handle attached by two visible rivets, handle points horizontally to the right, level pan opening faces up, realistic subtle cooking wear, physically based metallic material, isolated cookware, no food no stove no background.",
"extinguisher":"Photorealistic single compact kitchen wet chemical Class F fire extinguisher, upright red rounded steel cylinder, flat black rubber foot, readable cream instructional safety label with small pictograms, brass valve, silver lever grip and retaining pin, round pressure gauge, flexible black hose attached at top and clipped alongside the body, black nozzle, isolated one portable unit, no cabinet no stand no wall no background, physically based red enamel and steel materials."
}
def cli(*args):
 r=subprocess.run(["python3",CLI,*args],capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr[:500] or r.stdout[:500])
 return json.loads(r.stdout)
manifest={}
for name,prompt in prompts.items():
 f=P/"source"/(name+"-request.json")
 f.write_text(json.dumps(dict(prompt=prompt,taskType="text_to_model",qualityPreset="high-highpoly",outputFormat="glb",faceLimit=40000,enablePbr=True,texture=True,pivotToCenterBottom=True)))
 task=cli("submit","model3d","--file",str(f))
 manifest[name]={"taskId":task.get("taskId",task.get("id")),"status":task["status"]}
 (P/"cardinal-tasks.json").write_text(json.dumps(manifest,indent=2))
 print(name,manifest[name],flush=True)
for cycle in range(80):
 pending=False
 for name,task in manifest.items():
  if task["status"] in ("completed","failed","cancelled"): continue
  data=cli("task",task["taskId"])
  task["status"]=data["status"]
  print(name,task["status"],flush=True)
  if task["status"]=="completed":
   r=subprocess.run(["python3",CLI,"artifact",task["taskId"],"--output",str(P/"source"/(name+".glb"))],capture_output=True,text=True)
   task["downloaded"]=r.returncode==0
   if r.returncode: print("artifact error",r.stderr[:300],flush=True)
  elif task["status"] not in ("failed","cancelled"): pending=True
 (P/"cardinal-tasks.json").write_text(json.dumps(manifest,indent=2))
 if not pending: break
 time.sleep(20)
