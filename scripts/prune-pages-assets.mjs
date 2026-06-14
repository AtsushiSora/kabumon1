import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outMonsterDir = join(root, "out", "monsters");

let removedCount = 0;

for (const entry of readdirSync(outMonsterDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".png")) continue;
  rmSync(join(outMonsterDir, entry.name));
  removedCount += 1;
}

console.log(`Pruned ${removedCount} top-level monster image assets from out/monsters.`);
console.log("Transparent runtime assets remain in out/monsters/transparent.");
