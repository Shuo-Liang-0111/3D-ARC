import fs from "node:fs";
import { walkRoute } from "./route.mjs";

const records = [];
for (const id of ["rf02-2", "rf02-3"]) {
  for (const sample of id === "rf02-3" ? [0.1, 0.5, 0.9] : [0.1]) {
    for (const errors of id === "rf02-2" ? [0, 1] : [0, 2]) {
      const result = walkRoute(id, sample, errors);
      records.push({ id, color: result.state.incident.color, errors, distance: result.distance, finalReserve: result.finalReserve, minimumReserve: result.minimumReserve, complete: result.state.complete, drops: result.state.incident.drops });
    }
  }
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(records, null, 2) + "\n");
console.log(JSON.stringify(records, null, 2));
