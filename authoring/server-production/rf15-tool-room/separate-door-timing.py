from pathlib import Path
root=Path(__file__).resolve().parents[2]
for variant in ("rf15-1","rf15-2","rf15-3"):
    path=root/"game/levels"/variant/"engine.js"
    text=path.read_text()
    old='const target=n.toolRoomOpen?-Math.PI/2:0;const difference=target-n.toolDoorAngle;n.toolDoorAngle+=Math.sign(difference)*Math.min(Math.abs(difference),d*1.8);'
    assert old in text
    text=text.replace(old,'')
    text='export { advanceToolRoom as updateEnvironment } from "../rf15/tool-room-layout.js";\n'+text
    path.write_text(text)
path=root/"tests/rf15-tool-room.test.mjs"
text=path.read_text().replace('getInteraction,interact,updateMovement,isWalkable','getInteraction,interact,updateMovement,isWalkable,updateEnvironment')
text=text.replace('state=updateMovement(state,{},.05)','state=updateEnvironment(state,.05)')
path.write_text(text)
