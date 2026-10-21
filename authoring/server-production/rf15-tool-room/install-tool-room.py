from pathlib import Path
root=Path(__file__).resolve().parents[2]
for variant in ("rf15-1","rf15-2","rf15-3"):
    directory=root/"game/levels"/variant
    engine=directory/"engine.js"
    text=engine.read_text()
    if "toolRoomInteraction" in text:
        raise RuntimeError("Tool room already installed")
    text='import { TOOL_ROOM_WALLS, toolDoorCollider, toolRoomInteraction, doorSweepBlocked } from "../rf15/tool-room-layout.js";\n'+text
    text=text.replace("failed:false,progress:","failed:false,toolRoomOpen:false,toolDoorAngle:0,heldTool:null,progress:")
    text=text.replace("return STATIC_COLLIDERS;","return [...STATIC_COLLIDERS,...TOOL_ROOM_WALLS,toolDoorCollider(s)];")
    text=text.replace("!STATIC_COLLIDERS.some","!getColliders(s).some")
    text=text.replace("n.elapsed+=d;","n.elapsed+=d;const target=n.toolRoomOpen?-Math.PI/2:0;const difference=target-n.toolDoorAngle;n.toolDoorAngle+=Math.sign(difference)*Math.min(Math.abs(difference),d*1.8);")
    text=text.replace('if(s.complete||s.failed)return null;if(LEVEL.variant', 'if(s.complete||s.failed)return null;const roomAction=toolRoomInteraction(s);if(roomAction)return roomAction;if(LEVEL.variant')
    text=text.replace('!s.sprayer&&reach(s,LEVEL.tool)?{type:"take-sprayer",label:"拿起农药喷剂"}:', '')
    anchor='let reward=null;const item=a.item&&n.items[a.item];'
    replacement='''if(["open-tool-room","close-tool-room"].includes(a.type)){if(doorSweepBlocked(s,LEVEL.playerRadius)){n.errors++;n.lastEvent="tool_door_blocked";return settle(s,n,LEVEL.progress.errorCost);}n.toolRoomOpen=a.type==="open-tool-room";n.lastEvent=n.toolRoomOpen?"tool_room_opened":"tool_room_closed";return settle(s,n,LEVEL.progress.interactionCost);}if(a.type==="take-tool"||a.type==="return-tool"){n.heldTool=a.type==="take-tool"?a.tool:null;n.lastEvent=a.type==="take-tool"?"harvest_tool_taken":"harvest_tool_returned";return settle(s,n,LEVEL.progress.interactionCost);}let reward=null;const item=a.item&&n.items[a.item];'''
    assert anchor in text
    text=text.replace(anchor,replacement)
    text=text.replace(':"空载",gate:', ':(s.heldTool==="harvest-knife"?"收割刀":s.heldTool==="hand-trowel"?"手铲":s.sprayer?"农药喷剂":"空载"),gate:')
    engine.write_text(text)
    level=directory/"level.js"
    text=level.read_text().replace('maxX:24','maxX:24,minZ:-15.2')
    text=text.replace('tool:{x:-5.8,y:1.0,z:4.0}', 'tool:{x:-2.1,y:1.04,z:-12.9}')
    level.write_text(text)
    (directory/"scene.js").write_text('export { createScene, createCargoModel, syncVisuals, syncRobotCargo } from "../rf15/shared-variant-scene.js";\n')
    runtime=directory/"runtime.js"
    text=runtime.read_text().replace('Boolean(s.carriedItem)','Boolean(s.carriedItem || s.heldTool || s.sprayer)')
    text=text.replace('started:"', 'tool_room_opened:"工具房门已打开",tool_room_closed:"工具房门已关闭",tool_door_blocked:"请离开门扇摆动范围",harvest_tool_taken:"已拿取收割工具",harvest_tool_returned:"工具已放回",started:"')
    runtime.write_text(text)
config=root/"vite.config.js"
text=config.read_text()
anchor='  "levels/rf15/realism-v0.4.3",'
assert anchor in text
config.write_text(text.replace(anchor,anchor+'\n  "levels/rf15/tool-room-v1",'))
test=root/"tests/rf15-1.test.mjs"
text=test.read_text()
if 'import { LEVEL }' not in text:
    text='import { LEVEL } from "../game/levels/rf15-1/level.js";\n'+text
text=text.replace('x: -3.9, z: -4.2','x: LEVEL.intake.x, z: LEVEL.intake.z')
test.write_text(text)
