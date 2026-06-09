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

export const monsters: MonsterMaster[] = [
  {
    id: "toyodora",
    name: "トヨドラ",
    ticker: "7203",
    companyAlias: "自動車メーカーA",
    rarity: "SSR",
    attribute: "メカ",
    role: "安定成長型",
    equipment: "ハイブリッドエンジン",
    skill: "カイゼンブースト",
    dividendType: "中配当",
    sharePrice: 2854,
    issuedShares: 15_794_987_460,
    effect: effects.midDividend,
    tags: ["自動車", "メカ", "モビリティ", "安定"],
    baseStats: {
      attack: 285400
    },
    image: withBasePath("/monsters/toyodora-transparent.png"),
    icon: withBasePath("/monsters/toyodora-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "nintendora",
    name: "ニンテンドラ",
    ticker: "7974",
    companyAlias: "ゲーム企業A",
    rarity: "SR",
    attribute: "遊び",
    role: "変化成長型",
    equipment: "遊び心のコントローラー",
    skill: "ワクワク変化",
    dividendType: "低配当",
    sharePrice: 7693,
    issuedShares: 1_298_690_000,
    effect: effects.lowDividend,
    tags: ["ゲーム", "エンタメ", "遊び", "運"],
    baseStats: {
      attack: 769300
    },
    image: withBasePath("/monsters/nintendora-transparent.png"),
    icon: withBasePath("/monsters/nintendora-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "sonic-leo",
    name: "ソニックレオ",
    ticker: "6758",
    companyAlias: "クリエイティブ企業A",
    rarity: "SSR",
    attribute: "光・音",
    role: "特殊高速型",
    equipment: "クリエイターゴーグル",
    skill: "イメージセンサー",
    dividendType: "低配当",
    sharePrice: 3445,
    issuedShares: 6_149_810_645,
    effect: effects.lowDividend,
    tags: ["クリエイティブ", "エンタメ", "テック", "高速"],
    baseStats: {
      attack: 344500
    },
    image: withBasePath("/monsters/sonic-leo-transparent.png"),
    icon: withBasePath("/monsters/sonic-leo-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "bank-golem",
    name: "バンクゴーレム",
    ticker: "8306",
    companyAlias: "銀行グループA",
    rarity: "SR",
    attribute: "鉄壁",
    role: "配当防御型",
    equipment: "巨大金庫の盾",
    skill: "安定守護",
    dividendType: "高配当",
    sharePrice: 3184,
    issuedShares: 11_867_710_920,
    effect: effects.highDividend,
    tags: ["金融", "防御", "配当", "安定"],
    baseStats: {
      attack: 318400
    },
    image: withBasePath("/monsters/bank-golem-transparent.png"),
    icon: withBasePath("/monsters/bank-golem-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "chip-thunder",
    name: "チップサンダー",
    ticker: "6920",
    companyAlias: "半導体装置企業A",
    rarity: "SSR",
    attribute: "雷",
    role: "高変動型",
    equipment: "精密レーザーコア",
    skill: "ボラティリティ放電",
    dividendType: "低配当",
    sharePrice: 40710,
    issuedShares: 94_286_400,
    effect: effects.lowDividend,
    tags: ["半導体", "テック", "雷", "高変動"],
    baseStats: {
      attack: 4071000
    },
    image: withBasePath("/monsters/chip-thunder-transparent.png"),
    icon: withBasePath("/monsters/chip-thunder-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "medica-seraph",
    name: "メディカセラフ",
    ticker: "4519",
    companyAlias: "医療バイオ企業A",
    rarity: "SR",
    attribute: "癒やし",
    role: "回復支援型",
    equipment: "バイオリアクターの翼",
    skill: "リカバリー配当",
    dividendType: "中配当",
    sharePrice: 7369,
    issuedShares: 1_679_057_667,
    effect: effects.midDividend,
    tags: ["医療", "バイオ", "安定", "支援"],
    baseStats: {
      attack: 736900
    },
    image: withBasePath("/monsters/medica-seraph-transparent.png"),
    icon: withBasePath("/monsters/medica-seraph-icon-transparent.png"),
    assetReady: true
  },
  {
    id: "grid-wyvern",
    name: "グリッドワイバーン",
    ticker: "9501",
    companyAlias: "電力インフラ企業A",
    rarity: "SR",
    attribute: "電力",
    role: "インフラ安定型",
    equipment: "スマートグリッド翼",
    skill: "パワーリレー",
    dividendType: "無配当",
    sharePrice: 541,
    issuedShares: 1_607_017_531,
    effect: effects.noDividend,
    tags: ["エネルギー", "インフラ", "安定", "配当"],
    baseStats: {
      attack: 54100
    },
    image: withBasePath("/monsters/grid-wyvern-transparent.png"),
    icon: withBasePath("/monsters/grid-wyvern-icon-transparent.png"),
    assetReady: true
  }
];

export const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
