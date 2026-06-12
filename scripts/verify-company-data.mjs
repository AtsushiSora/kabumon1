import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const steps = [
  ["sync:monsters", ["scripts/sync-monster-assets.mjs"]],
  ["export:company-template", ["scripts/export-company-data-template.mjs"]],
  ["preview:company-overrides", ["scripts/import-company-data-overrides.mjs", "--dry-run"]],
  ["import:company-overrides", ["scripts/import-company-data-overrides.mjs"]],
  ["test:company-overrides", ["scripts/test-company-overrides.mjs"]]
];

function runStep(label, args) {
  console.log(`\n> ${label}`);
  execFileSync(process.execPath, args, { cwd: root, stdio: "inherit" });
}

for (const [label, args] of steps) {
  runStep(label, args);
}

const assetFile = join(root, "lib", "companyMonsterAssets.ts");
const assetSource = readFileSync(assetFile, "utf8");
const match = assetSource.match(/"usableFiles":\s*(\d+)/u);
const usableFiles = match ? Number(match[1]) : 0;

if (!Number.isFinite(usableFiles) || usableFiles <= 0) {
  throw new Error("No usable company monster assets were found.");
}

console.log(`\nCompany data pipeline verified with ${usableFiles} company monster assets.`);
