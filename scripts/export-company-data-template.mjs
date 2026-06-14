import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const monsterDir = join(root, "public", "monsters");
const outputDir = join(root, "docs");
const outputFile = join(outputDir, "company-data-template.csv");
const assetPattern = /^([0-9A-Z]+)[\s_-]+(.+)\.png$/u;

const highDividendKeywords = ["ハウス", "建設", "セメント", "ENEOS", "出光", "東ソー", "UBE", "ブリヂストン", "王子"];
const midDividendKeywords = ["化学", "食品", "硝子", "ゴム", "TOTO", "花王", "富士", "日東", "ニッスイ", "味の素"];
const lowDividendKeywords = ["ゲーム", "ZOZO", "SHIFT", "エムスリー", "ネクソン", "資生堂", "キオクシア"];

function includesAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function inferDividendType(company) {
  if (includesAny(company, highDividendKeywords)) return "高配当";
  if (includesAny(company, lowDividendKeywords)) return "低配当";
  if (includesAny(company, midDividendKeywords)) return "中配当";
  return "中配当";
}

function inferRarity(ticker, company) {
  if (["4063", "4901"].includes(ticker)) return "UR";
  if (includesAny(company, ["キオクシア", "味の素", "花王", "ENEOS", "ブリヂストン", "富士", "信越", "日東"])) return "SSR";
  if (includesAny(company, ["ホールディングス", "化学", "建設", "AGC", "TOTO", "SUMCO", "SHIFT"])) return "SR";
  return "R";
}

function inferSharePrice(ticker) {
  const numericTicker = Number(ticker.replace(/\D/g, "")) || 1000;
  return Math.max(300, Math.round((numericTicker % 7000) + 500));
}

function inferIssuedShares(ticker, rarity) {
  const numericTicker = Number(ticker.replace(/\D/g, "")) || 1000;
  const base = rarity === "UR" ? 1_500_000_000 : rarity === "SSR" ? 850_000_000 : rarity === "SR" ? 420_000_000 : 180_000_000;
  return base + (numericTicker % 97) * 5_000_000;
}

function csv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/u.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

const assets = readdirSync(monsterDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name.normalize("NFC"))
  .flatMap((file) => {
    const match = file.match(assetPattern);
    if (!match) return [];

    const ticker = match[1];
    const company = match[2];
    const rarity = inferRarity(ticker, company);

    return [{
      ticker,
      company,
      monsterId: `jp-${ticker.toLowerCase()}`,
      imageFile: file,
      currentSharePrice: inferSharePrice(ticker),
      currentIssuedShares: inferIssuedShares(ticker, rarity),
      currentDividendType: inferDividendType(company),
      currentRarity: rarity,
      overrideSharePrice: "",
      overrideIssuedShares: "",
      overrideDividendType: "",
      overrideRarity: "",
      note: ""
    }];
  })
  .sort((a, b) => a.ticker.localeCompare(b.ticker, "ja"));

const headers = [
  "ticker",
  "company",
  "monsterId",
  "imageFile",
  "currentSharePrice",
  "currentIssuedShares",
  "currentDividendType",
  "currentRarity",
  "overrideSharePrice",
  "overrideIssuedShares",
  "overrideDividendType",
  "overrideRarity",
  "note"
];

const source = [
  headers.join(","),
  ...assets.map((asset) => headers.map((header) => csv(asset[header])).join(","))
].join("\n");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, `${source}\n`);
console.log(`Exported ${assets.length} company data rows to ${outputFile}.`);
