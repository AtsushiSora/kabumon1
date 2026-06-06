import { withBasePath } from "./paths";

export type Rarity = "R" | "SR" | "SSR" | "UR";

export type DividendType = "低配当" | "中配当" | "高配当";

export type MonsterStats = {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  dividendPower: number;
  growthPower: number;
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
  低配当: 15,
  中配当: 40,
  高配当: 80
};

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
    tags: ["自動車", "メカ", "モビリティ", "安定"],
    baseStats: {
      hp: 1200,
      attack: 760,
      defense: 820,
      speed: 130,
      luck: 80,
      dividendPower: 70,
      growthPower: 85
    },
    image: withBasePath("/monsters/toyodora.png"),
    icon: withBasePath("/monsters/toyodora-icon.png"),
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
    tags: ["ゲーム", "エンタメ", "遊び", "運"],
    baseStats: {
      hp: 950,
      attack: 700,
      defense: 520,
      speed: 160,
      luck: 150,
      dividendPower: 35,
      growthPower: 110
    },
    image: withBasePath("/monsters/nintendora.png"),
    icon: withBasePath("/monsters/nintendora-icon.png"),
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
    tags: ["クリエイティブ", "エンタメ", "テック", "高速"],
    baseStats: {
      hp: 1000,
      attack: 820,
      defense: 600,
      speed: 190,
      luck: 120,
      dividendPower: 40,
      growthPower: 95
    },
    image: withBasePath("/monsters/sonic-leo.png"),
    icon: withBasePath("/monsters/sonic-leo-icon.png"),
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
    tags: ["金融", "防御", "配当", "安定"],
    baseStats: {
      hp: 1500,
      attack: 520,
      defense: 1000,
      speed: 70,
      luck: 90,
      dividendPower: 140,
      growthPower: 65
    },
    image: withBasePath("/monsters/bank-golem.png"),
    icon: withBasePath("/monsters/bank-golem-icon.png"),
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
    tags: ["半導体", "テック", "雷", "高変動"],
    baseStats: {
      hp: 850,
      attack: 980,
      defense: 480,
      speed: 220,
      luck: 110,
      dividendPower: 25,
      growthPower: 105
    },
    image: withBasePath("/monsters/chip-thunder.png"),
    icon: withBasePath("/monsters/chip-thunder-icon.png"),
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
    tags: ["医療", "バイオ", "安定", "支援"],
    baseStats: {
      hp: 1120,
      attack: 560,
      defense: 760,
      speed: 115,
      luck: 130,
      dividendPower: 85,
      growthPower: 78
    },
    image: withBasePath("/monsters/medica-seraph.png"),
    icon: withBasePath("/monsters/medica-seraph-icon.png"),
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
    dividendType: "中配当",
    tags: ["エネルギー", "インフラ", "安定", "配当"],
    baseStats: {
      hp: 1280,
      attack: 690,
      defense: 780,
      speed: 125,
      luck: 95,
      dividendPower: 105,
      growthPower: 72
    },
    image: withBasePath("/monsters/grid-wyvern.png"),
    icon: withBasePath("/monsters/grid-wyvern-icon.png"),
    assetReady: true
  }
];

export const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
