
const keyboardCheck = document.createElement("button");
keyboardCheck.id = "keyboard-check";
keyboardCheck.textContent = "键盘移动检查";
document.querySelector("header").append(keyboardCheck);
keyboardCheck.onclick = async () => {
  if (busy) return;
  busy = true; stopped = false;
  try {
    await prepare();
    api().reset({ harness: "state" });
    const before = read();
    await key("KeyW", 1600);
    const moved = read();
    await key("KeyQ", 700);
    const turned = read();
    const distance = Math.hypot(moved.player.x - before.player.x, moved.player.z - before.player.z);
    const yaw = Math.abs(Math.atan2(Math.sin(turned.player.yaw - moved.player.yaw), Math.cos(turned.player.yaw - moved.player.yaw)));
    records.push({ type: "real-keyboard", before, moved, turned, distance, yaw });
    capture("real-keyboard-movement");
    if (distance < 0.2 || yaw < 0.15) throw new Error("Keyboard movement failed " + JSON.stringify({ distance, yaw }));
    status.value = "键盘移动通过";
    status.dataset.report = JSON.stringify({ revision: REVISION, records, state: read() });
  } catch (error) {
    status.value = error.message;
    status.dataset.report = JSON.stringify({ revision: REVISION, error: error.message, records, state: read() });
  } finally { busy = false; }
};

const groundCheck = document.createElement("button");
groundCheck.id = "ground-check";
groundCheck.textContent = "放下再拾起检查";
document.querySelector("header").append(groundCheck);
groundCheck.onclick = async () => {
  if (busy) return;
  busy = true; stopped = false;
  try {
    await prepare();
    api().reset({ harness: "state" });
    await walkTo(interactionGoal(engine(), read(), { type: "book", bookId: "black" }));
    await interactAndWait({ type: "book" });
    await walkTo({ x: 0, z: 5.3, yaw: 0 });
    await interactAndWait({ type: "drop" });
    if (read().carriedBook || read().books.black.location !== "ground") throw new Error("Ground placement failed");
    records.push({ type: "ground-placement", state: read(), animation: animation() });
    capture("ground-placement");
    await walkTo(interactionGoal(engine(), read(), { type: "book", bookId: "black" }));
    await interactAndWait({ type: "book" });
    if (read().carriedBook !== "black") throw new Error("Ground pickup failed");
    records.push({ type: "ground-pickup", state: read(), animation: animation() });
    capture("ground-pickup");
    status.value = "放下再拾起通过";
    status.dataset.report = JSON.stringify({ revision: REVISION, records, state: read() });
  } catch (error) {
    status.value = error.message;
    status.dataset.report = JSON.stringify({ revision: REVISION, error: error.message, records, state: read() });
  } finally { busy = false; }
};
