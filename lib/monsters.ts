import { companyMonsterAssets, type CompanyMonsterAsset } from "./companyMonsterAssets";
import { companyDataOverrides } from "./companyDataOverrides";
import { withBasePath } from "./paths";

export type Rarity = "R" | "SR" | "SSR" | "UR";

export type DividendType = "無配当" | "低配当" | "中配当" | "高配当";

export type MonsterEffect = {
  name: string;
  description: string;
  attackBonusPer100Shares: number;
};

export type MonsterStats = {
  attack: number;
};

export type CompanyDataSource = "estimated" | "manual" | "live";

export type MonsterMaster = {
  id: string;
  name: string;
  ticker: string;
  companyAlias: string;
  rarity: Rarity;
  attribute: string;
  role: string;
  equipment: string;
  skill: string;
  dividendType: DividendType;
  sharePrice: number;
  issuedShares: number;
  dataSource: CompanyDataSource;
  effect: MonsterEffect;
  tags: string[];
  baseStats: MonsterStats;
  image: string;
  icon: string;
  assetReady: boolean;
};

export const rarityWeights: Record<Rarity, number> = {
  R: 50,
  SR: 35,
  SSR: 14,
  UR: 1
};

export const baseDividendPerUnit: Record<DividendType, number> = {
  無配当: 0,
  低配当: 15,
  中配当: 40,
  高配当: 80
};

const effects = {
  noDividend: {
    name: "再建集中",
    description: "配当効果なし。株価そのものが攻撃力になります。",
    attackBonusPer100Shares: 0
  },
  lowDividend: {
    name: "小配当ブースト",
    description: "100株ごとに攻撃力+0.5%。",
    attackBonusPer100Shares: 0.005
  },
  midDividend: {
    name: "配当ブースト",
    description: "100株ごとに攻撃力+1.5%。",
    attackBonusPer100Shares: 0.015
  },
  highDividend: {
    name: "高配当ブースト",
    description: "100株ごとに攻撃力+3%。",
    attackBonusPer100Shares: 0.03
  }
} satisfies Record<string, MonsterEffect>;

type CompanyProfile = {
  attribute: string;
  role: string;
  equipment: string;
  skill: string;
  tags: string[];
  dividendType: DividendType;
};

function effectForDividend(type: DividendType): MonsterEffect {
  if (type === "高配当") return effects.highDividend;
  if (type === "中配当") return effects.midDividend;
  if (type === "低配当") return effects.lowDividend;
  return effects.noDividend;
}

const highDividendKeywords = ["ハウス", "建設", "セメント", "ENEOS", "出光", "東ソー", "UBE", "ブリヂストン", "王子"];
const midDividendKeywords = ["化学", "食品", "硝子", "ゴム", "TOTO", "花王", "富士", "日東", "ニッスイ", "味の素"];
const lowDividendKeywords = ["ゲーム", "ZOZO", "SHIFT", "エムスリー", "ネクソン", "資生堂", "キオクシア"];

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function inferDividendType(company: string): DividendType {
  if (includesAny(company, highDividendKeywords)) return "高配当";
  if (includesAny(company, lowDividendKeywords)) return "低配当";
  if (includesAny(company, midDividendKeywords)) return "中配当";
  return "中配当";
}

function inferRarity(ticker: string, company: string): Rarity {
  if (["4063", "4901"].includes(ticker)) return "UR";
  if (includesAny(company, ["キオクシア", "味の素", "花王", "ENEOS", "ブリヂストン", "富士", "信越", "日東"])) return "SSR";
  if (includesAny(company, ["ホールディングス", "化学", "建設", "AGC", "TOTO", "SUMCO", "SHIFT"])) return "SR";
  return "R";
}

function inferSharePrice(ticker: string): number {
  const numericTicker = Number(ticker.replace(/\D/g, "")) || 1000;
  return Math.max(300, Math.round((numericTicker % 7000) + 500));
}

function inferIssuedShares(ticker: string, rarity: Rarity): number {
  const numericTicker = Number(ticker.replace(/\D/g, "")) || 1000;
  const base = rarity === "UR" ? 1_500_000_000 : rarity === "SSR" ? 850_000_000 : rarity === "SR" ? 420_000_000 : 180_000_000;
  return base + (numericTicker % 97) * 5_000_000;
}

function shortCompanyName(company: string): string {
  return company
    .replace(/ホールディングス|グループ|コーポレーション|工業|本社|産業|建設|化学|電工|電気|硝子/g, "")
    .replace(/[・（）()＆&\s]/g, "")
    .slice(0, 8) || company.slice(0, 8);
}

function createMonsterName(company: string): string {
  return `${shortCompanyName(company)}モン`;
}

function inferCompanyProfile(company: string): CompanyProfile {
  if (includesAny(company, ["キオクシア", "SUMCO", "信越", "半導体"])) {
    return {
      attribute: "半導体",
      role: "半導体素材型",
      equipment: "シリコンコア",
      skill: "ウェハチャージ",
      dividendType: inferDividendType(company),
      tags: ["半導体", "素材", "テック", "成長"]
    };
  }

  if (includesAny(company, ["化学", "レゾナック", "東ソー", "トクヤマ", "デンカ", "クラレ", "旭化成", "UBE", "日産"])) {
    return {
      attribute: "化学",
      role: "素材連携型",
      equipment: "ケミカルコア",
      skill: "素材反応",
      dividendType: inferDividendType(company),
      tags: ["素材", "化学", "配当", "高変動"]
    };
  }

  if (includesAny(company, ["建設", "ハウス", "セメント", "TOTO", "不動産"])) {
    return {
      attribute: "建設",
      role: "インフラ安定型",
      equipment: "ビルドシールド",
      skill: "基盤補強",
      dividendType: inferDividendType(company),
      tags: ["建設", "インフラ", "防御", "安定"]
    };
  }

  if (includesAny(company, ["食品", "ニッスイ", "日本ハム", "味の素", "キッコーマン", "キリン", "アサヒ", "サッポロ", "ニチレイ", "たばこ"])) {
    return {
      attribute: "生活",
      role: "生活安定型",
      equipment: "サプライコア",
      skill: "生活補給",
      dividendType: inferDividendType(company),
      tags: ["食品", "生活", "安定", "配当"]
    };
  }

  if (includesAny(company, ["ENEOS", "出光", "INPEX", "電力"])) {
    return {
      attribute: "エネルギー",
      role: "資源配当型",
      equipment: "エネルギーコア",
      skill: "燃料供給",
      dividendType: inferDividendType(company),
      tags: ["エネルギー", "資源", "インフラ", "配当"]
    };
  }

  if (includesAny(company, ["ゴム", "ブリヂストン"])) {
    return {
      attribute: "モビリティ",
      role: "機動素材型",
      equipment: "ラバータイヤ",
      skill: "グリップ加速",
      dividendType: inferDividendType(company),
      tags: ["自動車", "素材", "モビリティ", "配当"]
    };
  }

  if (includesAny(company, ["ネクソン", "ディー・エヌ・エー", "ZOZO", "SHIFT"])) {
    return {
      attribute: "テック",
      role: "成長テック型",
      equipment: "データコア",
      skill: "成長リンク",
      dividendType: inferDividendType(company),
      tags: ["テック", "成長", "高変動", "エンタメ"]
    };
  }

  if (includesAny(company, ["エムスリー", "富士", "資生堂", "花王"])) {
    return {
      attribute: "生活医療",
      role: "生活支援型",
      equipment: "ヘルスコア",
      skill: "日常支援",
      dividendType: inferDividendType(company),
      tags: ["生活", "医療", "安定", "配当"]
    };
  }

  return {
    attribute: "企業",
    role: "市場連動型",
    equipment: "マーケットコア",
    skill: "株価リンク",
    dividendType: inferDividendType(company),
    tags: ["安定", "配当", "市場", "成長"]
  };
}

function createCompanyMonster(asset: CompanyMonsterAsset): MonsterMaster {
  const override = companyDataOverrides[asset.ticker];
  const rarity = override?.rarity ?? inferRarity(asset.ticker, asset.company);
  const profile = inferCompanyProfile(asset.company);
  const dividendType = override?.dividendType ?? profile.dividendType;
  const sharePrice = override?.sharePrice ?? inferSharePrice(asset.ticker);
  const issuedShares = override?.issuedShares ?? inferIssuedShares(asset.ticker, rarity);
  const dataSource = override?.dataSource ?? (override ? "manual" : "estimated");
  const imagePath = withBasePath(`/monsters/${asset.file}`);

  return {
    id: `jp-${asset.ticker.toLowerCase()}`,
    name: createMonsterName(asset.company),
    ticker: asset.ticker,
    companyAlias: asset.company,
    rarity,
    attribute: profile.attribute,
    role: profile.role,
    equipment: profile.equipment,
    skill: profile.skill,
    dividendType,
    sharePrice,
    issuedShares,
    dataSource,
    effect: effectForDividend(dividendType),
    tags: profile.tags,
    baseStats: {
      attack: sharePrice * 100
    },
    image: imagePath,
    icon: imagePath,
    assetReady: true
  };
}

export const specialMonsters: MonsterMaster[] = [];

export const companyMonsters: MonsterMaster[] = companyMonsterAssets.map(createCompanyMonster);
export const playableMonsters: MonsterMaster[] = companyMonsters;
export const monsters: MonsterMaster[] = companyMonsters;

export const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
