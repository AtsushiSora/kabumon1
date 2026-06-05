import {
  baseDividendPerUnit,
  monsterById,
  monsters,
  type Rarity,
  type MonsterStats
} from "./monsters";

export type OwnedMonster = {
  id: string;
  shares: number;
  level: number;
  exp: number;
  stats: MonsterStats;
  locked: boolean;
};

export type GrowthLog = {
  id: string;
  date: string;
  title: string;
  detail: string;
  coins: number;
  dividendCoins: number;
  exp: number;
  marketChange: number;
};

export type GameState = {
  playerName: string;
  kabuCoins: number;
  dividendCoins: number;
  owned: Record<string, OwnedMonster>;
  team: string[];
  buddyId: string;
  lastLoginAt: string;
  currentMarket: MarketEnergy;
  logs: GrowthLog[];
  offlinePending: OfflineReward | null;
  claimedMissionIds: string[];
};

export type MarketEnergy = {
  indexName: string;
  change: number;
  theme: string;
};

export type OfflineReward = {
  hours: number;
  kabuCoins: number;
  dividendCoins: number;
  exp: number;
};

export type TrainResult = {
  market: MarketEnergy;
  exp: number;
  statChanges: Partial<MonsterStats>;
  dividendCoins: number;
};

export type MissionReward = {
  kabuCoins: number;
  dividendCoins: number;
};

export type Mission = {
  id: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: MissionReward;
};

export const STORAGE_KEY = "kabumon:v0.1";

export const marketPrices: Record<Rarity, number> = {
  R: 3000,
  SR: 7000,
  SSR: 15000,
  UR: 50000
};

export function createInitialState(now = new Date()): GameState {
  const starter = createOwnedMonster("toyodora", 100);

  return {
    playerName: "トレーダーくん",
    kabuCoins: 12560,
    dividendCoins: 240,
    owned: {
      toyodora: starter
    },
    team: ["toyodora"],
    buddyId: "toyodora",
    lastLoginAt: now.toISOString(),
    currentMarket: createMarketEnergy(now),
    claimedMissionIds: [],
    logs: [
      {
        id: cryptoId(),
        date: now.toISOString(),
        title: "株モン開始",
        detail: "トヨドラが相棒になりました。",
        coins: 0,
        dividendCoins: 0,
        exp: 0,
        marketChange: 0
      }
    ],
    offlinePending: null
  };
}

export function createOwnedMonster(id: string, shares = 100): OwnedMonster {
  const master = monsterById.get(id);

  if (!master) {
    throw new Error(`Unknown monster id: ${id}`);
  }

  return {
    id,
    shares,
    level: 1,
    exp: 0,
    stats: { ...master.baseStats },
    locked: false
  };
}

export function hydrateState(raw: string | null, now = new Date()): GameState {
  if (!raw) {
    return applyOfflineReward(createInitialState(now), now);
  }

  try {
    const parsed = JSON.parse(raw) as GameState;
    return applyOfflineReward(
      {
        ...createInitialState(now),
        ...parsed,
        owned: parsed.owned ?? {},
        team: parsed.team?.length ? parsed.team : ["toyodora"],
        buddyId: parsed.buddyId ?? parsed.team?.[0] ?? "toyodora",
        logs: parsed.logs ?? [],
        claimedMissionIds: parsed.claimedMissionIds ?? [],
        currentMarket: parsed.currentMarket ?? createMarketEnergy(now)
      },
      now
    );
  } catch {
    return applyOfflineReward(createInitialState(now), now);
  }
}

export function applyOfflineReward(state: GameState, now = new Date()): GameState {
  const last = new Date(state.lastLoginAt);
  const elapsedMs = Math.max(0, now.getTime() - last.getTime());
  const hours = Math.min(12, elapsedMs / 1000 / 60 / 60);

  if (hours < 0.05) {
    return { ...state, lastLoginAt: now.toISOString(), offlinePending: null };
  }

  const reward = calculateOfflineReward(state, hours);

  return {
    ...state,
    lastLoginAt: now.toISOString(),
    offlinePending: reward
  };
}

export function calculateOfflineReward(state: GameState, hours: number): OfflineReward {
  const activeTeam = state.team
    .map((id) => state.owned[id])
    .filter(Boolean);

  const teamPower = activeTeam.reduce((sum, owned) => {
    const master = monsterById.get(owned.id);
    if (!master) return sum;

    const sharesBonus = getSharesBonus(owned.shares);
    const levelBonus = 1 + owned.level * 0.025;
    const dividendBonus = 1 + master.baseStats.dividendPower / 500;

    return sum + sharesBonus * levelBonus * dividendBonus;
  }, 0);

  const normalizedPower = Math.max(1, teamPower);

  return {
    hours: round(hours, 1),
    kabuCoins: Math.floor(110 * hours * normalizedPower),
    dividendCoins: Math.floor(22 * hours * normalizedPower),
    exp: Math.floor(8 * hours * normalizedPower)
  };
}

export function claimOfflineReward(state: GameState): GameState {
  if (!state.offlinePending) return state;

  const reward = state.offlinePending;
  const nextOwned = { ...state.owned };

  for (const id of state.team) {
    const owned = nextOwned[id];
    if (!owned) continue;
    nextOwned[id] = addExp(owned, Math.max(1, Math.floor(reward.exp / Math.max(1, state.team.length))));
  }

  return {
    ...state,
    kabuCoins: state.kabuCoins + reward.kabuCoins,
    dividendCoins: state.dividendCoins + reward.dividendCoins,
    owned: nextOwned,
    offlinePending: null,
    logs: [
      createLog(
        "オフライン報酬",
        `${reward.hours}時間分の報酬を受け取りました。`,
        reward.kabuCoins,
        reward.dividendCoins,
        reward.exp,
        state.currentMarket.change
      ),
      ...state.logs
    ].slice(0, 20)
  };
}

export function rollGacha(state: GameState): { state: GameState; monsterId: string; duplicate: boolean } {
  const cost = 3000;
  if (state.kabuCoins < cost) {
    return { state, monsterId: "", duplicate: false };
  }

  const monster = weightedMonster();
  const existing = state.owned[monster.id];
  const nextOwned = { ...state.owned };
  const duplicate = Boolean(existing);

  nextOwned[monster.id] = existing
    ? { ...existing, shares: existing.shares + 100 }
    : createOwnedMonster(monster.id, 100);

  const nextTeam = state.team.includes(monster.id)
    ? state.team
    : state.team.length < 3
      ? [...state.team, monster.id]
      : state.team;

  return {
    monsterId: monster.id,
    duplicate,
    state: {
      ...state,
      kabuCoins: state.kabuCoins - cost,
      owned: nextOwned,
      team: nextTeam,
      buddyId: state.buddyId || monster.id,
      logs: [
        createLog(
          duplicate ? "持ち株追加" : "新規入手",
          duplicate ? `${monster.name}の持ち株が100株増えました。` : `${monster.name}を図鑑に登録しました。`,
          -cost,
          0,
          0,
          state.currentMarket.change
        ),
        ...state.logs
      ].slice(0, 20)
    }
  };
}

export function buyMonsterFromMarket(state: GameState, monsterId: string): { state: GameState; ok: boolean; message: string } {
  const monster = monsterById.get(monsterId);
  if (!monster) {
    return { state, ok: false, message: "対象の株モンが見つかりません。" };
  }

  const price = marketPrices[monster.rarity];
  if (state.kabuCoins < price) {
    return { state, ok: false, message: "カブコインが足りません。" };
  }

  const existing = state.owned[monster.id];
  const nextOwned = { ...state.owned };
  nextOwned[monster.id] = existing
    ? { ...existing, shares: existing.shares + 100 }
    : createOwnedMonster(monster.id, 100);

  const nextTeam = state.team.includes(monster.id)
    ? state.team
    : state.team.length < 3
      ? [...state.team, monster.id]
      : state.team;

  const message = existing
    ? `${monster.name}を100株追加購入しました。`
    : `${monster.name}をマーケットで入手しました。`;

  return {
    ok: true,
    message,
    state: {
      ...state,
      kabuCoins: state.kabuCoins - price,
      owned: nextOwned,
      team: nextTeam,
      logs: [
        createLog("マーケット購入", message, -price, 0, 0, state.currentMarket.change),
        ...state.logs
      ].slice(0, 20)
    }
  };
}

export function sellMonsterUnit(state: GameState, monsterId: string): { state: GameState; ok: boolean; message: string } {
  const monster = monsterById.get(monsterId);
  const owned = state.owned[monsterId];

  if (!monster || !owned) {
    return { state, ok: false, message: "売却できる株モンが見つかりません。" };
  }

  if (owned.locked) {
    return { state, ok: false, message: `${monster.name}はロック中です。` };
  }

  if (owned.shares <= 100) {
    return { state, ok: false, message: "最低100株は残す必要があります。" };
  }

  const sellPrice = getUnitSellPrice(monster.rarity, owned.level);
  const nextOwned = {
    ...state.owned,
    [monsterId]: {
      ...owned,
      shares: owned.shares - 100
    }
  };
  const message = `${monster.name}を100株売却しました。`;

  return {
    ok: true,
    message,
    state: {
      ...state,
      kabuCoins: state.kabuCoins + sellPrice,
      owned: nextOwned,
      logs: [
        createLog("100株売却", message, sellPrice, 0, 0, state.currentMarket.change),
        ...state.logs
      ].slice(0, 20)
    }
  };
}

export function toggleMonsterLock(state: GameState, monsterId: string): GameState {
  const owned = state.owned[monsterId];
  if (!owned) return state;

  return {
    ...state,
    owned: {
      ...state.owned,
      [monsterId]: {
        ...owned,
        locked: !owned.locked
      }
    }
  };
}

export function getMissions(state: GameState): Mission[] {
  const ownedCount = Object.keys(state.owned).length;
  const totalShares = Object.values(state.owned).reduce((sum, owned) => sum + owned.shares, 0);
  const trained = state.logs.some((log) => log.title === "市場エネルギー反映");
  const gachaUsed = state.logs.some((log) => log.title === "新規入手" || log.title === "持ち株追加");
  const offlineClaimed = state.logs.some((log) => log.title === "オフライン報酬");

  return [
    createMission(state, {
      id: "first-gacha",
      title: "ガチャを回す",
      detail: "銘柄ガチャで株モンを入手する",
      progress: gachaUsed ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 500, dividendCoins: 0 }
    }),
    createMission(state, {
      id: "first-train",
      title: "市場エネルギー反映",
      detail: "相棒株モンを1回育成する",
      progress: trained ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 0, dividendCoins: 80 }
    }),
    createMission(state, {
      id: "three-owned",
      title: "株モンを3体集める",
      detail: "図鑑に3体以上の株モンを登録する",
      progress: ownedCount,
      target: 3,
      reward: { kabuCoins: 1500, dividendCoins: 0 }
    }),
    createMission(state, {
      id: "team-three",
      title: "3体チーム編成",
      detail: "チームに3体の株モンを編成する",
      progress: state.team.length,
      target: 3,
      reward: { kabuCoins: 0, dividendCoins: 120 }
    }),
    createMission(state, {
      id: "shares-500",
      title: "持ち株500株",
      detail: "全株モンの合計持ち株を500株にする",
      progress: totalShares,
      target: 500,
      reward: { kabuCoins: 2500, dividendCoins: 150 }
    }),
    createMission(state, {
      id: "offline-claim",
      title: "放置報酬を受け取る",
      detail: "オフライン報酬を1回受け取る",
      progress: offlineClaimed ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 800, dividendCoins: 60 }
    })
  ];
}

export function claimMissionReward(state: GameState, missionId: string): { state: GameState; ok: boolean; message: string } {
  const mission = getMissions(state).find((item) => item.id === missionId);

  if (!mission) {
    return { state, ok: false, message: "ミッションが見つかりません。" };
  }

  if (!mission.completed) {
    return { state, ok: false, message: "まだ達成していません。" };
  }

  if (mission.claimed) {
    return { state, ok: false, message: "報酬は受け取り済みです。" };
  }

  return {
    ok: true,
    message: `${mission.title}の報酬を受け取りました。`,
    state: {
      ...state,
      kabuCoins: state.kabuCoins + mission.reward.kabuCoins,
      dividendCoins: state.dividendCoins + mission.reward.dividendCoins,
      claimedMissionIds: [...state.claimedMissionIds, mission.id],
      logs: [
        createLog(
          "ミッション報酬",
          `${mission.title}を達成しました。`,
          mission.reward.kabuCoins,
          mission.reward.dividendCoins,
          0,
          state.currentMarket.change
        ),
        ...state.logs
      ].slice(0, 20)
    }
  };
}

export function trainBuddy(state: GameState): { state: GameState; result: TrainResult | null } {
  const buddy = state.owned[state.buddyId];
  if (!buddy || state.dividendCoins < 40) {
    return { state, result: null };
  }

  const market = createMarketEnergy(new Date());
  const result = calculateTraining(buddy, market);
  const nextBuddy = applyTraining(buddy, result);

  return {
    result,
    state: {
      ...state,
      dividendCoins: state.dividendCoins - 40 + result.dividendCoins,
      currentMarket: market,
      owned: {
        ...state.owned,
        [buddy.id]: nextBuddy
      },
      logs: [
        createLog(
          "市場エネルギー反映",
          `${market.indexName} ${formatSigned(market.change)}%で${monsterById.get(buddy.id)?.name ?? "株モン"}が成長しました。`,
          0,
          result.dividendCoins - 40,
          result.exp,
          market.change
        ),
        ...state.logs
      ].slice(0, 20)
    }
  };
}

export function setBuddy(state: GameState, id: string): GameState {
  if (!state.owned[id]) return state;
  return { ...state, buddyId: id };
}

export function toggleTeamMember(state: GameState, id: string): GameState {
  if (!state.owned[id]) return state;
  if (state.team.includes(id)) {
    if (state.team.length <= 1) return state;
    return { ...state, team: state.team.filter((memberId) => memberId !== id) };
  }
  if (state.team.length >= 3) return state;
  return { ...state, team: [...state.team, id] };
}

export function getTeamBonus(state: GameState): { name: string; detail: string; multiplier: number } {
  const tags = new Set(
    state.team.flatMap((id) => monsterById.get(id)?.tags ?? [])
  );

  if (tags.has("自動車") && tags.has("半導体") && (tags.has("テック") || tags.has("モビリティ"))) {
    return {
      name: "モビリティ連携",
      detail: "メカ属性の攻撃力が10%アップ",
      multiplier: 1.1
    };
  }

  if (tags.has("ゲーム") && tags.has("エンタメ") && tags.has("クリエイティブ")) {
    return {
      name: "エンタメ連合",
      detail: "運とイベント発生率がアップ",
      multiplier: 1.08
    };
  }

  if (tags.has("金融") && tags.has("防御") && tags.has("配当")) {
    return {
      name: "金融防衛隊",
      detail: "防御と配当コインがアップ",
      multiplier: 1.08
    };
  }

  return {
    name: "分散チーム",
    detail: "編成中の株モンが放置報酬を支えます",
    multiplier: 1
  };
}

export function getDisplayStats(owned: OwnedMonster): MonsterStats {
  const sharesBonus = getSharesBonus(owned.shares);
  return {
    hp: Math.floor(owned.stats.hp * sharesBonus),
    attack: Math.floor(owned.stats.attack * sharesBonus),
    defense: Math.floor(owned.stats.defense * sharesBonus),
    speed: Math.floor(owned.stats.speed * sharesBonus),
    luck: Math.floor(owned.stats.luck * sharesBonus),
    dividendPower: Math.floor(owned.stats.dividendPower * sharesBonus),
    growthPower: Math.floor(owned.stats.growthPower * sharesBonus)
  };
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function calculateTraining(owned: OwnedMonster, market: MarketEnergy): TrainResult {
  const master = monsterById.get(owned.id);
  const dividendBase = master ? baseDividendPerUnit[master.dividendType] : 15;
  const units = owned.shares / 100;
  const sharesBonus = getSharesBonus(owned.shares);
  const growthBonus = 1 + owned.stats.growthPower / 1000;
  const absChange = Math.abs(market.change);
  const exp = Math.floor((18 + absChange * 8) * growthBonus * sharesBonus);
  const dividendCoins = Math.floor(dividendBase * units * (1 + owned.stats.dividendPower / 1000));

  if (market.change >= 3) {
    return {
      market,
      exp,
      dividendCoins,
      statChanges: { attack: 6, speed: 2, growthPower: 1 }
    };
  }

  if (market.change >= 1) {
    return {
      market,
      exp,
      dividendCoins,
      statChanges: { attack: 3, growthPower: 1 }
    };
  }

  if (market.change <= -3) {
    return {
      market,
      exp,
      dividendCoins,
      statChanges: { hp: 16, defense: 5 }
    };
  }

  if (market.change <= -1) {
    return {
      market,
      exp,
      dividendCoins,
      statChanges: { hp: 8, defense: 3 }
    };
  }

  return {
    market,
    exp,
    dividendCoins,
    statChanges: { luck: 2, dividendPower: 1 }
  };
}

function applyTraining(owned: OwnedMonster, result: TrainResult): OwnedMonster {
  const nextStats = { ...owned.stats };
  for (const [key, value] of Object.entries(result.statChanges)) {
    const statKey = key as keyof MonsterStats;
    nextStats[statKey] += value ?? 0;
  }
  return addExp({ ...owned, stats: nextStats }, result.exp);
}

function addExp(owned: OwnedMonster, amount: number): OwnedMonster {
  let exp = owned.exp + amount;
  let level = owned.level;
  let stats = { ...owned.stats };
  let required = getRequiredExp(level);

  while (exp >= required) {
    exp -= required;
    level += 1;
    stats = {
      ...stats,
      hp: stats.hp + 18,
      attack: stats.attack + 6,
      defense: stats.defense + 6,
      speed: stats.speed + 1,
      luck: stats.luck + 1
    };
    required = getRequiredExp(level);
  }

  return { ...owned, exp, level, stats };
}

export function getRequiredExp(level: number): number {
  return 80 + level * 24;
}

export function getUnitSellPrice(rarity: Rarity, level: number): number {
  return Math.floor(marketPrices[rarity] * 0.6 + level * 50);
}

function weightedMonster() {
  const pool = monsters.flatMap((monster) => {
    const count = monster.rarity === "SR" ? 7 : monster.rarity === "SSR" ? 3 : 1;
    return Array.from({ length: count }, () => monster);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

function createMarketEnergy(date: Date): MarketEnergy {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const wave = Math.sin(seed * 12.9898) * 43758.5453;
  const normalized = wave - Math.floor(wave);
  const change = round(normalized * 7 - 3.2, 2);
  const themes = ["モビリティ", "半導体", "金融防衛", "エンタメ", "安定配当"];

  return {
    indexName: "マーケット225",
    change,
    theme: themes[Math.floor(normalized * themes.length)] ?? "モビリティ"
  };
}

function getSharesBonus(shares: number): number {
  return 1 + Math.log10(shares / 100 + 1) * 0.25;
}

function createLog(
  title: string,
  detail: string,
  coins: number,
  dividendCoins: number,
  exp: number,
  marketChange: number
): GrowthLog {
  return {
    id: cryptoId(),
    date: new Date().toISOString(),
    title,
    detail,
    coins,
    dividendCoins,
    exp,
    marketChange
  };
}

function createMission(
  state: GameState,
  mission: Omit<Mission, "completed" | "claimed">
): Mission {
  const completed = mission.progress >= mission.target;
  return {
    ...mission,
    progress: Math.min(mission.progress, mission.target),
    completed,
    claimed: state.claimedMissionIds.includes(mission.id)
  };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
