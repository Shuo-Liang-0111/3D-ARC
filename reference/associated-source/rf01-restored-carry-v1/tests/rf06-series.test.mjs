import test from "node:test";
import assert from "node:assert/strict";
import {createLeakEngine} from "../game/levels/rf06/series-engine.js";
const e=id=>createLeakEngine(id);
test("RF06 fixed water; RF06-2 grows while idle and stops on shutoff",()=>{
 let r=e("rf06"),s=r.createInitialState();for(let i=0;i<100;i++)s=r.updateEnvironment(s,.05);assert.equal(s.water,3);
 r=e("rf06-2");s=r.createInitialState();for(let i=0;i<100;i++)s=r.updateEnvironment(s,.05);assert.ok(s.water>3.79);s.valveClosed=true;assert.equal(r.updateEnvironment(s,.05).water,s.water);
});
test("withdrawn RF06-3 cannot construct its old state machine",()=>{assert.throws(()=>e("rf06-3"),/withdrawn/);});
