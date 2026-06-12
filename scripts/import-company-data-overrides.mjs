import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const inputFile = getArgValue("--input") ?? join(root, "docs", "company-data-template.csv");
const outputFile = getArgValue("--output") ?? join(root, "lib", "companyDataOverrides.ts");
const dryRun = process.argv.includes("--dry-run");
const validDividendTypes = new Set(["無配当", "低配当", "中配当", "高配当"]);
const validRarities = new Set(["R", "SR", "SSR", "UR"]);
const requiredHeaders = [
  "ticker",
  "company",
  "currentSharePrice",
  "currentIssuedShares",
  "currentDividendType",
  "currentRarity",
  "overrideSharePrice",
  "overrideIssuedShares",
  "overrideDividendType",
  "overrideRarity"
];

function getArgValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function required(row, key, lineNumber) {
  const value = row[key]?.trim() ?? "";
  if (!value) {
    throw new Error(`Line ${lineNumber}: ${key} is required.`);
  }
  return value;
}

function optionalNumber(row, key, lineNumber) {
  const value = row[key]?.trim() ?? "";
  if (!value) return undefined;

  const normalized = value.replace(/_/g, "");
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`Line ${lineNumber}: ${key} must be a positive number. Got "${value}".`);
  }
  return Math.round(numberValue);
}

function optionalEnum(row, key, validValues, lineNumber) {
  const value = row[key]?.trim() ?? "";
  if (!value) return undefined;
  if (!validValues.has(value)) {
    throw new Error(`Line ${lineNumber}: ${key} must be one of ${[...validValues].join(", ")}. Got "${value}".`);
  }
  return value;
}

function toObjectRows(rows) {
  const [headers, ...body] = rows;
  if (!headers) return [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(", ")}`);
  }

  return body.map((cells, bodyIndex) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return {
      row,
      lineNumber: bodyIndex + 2
    };
  });
}

function formatOverride(override) {
  const lines = [];
  if (override.sharePrice !== undefined) lines.push(`    sharePrice: ${override.sharePrice},`);
  if (override.issuedShares !== undefined) lines.push(`    issuedShares: ${override.issuedShares},`);
  if (override.dividendType !== undefined) lines.push(`    dividendType: "${override.dividendType}",`);
  if (override.rarity !== undefined) lines.push(`    rarity: "${override.rarity}",`);
  lines.push(`    dataSource: "manual"`);
  return lines.join("\n");
}

function describeOverride(override) {
  const current = override.current;
  return [
    override.sharePrice !== undefined ? `株価 ${current.sharePrice || "-"} -> ${override.sharePrice}` : "",
    override.issuedShares !== undefined ? `発行株数 ${current.issuedShares || "-"} -> ${override.issuedShares}` : "",
    override.dividendType !== undefined ? `配当 ${current.dividendType || "-"} -> ${override.dividendType}` : "",
    override.rarity !== undefined ? `レア度 ${current.rarity || "-"} -> ${override.rarity}` : ""
  ].filter(Boolean).join(" / ");
}

if (!existsSync(inputFile)) {
  throw new Error(`Missing ${inputFile}. Run npm run export:company-template first.`);
}

const rows = parseCsv(readFileSync(inputFile, "utf8"));
const overrides = {};

for (const { row, lineNumber } of toObjectRows(rows)) {
  const ticker = required(row, "ticker", lineNumber);
  const company = required(row, "company", lineNumber);
  const sharePrice = optionalNumber(row, "overrideSharePrice", lineNumber);
  const issuedShares = optionalNumber(row, "overrideIssuedShares", lineNumber);
  const dividendType = optionalEnum(row, "overrideDividendType", validDividendTypes, lineNumber);
  const rarity = optionalEnum(row, "overrideRarity", validRarities, lineNumber);

  if (
    sharePrice === undefined &&
    issuedShares === undefined &&
    dividendType === undefined &&
    rarity === undefined
  ) {
    continue;
  }

  overrides[ticker] = {
    company,
    sharePrice,
    issuedShares,
    dividendType,
    rarity,
    current: {
      sharePrice: row.currentSharePrice?.trim() ?? "",
      issuedShares: row.currentIssuedShares?.trim() ?? "",
      dividendType: row.currentDividendType?.trim() ?? "",
      rarity: row.currentRarity?.trim() ?? ""
    }
  };
}

const entries = Object.entries(overrides)
  .sort(([left], [right]) => left.localeCompare(right, "ja"));

if (dryRun) {
  console.log(`Found ${entries.length} company data override rows in ${inputFile}.`);
  for (const [ticker, override] of entries) {
    console.log(`- ${ticker} ${override.company}: ${describeOverride(override)}`);
  }
  console.log("Dry run only. No files were written.");
  process.exit(0);
}

const exportableEntries = entries.map(([ticker, override]) => {
  const { company, current, ...exportableOverride } = override;
  return [ticker, exportableOverride];
});

const objectSource = exportableEntries.length > 0
  ? `{\n${exportableEntries.map(([ticker, override]) => `  "${ticker}": {\n${formatOverride(override)}\n  }`).join(",\n")}\n}`
  : "{}";

const source = `import type { CompanyDataSource, DividendType, Rarity } from "./monsters";

export type CompanyDataOverride = {
  sharePrice?: number;
  issuedShares?: number;
  dividendType?: DividendType;
  rarity?: Rarity;
  dataSource?: CompanyDataSource;
};

// This file can be generated from docs/company-data-template.csv.
// Run npm run import:company-overrides after filling override columns.
export const companyDataOverrides: Record<string, CompanyDataOverride> = ${objectSource};

export const companyDataOverrideCount = Object.keys(companyDataOverrides).length;
`;

writeFileSync(outputFile, source);
console.log(`Imported ${entries.length} company data overrides to ${outputFile}.`);
