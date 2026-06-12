import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const templateFile = join(root, "docs", "company-data-template.csv");
const tempDir = mkdtempSync(join(tmpdir(), "kabumon-company-overrides-"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runImporter(args) {
  return execFileSync(
    process.execPath,
    [join(root, "scripts", "import-company-data-overrides.mjs"), ...args],
    { cwd: root, encoding: "utf8" }
  );
}

try {
  const lines = readFileSync(templateFile, "utf8").trimEnd().split("\n");
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => line.split(","));
  const targetRow = rows.find((row) => row[0] === "5108") ?? rows[0];

  assert(targetRow, "company data template has no rows.");

  const setColumn = (name, value) => {
    const index = headers.indexOf(name);
    assert(index >= 0, `missing ${name} column.`);
    targetRow[index] = value;
  };

  setColumn("overrideSharePrice", "1234");
  setColumn("overrideIssuedShares", "567800000");
  setColumn("overrideDividendType", "高配当");
  setColumn("overrideRarity", "SSR");

  const inputFile = join(tempDir, "company-data-template.csv");
  const outputFile = join(tempDir, "companyDataOverrides.ts");
  writeFileSync(inputFile, `${headers.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}\n`);

  const preview = runImporter(["--input", inputFile, "--dry-run"]);
  assert(preview.includes("Found 1 company data override rows"), "preview did not find exactly one override.");
  assert(preview.includes(targetRow[0]), "preview did not include the target ticker.");
  assert(preview.includes("株価") && preview.includes("-> 1234"), "preview did not show the share price change.");

  runImporter(["--input", inputFile, "--output", outputFile]);
  const generated = readFileSync(outputFile, "utf8");
  assert(generated.includes("sharePrice: 1234"), "generated override is missing sharePrice.");
  assert(generated.includes("issuedShares: 567800000"), "generated override is missing issuedShares.");
  assert(generated.includes('dividendType: "高配当"'), "generated override is missing dividendType.");
  assert(generated.includes('rarity: "SSR"'), "generated override is missing rarity.");
  assert(generated.includes('dataSource: "manual"'), "generated override is missing dataSource.");
  assert(!generated.includes("current:"), "generated override leaked preview-only current data.");
  assert(!generated.includes("company:"), "generated override leaked preview-only company data.");

  console.log("Company override import smoke test passed.");
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
