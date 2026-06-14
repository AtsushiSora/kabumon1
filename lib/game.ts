import {
  baseDividendPerUnit,
  monsterById,
  monsters,
  playableMonsters,
  type Rarity,
  type MonsterMaster,
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
  saveVersion: number;
  playerName: string;
  traderLevel: number;
  traderExp: number;
  gachaTickets: number;
  kabuCoins: number;
  dividendCoins: number;
  owned: Record<string, OwnedMonster>;
  team: string[];
  buddyId: string;
  lastLoginAt: string;
  dailyCheckinDate: string | null;
  loginStreak: number;
  dailyCheckinCount: number;
  dailyEventDate: string | null;
  eventCount: number;
  currentMarket: MarketEnergy;
  logs: GrowthLog[];
  offlinePending: OfflineReward | null;
  claimedMissionIds: string[];
};

export type MarketEnergy = {
  indexName: string;
  change: number;
  theme: string;
  source: MarketDataSource;
  updatedAt: string;
  note: string;
};

export type MarketDataSource = "game-simulated" | "external-api";

export const marketSourceLabels: Record<MarketDataSource, string> = {
  "game-simulated": "ゲーム内データ",
  "external-api": "外部市場"
};

export type OfflineReward = {
  hours: number;
  kabuCoins: number;
  dividendCoins: number;
  exp: number;
};

export type DailyCheckinStatus = {
  available: boolean;
  todayKey: string;
  currentStreak: number;
  nextStreak: number;
  kabuCoins: number;
  dividendCoins: number;
};

export type DailyEventStatus = {
  available: boolean;
  todayKey: string;
  score: number;
  target: number;
  rank: "S" | "A" | "B" | "C";
  kabuCoins: number;
  dividendCoins: number;
  exp: number;
  teamPower: number;
  enemyAttack: number;
  enemyTeam: CpuTeamMember[];
  enemyTeamName: string;
  enemyBonusName: string;
  enemyBonusDetail: string;
  enemyBonusMultiplier: number;
  won: boolean;
  marketModifier: number;
};

export type DailyEventResult = {
  state: GameState;
  ok: boolean;
  message: string;
  status: DailyEventStatus;
};

export type TrainResult = {
  market: MarketEnergy;
  traderExp: number;
  gachaTickets: number;
  dividendCoins: number;
};

export type AttackPowerBreakdown = {
  baseAttack: number;
  dividendBonus: number;
  dividendUnits: number;
  totalAttack: number;
  effectName: string;
  effectDescription: string;
  bonusRate: number;
};

export type GachaDropRate = {
  monsterId: string;
  weight: number;
  rate: number;
};

export type TeamBonus = {
  name: string;
  detail: string;
  multiplier: number;
  statMultipliers: Partial<Record<keyof MonsterStats, number>>;
  offlineMultiplier: number;
  expMultiplier: number;
  dividendMultiplier: number;
  active: boolean;
};

export type TeamAttackSummary = {
  memberCount: number;
  baseAttack: number;
  multiplier: number;
  totalAttack: number;
};

export type CpuTeamMember = {
  id: string;
  name: string;
  effectName: string;
  attack: number;
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

export type MarketQuote = {
  basePrice: number;
  buyPrice: number;
  sellPrice: number;
  marketMultiplier: number;
  demandMultiplier: number;
  themeMatched: boolean;
  reason: string;
};

export const STORAGE_KEY = "kabumon:v0.1";
export const SAVE_VERSION = 5;

export const balance = {
  gachaCost: 50000,
  trainCost: 40,
  traderBaseExp: 18,
  offlineMaxHours: 12,
  offlineBaseKabuCoins: 180,
  offlineBaseDividendCoins: 22,
  offlineBaseExp: 8,
  dailyBaseKabuCoins: 5000,
  dailyBaseDividendCoins: 30,
  dailyStreakKabuBonus: 900,
  dailyStreakDividendBonus: 12,
  eventTargetScore: 820,
  logLimit: 30,
  visibleLogLimit: 20
};

export const marketPrices: Record<Rarity, number> = {
  R: 3000,
  SR: 6500,
  SSR: 14500,
  UR: 50000
};

const starterTeamIds = playableMonsters.slice(0, 3).map((monster) => monster.id);
const legacySpecialMonsterMap: Record<string, string> = {
  "toyodora": "jp-5108",
  "nintendora": "jp-3659",
  "sonic-leo": "jp-4901",
  "bank-golem": "jp-5020",
  "chip-thunder": "jp-4063",
  "medica-seraph": "jp-2413",
  "grid-wyvern": "jp-5019"
};
const legacySpecialMonsterNameMap: Record<string, string> = {
  "トヨドラ": "jp-5108",
  "ニンテンドラ": "jp-3659",
  "ソニックレオ": "jp-4901",
  "バンクゴーレム": "jp-5020",
  "チップサンダー": "jp-4063",
  "メディカセラフ": "jp-2413",
  "グリッドワイバーン": "jp-5019"
};

export function createInitialState(now = new Date()): GameState {
  const starterOwned = Object.fromEntries(
    starterTeamIds.map((id) => [id, createOwnedMonster(id, 100)])
  );

  return {
    saveVersion: SAVE_VERSION,
    playerName: "トレーダーくん",
    traderLevel: 1,
    traderExp: 0,
    gachaTickets: 0,
    kabuCoins: 80000,
    dividendCoins: 240,
    owned: starterOwned,
    team: starterTeamIds,
    buddyId: starterTeamIds[0] ?? monsters[0].id,
    lastLoginAt: now.toISOString(),
    dailyCheckinDate: null,
    loginStreak: 0,
    dailyCheckinCount: 0,
    dailyEventDate: null,
    eventCount: 0,
    currentMarket: createMarketEnergy(now),
    claimedMissionIds: [],
    logs: [
      {
        id: cryptoId(),
        date: now.toISOString(),
        title: "株モン開始",
        detail: "スターター3体がチームに入りました。",
        coins: 0,
        dividendCoins: 0,
        exp: 0,
        marketChange: 0
      }
    ],
    offlinePending: null
  };
}

export function createOwnedMonster(id: string, shares = 1): OwnedMonster {
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
    return applyOfflineReward(migrateState(JSON.parse(raw) as Partial<GameState>, now), now);
  } catch {
    return applyOfflineReward(createInitialState(now), now);
  }
}

export function serializeState(state: GameState): string {
  return JSON.stringify({
    ...state,
    saveVersion: SAVE_VERSION,
    logs: state.logs.slice(0, balance.logLimit),
    claimedMissionIds: uniqueStrings(state.claimedMissionIds)
  });
}

function migrateState(parsed: Partial<GameState>, now: Date): GameState {
  const base = createInitialState(now);
  const legacySaveVersion = normalizeNumber(parsed.saveVersion, 1, 1);
  const marketRebalanceGrant = legacySaveVersion < 4 ? 60000 : 0;
  const owned = normalizeOwned(parsed.owned);
  const normalizedOwned = ensureStarterRoster(migrateLegacySpecialOwned(Object.keys(owned).length > 0 ? owned : base.owned));
  const team = normalizeTeam(parsed.team, normalizedOwned);
  const migratedBuddyId = typeof parsed.buddyId === "string" ? mapLegacyMonsterId(parsed.buddyId) : "";
  const buddyId = migratedBuddyId && normalizedOwned[migratedBuddyId]
    ? migratedBuddyId
    : team[0] ?? starterTeamIds[0] ?? monsters[0].id;

  return {
    ...base,
    ...parsed,
    saveVersion: SAVE_VERSION,
    playerName: typeof parsed.playerName === "string" && parsed.playerName.trim()
      ? parsed.playerName
      : base.playerName,
    traderLevel: normalizeNumber(parsed.traderLevel, base.traderLevel, 1),
    traderExp: normalizeNumber(parsed.traderExp, base.traderExp, 0),
    gachaTickets: normalizeNumber(parsed.gachaTickets, base.gachaTickets, 0),
    kabuCoins: normalizeNumber(parsed.kabuCoins, base.kabuCoins, 0) + marketRebalanceGrant,
    dividendCoins: normalizeNumber(parsed.dividendCoins, base.dividendCoins, 0),
    owned: normalizedOwned,
    team,
    buddyId,
    lastLoginAt: normalizeDateString(parsed.lastLoginAt, now.toISOString()),
    dailyCheckinDate: typeof parsed.dailyCheckinDate === "string" ? parsed.dailyCheckinDate : null,
    loginStreak: normalizeNumber(parsed.loginStreak, 0, 0),
    dailyCheckinCount: normalizeNumber(parsed.dailyCheckinCount, 0, 0),
    dailyEventDate: typeof parsed.dailyEventDate === "string" ? parsed.dailyEventDate : null,
    eventCount: normalizeNumber(parsed.eventCount, 0, 0),
    currentMarket: normalizeMarketEnergy(parsed.currentMarket, now),
    logs: normalizeLogs(parsed.logs, base.logs),
    offlinePending: null,
    claimedMissionIds: uniqueStrings(parsed.claimedMissionIds)
  };
}

function normalizeOwned(rawOwned: GameState["owned"] | undefined): GameState["owned"] {
  if (!rawOwned || typeof rawOwned !== "object") return {};

  const normalized: GameState["owned"] = {};

  Object.entries(rawOwned).forEach(([rawId, raw]) => {
    const id = mapLegacyMonsterId(rawId);
    if (!monsterById.has(id)) return;

    const baseOwned = createOwnedMonster(id, normalizeNumber(raw.shares, 1, 1));
    const nextOwned = {
      ...baseOwned,
      id,
      shares: normalizeNumber(raw.shares, baseOwned.shares, 1),
      level: normalizeNumber(raw.level, baseOwned.level, 1),
      exp: normalizeNumber(raw.exp, baseOwned.exp, 0),
      stats: rawId === id ? normalizeStats(raw.stats, baseOwned.stats) : baseOwned.stats,
      locked: Boolean(raw.locked)
    };
    const existing = normalized[id];

    normalized[id] = existing
      ? {
          ...nextOwned,
          shares: existing.shares + nextOwned.shares,
          level: Math.max(existing.level, nextOwned.level),
          exp: Math.max(existing.exp, nextOwned.exp),
          locked: existing.locked || nextOwned.locked
        }
      : nextOwned;
  });

  return normalized;
}

function mapLegacyMonsterId(id: string): string {
  return legacySpecialMonsterMap[id] ?? id;
}

function replaceLegacyMonsterNames(text: string): string {
  return Object.entries(legacySpecialMonsterNameMap).reduce((nextText, [legacyName, mappedId]) => {
    const mappedName = monsterById.get(mappedId)?.name;
    return mappedName ? nextText.replaceAll(legacyName, mappedName) : nextText;
  }, text);
}

function migrateLegacySpecialOwned(owned: GameState["owned"]): GameState["owned"] {
  const migrated: GameState["owned"] = {};

  Object.values(owned).forEach((ownedMonster) => {
    const nextId = mapLegacyMonsterId(ownedMonster.id);
    if (!monsterById.has(nextId)) return;

    const normalized = createOwnedMonster(nextId, ownedMonster.shares);
    const existing = migrated[nextId];

    migrated[nextId] = existing
      ? {
          ...normalized,
          shares: existing.shares + ownedMonster.shares,
          level: Math.max(existing.level, ownedMonster.level),
          exp: Math.max(existing.exp, ownedMonster.exp),
          locked: existing.locked || ownedMonster.locked
        }
      : {
          ...normalized,
          level: ownedMonster.level,
          exp: ownedMonster.exp,
          locked: ownedMonster.locked
        };
  });

  return migrated;
}

function ensureStarterRoster(owned: GameState["owned"]): GameState["owned"] {
  const nextOwned = { ...owned };

  starterTeamIds.forEach((id) => {
    if (!nextOwned[id]) {
      nextOwned[id] = createOwnedMonster(id, 100);
    }
  });

  return nextOwned;
}

function normalizeStats(rawStats: MonsterStats | undefined, fallback: MonsterStats): MonsterStats {
  return {
    attack: normalizeNumber(rawStats?.attack, fallback.attack, 1)
  };
}

function normalizeTeam(rawTeam: string[] | undefined, owned: GameState["owned"]): string[] {
  const team = uniqueStrings(rawTeam).map(mapLegacyMonsterId)
    .filter((id) => Boolean(owned[id]))
    .slice(0, 3);

  starterTeamIds.forEach((id) => {
    if (team.length < 3 && owned[id] && !team.includes(id)) {
      team.push(id);
    }
  });

  Object.keys(owned).forEach((id) => {
    if (team.length < 3 && !team.includes(id)) {
      team.push(id);
    }
  });

  return team.slice(0, 3);
}

function normalizeMarketEnergy(rawMarket: MarketEnergy | undefined, now: Date): MarketEnergy {
  if (!rawMarket) return createMarketEnergy(now);
  const fallback = createMarketEnergy(now);
  return {
    indexName: typeof rawMarket.indexName === "string" ? rawMarket.indexName : fallback.indexName,
    change: normalizeFiniteNumber(rawMarket.change, fallback.change),
    theme: typeof rawMarket.theme === "string" ? rawMarket.theme : fallback.theme,
    source: rawMarket.source === "external-api" ? "external-api" : "game-simulated",
    updatedAt: normalizeDateString(rawMarket.updatedAt, fallback.updatedAt),
    note: typeof rawMarket.note === "string" ? rawMarket.note : fallback.note
  };
}

function normalizeLogs(rawLogs: GrowthLog[] | undefined, fallback: GrowthLog[]): GrowthLog[] {
  if (!Array.isArray(rawLogs)) return fallback;

  return rawLogs
    .filter((log) => log && typeof log.title === "string" && typeof log.detail === "string")
    .map((log) => ({
      id: typeof log.id === "string" ? log.id : cryptoId(),
      date: normalizeDateString(log.date, new Date().toISOString()),
      title: replaceLegacyMonsterNames(log.title),
      detail: replaceLegacyMonsterNames(log.detail),
      coins: normalizeFiniteNumber(log.coins, 0),
      dividendCoins: normalizeFiniteNumber(log.dividendCoins, 0),
      exp: normalizeFiniteNumber(log.exp, 0),
      marketChange: normalizeFiniteNumber(log.marketChange, 0)
    }))
    .slice(0, balance.logLimit);
}

export function applyOfflineReward(state: GameState, now = new Date()): GameState {
  return accrueOfflineReward(state, now);
}

export function accrueOfflineReward(state: GameState, now = new Date()): GameState {
  const last = new Date(state.lastLoginAt);
  const elapsedMs = Math.max(0, now.getTime() - last.getTime());
  const pendingHours = state.offlinePending?.hours ?? 0;
  const remainingHours = Math.max(0, balance.offlineMaxHours - pendingHours);
  const hours = Math.min(remainingHours, elapsedMs / 1000 / 60 / 60);

  if (remainingHours <= 0) {
    return { ...state, lastLoginAt: now.toISOString() };
  }

  if (hours < 0.05 && remainingHours >= 0.05) {
    return state;
  }

  const reward = calculateOfflineReward(state, hours);

  return {
    ...state,
    lastLoginAt: now.toISOString(),
    offlinePending: mergeOfflineRewards(state.offlinePending, reward)
  };
}

function mergeOfflineRewards(current: OfflineReward | null, added: OfflineReward): OfflineReward {
  if (!current) return added;

  return {
    hours: Math.min(balance.offlineMaxHours, round(current.hours + added.hours, 1)),
    kabuCoins: current.kabuCoins + added.kabuCoins,
    dividendCoins: current.dividendCoins + added.dividendCoins,
    exp: current.exp + added.exp
  };
}

export function calculateOfflineReward(state: GameState, hours: number): OfflineReward {
  const teamBonus = getTeamBonus(state);
  const activeTeam = state.team
    .map((id) => state.owned[id])
    .filter(Boolean);

  const teamPower = activeTeam.reduce((sum, owned) => {
    const master = monsterById.get(owned.id);
    if (!master) return sum;

    return sum + getAttackPower(owned) / 10000;
  }, 0);

  const normalizedPower = Math.max(1, teamPower) * teamBonus.offlineMultiplier;

  return {
    hours: round(hours, 1),
    kabuCoins: Math.floor(balance.offlineBaseKabuCoins * hours * normalizedPower),
    dividendCoins: Math.floor(balance.offlineBaseDividendCoins * hours * normalizedPower * teamBonus.dividendMultiplier),
    exp: Math.floor(balance.offlineBaseExp * hours * normalizedPower * teamBonus.expMultiplier)
  };
}

export function claimOfflineReward(state: GameState): GameState {
  if (!state.offlinePending) return state;

  const reward = state.offlinePending;
  const trader = addTraderExp(state, reward.exp);

  return {
    ...trader,
    kabuCoins: trader.kabuCoins + reward.kabuCoins,
    dividendCoins: trader.dividendCoins + reward.dividendCoins,
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
    ].slice(0, balance.visibleLogLimit)
  };
}

export function getDailyCheckinStatus(state: GameState, now = new Date()): DailyCheckinStatus {
  const todayKey = getLocalDateKey(now);
  const yesterdayKey = getLocalDateKey(addDays(now, -1));
  const available = state.dailyCheckinDate !== todayKey;
  const nextStreak = !available
    ? state.loginStreak
    : state.dailyCheckinDate === yesterdayKey
      ? state.loginStreak + 1
      : 1;
  const streakBonus = Math.min(6, Math.max(0, nextStreak - 1));

  return {
    available,
    todayKey,
    currentStreak: state.loginStreak,
    nextStreak,
    kabuCoins: balance.dailyBaseKabuCoins + streakBonus * balance.dailyStreakKabuBonus,
    dividendCoins: balance.dailyBaseDividendCoins + streakBonus * balance.dailyStreakDividendBonus
  };
}

export function claimDailyCheckin(state: GameState, now = new Date()): { state: GameState; ok: boolean; message: string } {
  const status = getDailyCheckinStatus(state, now);

  if (!status.available) {
    return { state, ok: false, message: "本日のログインボーナスは受け取り済みです。" };
  }

  const message = `${status.nextStreak}日目のログインボーナスを受け取りました。`;

  return {
    ok: true,
    message,
    state: {
      ...state,
      kabuCoins: state.kabuCoins + status.kabuCoins,
      dividendCoins: state.dividendCoins + status.dividendCoins,
      dailyCheckinDate: status.todayKey,
      loginStreak: status.nextStreak,
      dailyCheckinCount: state.dailyCheckinCount + 1,
      logs: [
        createLog(
          "ログインボーナス",
          message,
          status.kabuCoins,
          status.dividendCoins,
          0,
          state.currentMarket.change
        ),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function getDailyEventStatus(state: GameState, now = new Date()): DailyEventStatus {
  const todayKey = getLocalDateKey(now);
  const teamAttack = getTeamAttackSummary(state);
  const enemyTeam = createCpuTeam(state);
  const enemyBonus = getTeamBonusByIds(enemyTeam.map((member) => member.id));
  const marketModifier = clamp(1 + state.currentMarket.change * 0.035, 0.82, 1.18);
  const score = Math.floor((teamAttack.totalAttack / 350) * marketModifier);
  const rank = score >= 1250 ? "S" : score >= 920 ? "A" : score >= 650 ? "B" : "C";
  const rewardMultiplier = rank === "S" ? 1.85 : rank === "A" ? 1.35 : rank === "B" ? 1 : 0.72;
  const teamBonus = getTeamBonus(state);
  const enemyBaseAttack = enemyTeam.reduce((sum, member) => sum + member.attack, 0);
  const enemyAttack = roundToUnit(enemyBaseAttack * enemyBonus.multiplier, 100);
  const won = teamAttack.totalAttack >= enemyAttack;
  const battleRewardMultiplier = won ? 1 : 0.45;

  return {
    available: state.dailyEventDate !== todayKey,
    todayKey,
    score,
    target: balance.eventTargetScore,
    rank,
    kabuCoins: roundToUnit((7000 * rewardMultiplier + Math.max(0, score - balance.eventTargetScore) * 5.5) * battleRewardMultiplier, 10),
    dividendCoins: Math.floor((45 * rewardMultiplier + state.team.length * 8) * teamBonus.dividendMultiplier * battleRewardMultiplier),
    exp: Math.floor((22 * rewardMultiplier + state.team.length * 6) * teamBonus.expMultiplier * battleRewardMultiplier),
    teamPower: teamAttack.totalAttack,
    enemyAttack,
    enemyTeam,
    enemyTeamName: getCpuTeamName(state.currentMarket.theme),
    enemyBonusName: enemyBonus.name,
    enemyBonusDetail: enemyBonus.detail,
    enemyBonusMultiplier: enemyBonus.multiplier,
    won,
    marketModifier: round(marketModifier, 2)
  };
}

export function runDailyEvent(state: GameState, now = new Date()): DailyEventResult {
  const status = getDailyEventStatus(state, now);

  if (!status.available) {
    return {
      state,
      ok: false,
      message: "本日の市場作戦は完了済みです。",
      status
    };
  }

  const trader = addTraderExp(state, status.exp);

  const message = `市場作戦${status.won ? "勝利" : "敗北"}。味方${status.teamPower.toLocaleString("ja-JP")} vs 相手${status.enemyAttack.toLocaleString("ja-JP")}。ランク${status.rank}で報酬を獲得しました。`;

  return {
    ok: true,
    message,
    status,
    state: {
      ...trader,
      kabuCoins: trader.kabuCoins + status.kabuCoins,
      dividendCoins: trader.dividendCoins + status.dividendCoins,
      dailyEventDate: status.todayKey,
      eventCount: state.eventCount + 1,
      logs: [
        createLog(
          "市場作戦",
          message,
          status.kabuCoins,
          status.dividendCoins,
          status.exp,
          state.currentMarket.change
        ),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function rollGacha(state: GameState): { state: GameState; monsterId: string; duplicate: boolean; usedTicket: boolean } {
  const cost = balance.gachaCost;
  const usedTicket = state.gachaTickets > 0;
  if (!usedTicket && state.kabuCoins < cost) {
    return { state, monsterId: "", duplicate: false, usedTicket: false };
  }

  const monster = weightedMonster();
  const existing = state.owned[monster.id];
  const nextOwned = { ...state.owned };
  const duplicate = Boolean(existing);

  nextOwned[monster.id] = existing
    ? { ...existing, shares: existing.shares + 1 }
    : createOwnedMonster(monster.id, 1);

  const nextTeam = state.team.includes(monster.id)
    ? state.team
    : state.team.length < 3
      ? [...state.team, monster.id]
      : state.team;

  return {
    monsterId: monster.id,
    duplicate,
    usedTicket,
    state: {
      ...state,
      kabuCoins: usedTicket ? state.kabuCoins : state.kabuCoins - cost,
      gachaTickets: usedTicket ? state.gachaTickets - 1 : state.gachaTickets,
      owned: nextOwned,
      team: nextTeam,
      buddyId: state.buddyId || monster.id,
      logs: [
        createLog(
          duplicate ? "持ち株追加" : "新規入手",
          duplicate ? `${monster.name}の持ち株が1株増えました。` : `${monster.name}を図鑑に登録しました。`,
          usedTicket ? 0 : -cost,
          0,
          0,
          state.currentMarket.change
        ),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function buyMonsterFromMarket(
  state: GameState,
  monsterId: string,
  quantity = 1
): { state: GameState; ok: boolean; message: string; quantity: number; totalPrice: number } {
  const buyQuantity = Math.max(1, Math.floor(quantity));
  const monster = monsterById.get(monsterId);
  if (!monster) {
    return { state, ok: false, message: "対象の株モンが見つかりません。", quantity: buyQuantity, totalPrice: 0 };
  }

  const quote = getMarketQuote(state, monster.id);
  const totalPrice = quote.buyPrice * buyQuantity;
  if (state.kabuCoins < totalPrice) {
    return { state, ok: false, message: "カブコインが足りません。", quantity: buyQuantity, totalPrice };
  }

  const existing = state.owned[monster.id];
  const nextOwned = { ...state.owned };
  nextOwned[monster.id] = existing
    ? { ...existing, shares: existing.shares + buyQuantity }
    : createOwnedMonster(monster.id, buyQuantity);

  const nextTeam = state.team.includes(monster.id)
    ? state.team
    : state.team.length < 3
      ? [...state.team, monster.id]
      : state.team;

  const message = existing
    ? `${monster.name}を${buyQuantity}株追加購入しました。${quote.reason}`
    : `${monster.name}を${buyQuantity}株マーケットで入手しました。${quote.reason}`;

  return {
    ok: true,
    message,
    quantity: buyQuantity,
    totalPrice,
    state: {
      ...state,
      kabuCoins: state.kabuCoins - totalPrice,
      owned: nextOwned,
      team: nextTeam,
      logs: [
        createLog("マーケット購入", message, -totalPrice, 0, 0, state.currentMarket.change),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function sellMonsterUnit(
  state: GameState,
  monsterId: string,
  quantity = 1
): { state: GameState; ok: boolean; message: string; quantity: number; totalPrice: number } {
  const sellQuantity = Math.max(1, Math.floor(quantity));
  const monster = monsterById.get(monsterId);
  const owned = state.owned[monsterId];

  if (!monster || !owned) {
    return { state, ok: false, message: "売却できる株モンが見つかりません。", quantity: sellQuantity, totalPrice: 0 };
  }

  if (owned.locked) {
    return { state, ok: false, message: `${monster.name}はロック中です。`, quantity: sellQuantity, totalPrice: 0 };
  }

  if (owned.shares - sellQuantity < 1) {
    return { state, ok: false, message: "最低1株は残す必要があります。", quantity: sellQuantity, totalPrice: 0 };
  }

  const sellPrice = getMarketQuote(state, monster.id).sellPrice;
  const totalPrice = sellPrice * sellQuantity;
  const nextOwned = {
    ...state.owned,
    [monsterId]: {
      ...owned,
      shares: owned.shares - sellQuantity
    }
  };
  const message = `${monster.name}を${sellQuantity}株売却しました。`;

  return {
    ok: true,
    message,
    quantity: sellQuantity,
    totalPrice,
    state: {
      ...state,
      kabuCoins: state.kabuCoins + totalPrice,
      owned: nextOwned,
      logs: [
        createLog("株売却", message, totalPrice, 0, 0, state.currentMarket.change),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function refreshMarketEnergy(
  state: GameState,
  now = new Date(),
  market = createMarketEnergy(now)
): { state: GameState; message: string } {
  const message = `${marketSourceLabels[market.source]}を更新しました。`;

  return {
    message,
    state: {
      ...state,
      currentMarket: market,
      logs: [
        createLog(
          "市場データ更新",
          `${market.indexName} ${formatSigned(market.change)}% / ${market.theme}`,
          0,
          0,
          0,
          market.change
        ),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
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
  const teamBonus = getTeamBonus(state);

  return [
    createMission(state, {
      id: "daily-checkin",
      title: "ログインボーナス受取",
      detail: "デイリー報酬を1回受け取る",
      progress: state.dailyCheckinCount,
      target: 1,
      reward: { kabuCoins: 8000, dividendCoins: 50 }
    }),
    createMission(state, {
      id: "first-gacha",
      title: "ガチャを回す",
      detail: "銘柄ガチャで株モンを入手する",
      progress: gachaUsed ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 8000, dividendCoins: 0 }
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
      reward: { kabuCoins: 24000, dividendCoins: 0 }
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
      id: "team-bonus-active",
      title: "チーム効果を発動",
      detail: "特定タグの組み合わせでチーム効果を発動する",
      progress: teamBonus.active ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 18000, dividendCoins: 120 }
    }),
    createMission(state, {
      id: "first-event",
      title: "市場作戦に出る",
      detail: "チームで市場作戦を1回完了する",
      progress: state.eventCount,
      target: 1,
      reward: { kabuCoins: 12000, dividendCoins: 90 }
    }),
    createMission(state, {
      id: "shares-500",
      title: "持ち株500株",
      detail: "全株モンの合計持ち株を500株にする",
      progress: totalShares,
      target: 500,
      reward: { kabuCoins: 36000, dividendCoins: 150 }
    }),
    createMission(state, {
      id: "offline-claim",
      title: "放置報酬を受け取る",
      detail: "オフライン報酬を1回受け取る",
      progress: offlineClaimed ? 1 : 0,
      target: 1,
      reward: { kabuCoins: 10000, dividendCoins: 60 }
    }),
    createMission(state, {
      id: "streak-three",
      title: "3日連続ログイン",
      detail: "ログインボーナスを3日連続で受け取る",
      progress: state.loginStreak,
      target: 3,
      reward: { kabuCoins: 30000, dividendCoins: 180 }
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
      ].slice(0, balance.visibleLogLimit)
    }
  };
}

export function trainBuddy(state: GameState): { state: GameState; result: TrainResult | null } {
  const buddy = state.owned[state.buddyId];
  if (!buddy || state.dividendCoins < balance.trainCost) {
    return { state, result: null };
  }

  const market = createMarketEnergy(new Date());
  const teamBonus = getTeamBonus(state);
  const result = calculateTraining(buddy, market, teamBonus);
  const nextState = addTraderExp(
    {
      ...state,
      gachaTickets: state.gachaTickets + result.gachaTickets
    },
    result.traderExp
  );
  const rewardDetail = market.change >= 0
    ? `トレーダー経験値 +${result.traderExp}`
    : `ガチャチケット +${result.gachaTickets}`;

  return {
    result,
    state: {
      ...nextState,
      dividendCoins: nextState.dividendCoins - balance.trainCost + result.dividendCoins,
      currentMarket: market,
      logs: [
        createLog(
          "市場エネルギー反映",
          `${market.indexName} ${formatSigned(market.change)}%。${rewardDetail}。${teamBonus.active ? ` ${teamBonus.name}発動。` : ""}`,
          0,
          result.dividendCoins - balance.trainCost,
          result.traderExp,
          market.change
        ),
        ...state.logs
      ].slice(0, balance.visibleLogLimit)
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
  if (state.team.length >= 3) {
    const bestReplacement = state.team.reduce((best, _memberId, index) => {
      const nextTeam = state.team.map((memberId, memberIndex) => memberIndex === index ? id : memberId).slice(0, 3);
      const summary = getTeamAttackSummaryForIds(state, nextTeam);
      return summary.totalAttack > best.totalAttack
        ? { index, totalAttack: summary.totalAttack }
        : best;
    }, { index: 0, totalAttack: -1 });

    return {
      ...state,
      team: state.team.map((memberId, index) => index === bestReplacement.index ? id : memberId).slice(0, 3)
    };
  }
  return { ...state, team: [...state.team, id] };
}

export function getTeamBonus(state: GameState): TeamBonus {
  return getTeamBonusByIds(state.team);
}

function getTeamBonusByIds(ids: string[]): TeamBonus {
  const tags = new Set(
    ids.flatMap((id) => monsterById.get(id)?.tags ?? [])
  );

  if (tags.has("自動車") && tags.has("半導体") && (tags.has("テック") || tags.has("モビリティ"))) {
    return {
      name: "モビリティ連携",
      detail: "攻撃力+10%、トレーダー経験値+8%、放置報酬+5%",
      multiplier: 1.1,
      statMultipliers: { attack: 1.1 },
      offlineMultiplier: 1.05,
      expMultiplier: 1.08,
      dividendMultiplier: 1,
      active: true
    };
  }

  if (tags.has("ゲーム") && tags.has("エンタメ") && tags.has("クリエイティブ")) {
    return {
      name: "エンタメ連合",
      detail: "トレーダー経験値+10%、配当+3%",
      multiplier: 1.08,
      statMultipliers: {},
      offlineMultiplier: 1,
      expMultiplier: 1.1,
      dividendMultiplier: 1.03,
      active: true
    };
  }

  if (tags.has("金融") && tags.has("防御") && tags.has("配当")) {
    return {
      name: "金融防衛隊",
      detail: "放置報酬+8%、配当+12%",
      multiplier: 1.08,
      statMultipliers: {},
      offlineMultiplier: 1.08,
      expMultiplier: 1,
      dividendMultiplier: 1.12,
      active: true
    };
  }

  if (tags.has("エネルギー") && tags.has("インフラ") && tags.has("安定")) {
    return {
      name: "インフラ安定網",
      detail: "放置報酬+10%、配当+6%",
      multiplier: 1.08,
      statMultipliers: {},
      offlineMultiplier: 1.1,
      expMultiplier: 1,
      dividendMultiplier: 1.06,
      active: true
    };
  }

  if (tags.has("建設") && tags.has("インフラ") && tags.has("防御")) {
    return {
      name: "建設インフラ隊",
      detail: "攻撃力+7%、放置報酬+8%",
      multiplier: 1.07,
      statMultipliers: { attack: 1.07 },
      offlineMultiplier: 1.08,
      expMultiplier: 1,
      dividendMultiplier: 1,
      active: true
    };
  }

  if (tags.has("建設") && tags.has("不動産") && tags.has("配当")) {
    return {
      name: "建設インフラ隊",
      detail: "攻撃力+7%、放置報酬+8%",
      multiplier: 1.07,
      statMultipliers: { attack: 1.07 },
      offlineMultiplier: 1.08,
      expMultiplier: 1,
      dividendMultiplier: 1,
      active: true
    };
  }

  if (tags.has("食品") && tags.has("生活") && tags.has("安定")) {
    return {
      name: "食品安定圏",
      detail: "放置報酬+6%、配当+8%",
      multiplier: 1.04,
      statMultipliers: {},
      offlineMultiplier: 1.06,
      expMultiplier: 1,
      dividendMultiplier: 1.08,
      active: true
    };
  }

  if (tags.has("食品") && tags.has("飲料") && tags.has("配当")) {
    return {
      name: "食品安定圏",
      detail: "放置報酬+6%、配当+8%",
      multiplier: 1.04,
      statMultipliers: {},
      offlineMultiplier: 1.06,
      expMultiplier: 1,
      dividendMultiplier: 1.08,
      active: true
    };
  }

  if (tags.has("素材") && tags.has("化学") && tags.has("配当")) {
    return {
      name: "素材化学連携",
      detail: "攻撃力+6%、配当+7%",
      multiplier: 1.06,
      statMultipliers: { attack: 1.06 },
      offlineMultiplier: 1,
      expMultiplier: 1,
      dividendMultiplier: 1.07,
      active: true
    };
  }

  if (tags.has("医療") && tags.has("テック") && tags.has("成長")) {
    return {
      name: "医療テック支援",
      detail: "攻撃力+5%、トレーダー経験値+8%",
      multiplier: 1.05,
      statMultipliers: { attack: 1.05 },
      offlineMultiplier: 1,
      expMultiplier: 1.08,
      dividendMultiplier: 1,
      active: true
    };
  }

  if (tags.has("医療") && tags.has("バイオ") && tags.has("支援")) {
    return {
      name: "医療テック支援",
      detail: "攻撃力+5%、トレーダー経験値+8%",
      multiplier: 1.05,
      statMultipliers: { attack: 1.05 },
      offlineMultiplier: 1,
      expMultiplier: 1.08,
      dividendMultiplier: 1,
      active: true
    };
  }

  return {
    name: "分散チーム",
    detail: "編成中の株モンが放置報酬を支えます",
    multiplier: 1,
    statMultipliers: {},
    offlineMultiplier: 1,
    expMultiplier: 1,
    dividendMultiplier: 1,
    active: false
  };
}

export function getTeamAttackSummary(state: GameState): TeamAttackSummary {
  return getTeamAttackSummaryForIds(state, state.team);
}

export function getTeamAttackSummaryForIds(state: GameState, ids: string[]): TeamAttackSummary {
  const teamIds = ids.slice(0, 3);
  const teamBonus = getTeamBonusByIds(teamIds);
  const baseAttack = teamIds.reduce((sum, id) => {
    const owned = state.owned[id];
    return owned ? sum + getAttackPower(owned) : sum;
  }, 0);
  const multiplier = teamBonus.statMultipliers.attack ?? (teamBonus.active ? teamBonus.multiplier : 1);

  return {
    memberCount: teamIds.filter((id) => Boolean(state.owned[id])).length,
    baseAttack,
    multiplier,
    totalAttack: Math.floor(baseAttack * multiplier)
  };
}

function createCpuTeam(state: GameState): CpuTeamMember[] {
  const preferred = playableMonsters
    .filter((monster) => monster.tags.includes(state.currentMarket.theme))
    .map((monster) => monster.id);
  const candidateIds = uniqueStrings([...preferred, ...starterTeamIds, ...playableMonsters.map((monster) => monster.id)])
    .filter((id) => monsterById.has(id))
    .slice(0, 3);
  const playerAttack = Math.max(1, getTeamAttackSummary(state).totalAttack);
  const pressure = clamp(0.72 + state.traderLevel * 0.012 + Math.max(0, -state.currentMarket.change) * 0.03, 0.68, 1.08);
  const targetTotal = Math.max(280000, Math.floor(playerAttack * pressure));
  const baseTotal = candidateIds.reduce((sum, id) => {
    const monster = monsterById.get(id);
    return sum + ((monster?.sharePrice ?? 1000) * 100);
  }, 0);
  const scale = baseTotal > 0 ? targetTotal / baseTotal : 1;

  return candidateIds.map((id) => {
    const monster = monsterById.get(id);
    const baseAttack = (monster?.sharePrice ?? 1000) * 100;

    return {
      id,
      name: monster?.name ?? "CPUモン",
      effectName: monster?.effect.name ?? "通常攻撃",
      attack: roundToUnit(baseAttack * scale, 100)
    };
  });
}

function getCpuTeamName(theme: string): string {
  if (theme === "半導体") return "CPU半導体部隊";
  if (theme === "エネルギー") return "CPUインフラ部隊";
  if (theme === "モビリティ") return "CPUモビリティ隊";
  if (theme === "ゲーム") return "CPUエンタメ隊";
  return "CPUマーケット隊";
}

export function getDisplayStats(owned: OwnedMonster, teamBonus?: TeamBonus): MonsterStats {
  const baseStats = {
    attack: getAttackPower(owned)
  };

  if (!teamBonus?.active) {
    return baseStats;
  }

  return applyStatMultipliers(baseStats, teamBonus.statMultipliers);
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function calculateTraining(owned: OwnedMonster, market: MarketEnergy, teamBonus: TeamBonus): TrainResult {
  const master = monsterById.get(owned.id);
  const dividendBase = master ? baseDividendPerUnit[master.dividendType] : 15;
  const units = Math.floor(owned.shares / 100);
  const absChange = Math.abs(market.change);
  const traderExp = market.change >= 0
    ? Math.floor((balance.traderBaseExp + absChange * 10 + units * 3) * teamBonus.expMultiplier)
    : 0;
  const gachaTickets = market.change < 0 ? Math.max(1, Math.floor(absChange / 2) + 1) : 0;
  const dividendCoins = Math.floor(dividendBase * units * teamBonus.dividendMultiplier);

  return {
    market,
    traderExp,
    gachaTickets,
    dividendCoins
  };
}

function applyStatMultipliers(
  stats: MonsterStats,
  multipliers: Partial<Record<keyof MonsterStats, number>>
): MonsterStats {
  return {
    attack: Math.floor(stats.attack * (multipliers.attack ?? 1))
  };
}

function addTraderExp(state: GameState, amount: number): GameState {
  if (amount <= 0) return state;
  let traderExp = state.traderExp + amount;
  let traderLevel = state.traderLevel;
  let required = getRequiredExp(traderLevel);

  while (traderExp >= required) {
    traderExp -= required;
    traderLevel += 1;
    required = getRequiredExp(traderLevel);
  }

  return { ...state, traderExp, traderLevel };
}

export function getRequiredExp(level: number): number {
  return 80 + level * 24;
}

export function getAttackPower(owned: OwnedMonster): number {
  return getAttackPowerBreakdown(owned).totalAttack;
}

export function getAttackPowerBreakdown(owned: OwnedMonster): AttackPowerBreakdown {
  const master = monsterById.get(owned.id);
  const sharePrice = master?.sharePrice ?? Math.max(1, Math.floor((owned.stats.attack || 10000) / 100));
  const baseAttack = Math.floor(owned.shares * sharePrice);
  const units = Math.floor(owned.shares / 100);
  const bonusRate = master?.effect.attackBonusPer100Shares ?? 0;
  const dividendBonus = Math.floor(baseAttack * bonusRate * units);

  return {
    baseAttack,
    dividendBonus,
    dividendUnits: units,
    totalAttack: baseAttack + dividendBonus,
    effectName: master?.effect.name ?? "通常攻撃",
    effectDescription: master?.effect.description ?? "株価と持ち株数に応じて攻撃力が決まります。",
    bonusRate
  };
}

export function getUnitSellPrice(rarity: Rarity, level: number): number {
  return roundToUnit(marketPrices[rarity] * 0.58 + level * 60, 50);
}

export function getMarketQuote(state: GameState, monsterId: string): MarketQuote {
  const monster = monsterById.get(monsterId);

  if (!monster) {
    return {
      basePrice: 0,
      buyPrice: 0,
      sellPrice: 0,
      marketMultiplier: 1,
      demandMultiplier: 1,
      themeMatched: false,
      reason: " 価格情報なし。"
    };
  }

  const owned = state.owned[monster.id];
  return calculateMarketQuote(monster, owned, state.currentMarket);
}

export function getGachaWeight(monster: MonsterMaster): number {
  return Math.max(1, Math.sqrt(monster.issuedShares / 1_000_000));
}

export function getGachaDropRates(): GachaDropRate[] {
  const weights = playableMonsters.map((monster) => ({
    monsterId: monster.id,
    weight: getGachaWeight(monster)
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);

  return weights.map((entry) => ({
    ...entry,
    rate: totalWeight > 0 ? entry.weight / totalWeight : 0
  }));
}

function weightedMonster() {
  const rates = getGachaDropRates();
  const totalWeight = rates.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const entry of rates) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return monsterById.get(entry.monsterId) ?? monsters[0];
    }
  }

  return playableMonsters[playableMonsters.length - 1] ?? monsters[monsters.length - 1];
}

export function createMarketEnergy(date: Date): MarketEnergy {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const wave = Math.sin(seed * 12.9898) * 43758.5453;
  const normalized = wave - Math.floor(wave);
  const change = round(normalized * 7 - 3.2, 2);
  const themes = ["モビリティ", "半導体", "金融防衛", "エンタメ", "安定配当", "エネルギー"];

  return {
    indexName: "マーケット225",
    change,
    theme: themes[Math.floor(normalized * themes.length)] ?? "モビリティ",
    source: "game-simulated",
    updatedAt: date.toISOString(),
    note: "ゲーム内市場データです。"
  };
}

export function createMockExternalMarketEnergy(date = new Date()): MarketEnergy {
  const simulated = createMarketEnergy(date);
  return {
    ...simulated,
    source: "external-api",
    updatedAt: date.toISOString(),
    note: "外部市場データを反映しています。"
  };
}

function calculateMarketQuote(
  monster: MonsterMaster,
  owned: OwnedMonster | undefined,
  market: MarketEnergy
): MarketQuote {
  const basePrice = monster.sharePrice;
  const themeMatched = isThemeMatched(monster, market.theme);
  const themeMultiplier = themeMatched ? 1.08 : 0.98;
  const marketMultiplier = clamp(1 + market.change * 0.025, 0.88, 1.14);
  const ownedUnits = owned ? Math.floor(owned.shares / 100) : 0;
  const demandMultiplier = 1 + Math.min(0.18, ownedUnits * 0.018);
  const buyPrice = roundToUnit(basePrice * themeMultiplier * marketMultiplier * demandMultiplier, 1);
  const sellPrice = roundToUnit(basePrice * 0.58 * themeMultiplier * marketMultiplier, 1);
  const direction = market.change >= 0 ? "上昇" : "下落";
  const reason = themeMatched
    ? ` ${market.theme}テーマ一致・市場${direction}を反映。`
    : ` 市場${direction}とテーマ分散を反映。`;

  return {
    basePrice,
    buyPrice,
    sellPrice,
    marketMultiplier: round(themeMultiplier * marketMultiplier, 2),
    demandMultiplier: round(demandMultiplier, 2),
    themeMatched,
    reason
  };
}

function isThemeMatched(monster: MonsterMaster, theme: string): boolean {
  if (theme === "モビリティ") {
    return monster.tags.some((tag) => tag === "自動車" || tag === "モビリティ");
  }

  if (theme === "半導体") {
    return monster.tags.includes("半導体");
  }

  if (theme === "金融防衛") {
    return monster.tags.some((tag) => tag === "金融" || tag === "防御");
  }

  if (theme === "エンタメ") {
    return monster.tags.some((tag) => tag === "エンタメ" || tag === "ゲーム" || tag === "クリエイティブ");
  }

  if (theme === "安定配当") {
    return monster.tags.some((tag) => tag === "配当" || tag === "安定");
  }

  if (theme === "エネルギー") {
    return monster.tags.some((tag) => tag === "エネルギー" || tag === "インフラ");
  }

  return false;
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

function roundToUnit(value: number, unit: number): number {
  return Math.max(unit, Math.round(value / unit) * unit);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: number | undefined, fallback: number, min: number): number {
  const normalized = normalizeFiniteNumber(value, fallback);
  return Math.max(min, Math.floor(normalized));
}

function normalizeFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeDateString(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string")));
}
