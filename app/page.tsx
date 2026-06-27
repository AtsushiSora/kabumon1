"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  accrueOfflineReward,
  balance,
  buyMonsterFromMarket,
  claimDailyCheckin,
  claimDailyTaskReward,
  claimMissionReward,
  claimOfflineReward,
  claimWeeklyTaskReward,
  createInitialState,
  createTeamBattleSnapshot,
  formatSigned,
  getDailyCheckinStatus,
  getDailyEventStatus,
  getDailyTasks,
  getAttackPower,
  getAttackPowerBreakdown,
  getCpuBattlePreview,
  getDisplayStats,
  getGachaDropRates,
  getGachaWeight,
  getMarketQuote,
  getMissions,
  getRequiredExp,
  getTeamAttackSummary,
  getTeamAttackSummaryForIds,
  getTeamBonus,
  getUserBattlePreview,
  getUserBattlePreviewFromSnapshot,
  getUserBattleTicketStatus,
  getWeeklyTasks,
  hydrateState,
  marketSourceLabels,
  refreshMarketEnergy,
  rollGacha,
  runDailyEvent,
  runUserBattle,
  sellMonsterUnit,
  serializeState,
  setBuddy,
  SAVE_VERSION,
  STORAGE_KEY,
  toggleTeamMember,
  toggleMonsterLock,
  trainBuddy,
  updateAccountProfile,
  type GrowthLog,
  type GameState,
  type DailyTask,
  type WeeklyTask,
  type DailyEventResult,
  type MarketEnergy,
  type TeamBattleSnapshot,
  type TrainResult
} from "@/lib/game";
import { companyMonsterAssetDiagnostics } from "@/lib/companyMonsterAssets";
import { companyDataOverrideCount } from "@/lib/companyDataOverrides";
import { HomePanel } from "@/components/home/HomePanel";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav, type AppTab } from "@/components/layout/BottomNav";
import {
  buildBattleSnapshotPayload,
  buildPlayerProfilePayload,
  fetchBattleSnapshotLeaderboard,
  fetchBattleSnapshotFromCloud,
  getCloudSyncStatus,
  publishBattleSnapshotToCloud,
  publishPlayerProfileToCloud,
  runCloudSyncDiagnostics
} from "@/lib/cloudSync";
import { adClientId, getAdDisplayStatus, getAdSlotConfig, type AdSlotKey } from "@/lib/adConfig";
import { baseDividendPerUnit, monsterById, monsters, playableMonsters, type MonsterMaster, type MonsterStats } from "@/lib/monsters";
import { withBasePath } from "@/lib/paths";

type Tab = AppTab;

type ResultToast = {
  title: string;
  detail: string;
  tone: "gold" | "blue" | "green";
  monster?: MonsterMaster;
  metrics?: string[];
  rank?: DailyEventResult["status"]["rank"];
  score?: number;
  action?: {
    label: string;
    tab: Tab;
    buddyId?: string;
  };
};

type PurchaseUpgradeTarget = {
  monster: MonsterMaster;
  owned: NonNullable<GameState["owned"][string]>;
  quote: ReturnType<typeof getMarketQuote>;
  oneShareGain: number;
  projectedGain: number;
  projectedPower: number;
  sharesNeeded: number;
  totalPrice: number;
  affordable: boolean;
};

type CollectionFilter = "all" | "owned" | "unowned";
type MarketFilter = "all" | "affordable" | "owned" | "theme";
type CollectionSort = "recommended" | "ticker" | "attack" | "price";
type GachaSort = CollectionSort | "rate";
type MarketSort = "recommended" | "priceAsc" | "priceDesc" | "attack" | "ticker";

const BATTLE_SNAPSHOT_STORAGE_KEY = "kabumon:battle-snapshots:v1";

const teamRecipes = [
  {
    name: "モビリティ連携",
    detail: "攻撃力+10%、トレーダー経験値+8%、放置報酬+5%",
    requiredTags: ["自動車", "半導体", "テック"],
    fallbackTags: ["自動車", "半導体", "モビリティ"]
  },
  {
    name: "エンタメ連合",
    detail: "トレーダー経験値+10%、配当+3%",
    requiredTags: ["ゲーム", "エンタメ", "クリエイティブ"]
  },
  {
    name: "金融防衛隊",
    detail: "放置報酬+8%、配当+12%",
    requiredTags: ["金融", "防御", "配当"]
  },
  {
    name: "インフラ安定網",
    detail: "放置報酬+10%、配当+6%",
    requiredTags: ["エネルギー", "インフラ", "安定"]
  },
  {
    name: "建設インフラ隊",
    detail: "攻撃力+7%、放置報酬+8%",
    requiredTags: ["建設", "インフラ", "防御"],
    fallbackTags: ["建設", "不動産", "配当"]
  },
  {
    name: "食品安定圏",
    detail: "放置報酬+6%、配当+8%",
    requiredTags: ["食品", "生活", "安定"],
    fallbackTags: ["食品", "飲料", "配当"]
  },
  {
    name: "素材化学連携",
    detail: "攻撃力+6%、配当+7%",
    requiredTags: ["素材", "化学", "配当"]
  },
  {
    name: "医療テック支援",
    detail: "攻撃力+5%、トレーダー経験値+8%",
    requiredTags: ["医療", "テック", "成長"],
    fallbackTags: ["医療", "バイオ", "支援"]
  }
];

function getPurchaseUpgradeTargets(
  state: GameState,
  status: ReturnType<typeof getDailyEventStatus>
): PurchaseUpgradeTarget[] {
  const basePower = getTeamAttackSummary(state).totalAttack;
  const targetPower = status.enemyAttack;
  const missingPower = Math.max(0, targetPower - basePower);

  return state.team.slice(0, 3).flatMap((id) => {
    const monster = monsterById.get(id);
    const owned = state.owned[id];
    if (!monster || !owned) return [];

    const quote = getMarketQuote(state, monster.id);
    const oneSharePower = projectTeamPowerAfterPurchase(state, monster.id, 1);
    const oneShareGain = Math.max(1, oneSharePower - basePower);
    const sharesNeeded = missingPower > 0
      ? findSharesNeededForTargetPower(state, monster.id, targetPower, basePower)
      : 1;
    const projectedPower = projectTeamPowerAfterPurchase(state, monster.id, sharesNeeded);
    const projectedGain = Math.max(0, projectedPower - basePower);
    const totalPrice = quote.buyPrice * sharesNeeded;

    return [{
      monster,
      owned,
      quote,
      oneShareGain,
      projectedGain,
      projectedPower,
      sharesNeeded,
      totalPrice,
      affordable: state.kabuCoins >= totalPrice
    }];
  }).sort((a, b) => {
    if (status.won) {
      if (b.oneShareGain !== a.oneShareGain) return b.oneShareGain - a.oneShareGain;
      return a.totalPrice - b.totalPrice;
    }
    if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
    if (a.sharesNeeded !== b.sharesNeeded) return a.sharesNeeded - b.sharesNeeded;
    if (b.projectedGain !== a.projectedGain) return b.projectedGain - a.projectedGain;
    return a.totalPrice - b.totalPrice;
  });
}

function findSharesNeededForTargetPower(
  state: GameState,
  monsterId: string,
  targetPower: number,
  basePower: number
): number {
  if (basePower >= targetPower) return 1;

  let high = 1;
  while (high < 100_000 && projectTeamPowerAfterPurchase(state, monsterId, high) < targetPower) {
    high *= 2;
  }

  let low = Math.max(1, Math.floor(high / 2));
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (projectTeamPowerAfterPurchase(state, monsterId, mid) >= targetPower) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

function projectTeamPowerAfterPurchase(state: GameState, monsterId: string, quantity: number): number {
  const owned = state.owned[monsterId];
  if (!owned) return getTeamAttackSummary(state).totalAttack;

  const nextState: GameState = {
    ...state,
    owned: {
      ...state.owned,
      [monsterId]: {
        ...owned,
        shares: owned.shares + Math.max(1, Math.floor(quantity))
      }
    }
  };

  return getTeamAttackSummaryForIds(nextState, nextState.team).totalAttack;
}

function matchesMonsterSearch(monster: MonsterMaster, query: string): boolean {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  return [
    monster.name,
    monster.ticker,
    monster.companyAlias,
    monster.attribute,
    monster.role,
    monster.dividendType,
    monster.assetFile,
    ...monster.tags
  ].join(" ").toLowerCase().includes(keyword);
}

export default function KabumonApp() {
  const [state, setState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [gachaMessage, setGachaMessage] = useState("");
  const [marketMessage, setMarketMessage] = useState("");
  const [missionMessage, setMissionMessage] = useState("");
  const [dailyMessage, setDailyMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [eventResult, setEventResult] = useState<DailyEventResult | null>(null);
  const [resultToast, setResultToast] = useState<ResultToast | null>(null);
  const [battleSnapshots, setBattleSnapshots] = useState<TeamBattleSnapshot[]>([]);
  const [cloudBattleSnapshots, setCloudBattleSnapshots] = useState<TeamBattleSnapshot[]>([]);

  useEffect(() => {
    let savedState: string | null = null;
    try {
      savedState = window.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      savedState = null;
    }
    setState(hydrateState(savedState));
    setBattleSnapshots(loadBattleSnapshots());
    fetchBattleSnapshotLeaderboard(20)
      .then((snapshots) => setCloudBattleSnapshots(snapshots))
      .catch(() => setCloudBattleSnapshots([]));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      if (process.env.NODE_ENV !== "production") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
        return;
      }

      navigator.serviceWorker.register(withBasePath("/sw.js")).catch(() => {
        // PWA登録に失敗してもゲーム本体は通常どおり動かします。
      });
    }
  }, []);

  useEffect(() => {
    if (state) {
      try {
        window.localStorage?.setItem(STORAGE_KEY, serializeState(state));
      } catch {
        // 保存できない環境でも、ゲーム本体はメモリ上で動かします。
      }
    }
  }, [state]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>(".screen-content");
      if (screen) {
        screen.scrollTop = 0;
        screen.scrollLeft = 0;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  useEffect(() => {
    const accrue = () => {
      setState((current) => current ? accrueOfflineReward(current, new Date()) : current);
    };
    const timer = window.setInterval(accrue, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        accrue();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fallbackBuddyId = state
    ? Object.keys(state.owned).find((id) => monsterById.has(id))
    : undefined;
  const resolvedBuddyId = state && state.owned[state.buddyId] && monsterById.has(state.buddyId)
    ? state.buddyId
    : fallbackBuddyId;
  const buddy = state && resolvedBuddyId ? state.owned[resolvedBuddyId] : null;
  const buddyMaster = buddy ? monsterById.get(buddy.id) : undefined;
  const teamBonus = useMemo(() => (state ? getTeamBonus(state) : null), [state]);
  const battleLeaderboard = useMemo(
    () => mergeBattleSnapshots([...battleSnapshots, ...cloudBattleSnapshots]).slice(0, 10),
    [battleSnapshots, cloudBattleSnapshots]
  );

  if (!state || !buddy || !buddyMaster || !teamBonus) {
    return (
      <main className="app-shell">
        <div className="phone-frame loading-screen">株モン 起動中...</div>
      </main>
    );
  }

  const displayStats = getDisplayStats(buddy, teamBonus);

  function update(next: GameState) {
    setState(next);
  }

  function handleClaim() {
    const reward = state!.offlinePending;
    update(claimOfflineReward(state!));
    if (reward) {
      setResultToast({
        title: "オフライン報酬",
        detail: `${reward.hours}時間分の報酬を受け取りました。トレーダー経験値も増えました。`,
        tone: "green",
        metrics: [
          `カブコイン +${reward.kabuCoins.toLocaleString("ja-JP")}`,
          `配当 +${reward.dividendCoins}`,
          `トレーダー経験値 +${reward.exp}`
        ]
      });
    }
  }

  function handleDailyCheckin() {
    const result = claimDailyCheckin(state!);
    setDailyMessage(result.message);
    update(result.state);
    if (result.ok) {
      const status = getDailyCheckinStatus(state!);
      setResultToast({
        title: "ログインボーナス",
        detail: result.message,
        tone: "gold",
        metrics: [
          `カブコイン +${status.kabuCoins.toLocaleString("ja-JP")}`,
          `配当 +${status.dividendCoins}`
        ]
      });
    }
  }

  function handleGacha() {
    const result = rollGacha(state!);
    if (!result.monsterId) {
      setGachaMessage("チケットまたはカブコインが足りません。");
      return;
    }

    const monster = monsterById.get(result.monsterId);
    const message =
      result.duplicate
        ? `${monster?.name ?? "株モン"}が重なり、持ち株が1株増えました。`
        : `${monster?.name ?? "株モン"}を新しく入手しました。`;
    setGachaMessage(message);
    update(result.state);
    setResultToast({
      title: result.duplicate ? "持ち株追加" : "新規入手",
      detail: message,
      tone: "gold",
      monster,
      metrics: ["1株", result.usedTicket ? "チケット消費" : "カブコイン消費"],
      action: monster
        ? {
            label: "ホームで見る",
            tab: "home",
            buddyId: monster.id
          }
        : undefined
    });
  }

  function handleTrain() {
    const result = trainBuddy(state!);
    if (!result.result) {
      setTrainResult(null);
      setResultToast({
        title: "育成できません",
        detail: "配当コインが足りません。",
        tone: "blue",
        metrics: [`必要 ${balance.trainCost}`]
      });
      return;
    }
    setTrainResult(result.result);
    update(result.state);
    setResultToast({
      title: "育成結果",
      detail: `${result.result.market.indexName} ${formatSigned(result.result.market.change)}% を反映しました。`,
      tone: "blue",
      monster: buddyMaster,
      metrics: [
        result.result.traderExp > 0 ? `トレーダー経験値 +${result.result.traderExp}` : `ガチャ券 +${result.result.gachaTickets}`,
        `配当 +${result.result.dividendCoins}`
      ]
    });
  }

  function handleDailyEvent() {
    const result = runDailyEvent(state!);
    setEventResult(result);
    update(result.state);
    setResultToast({
      title: result.ok ? `市場作戦 ${result.status.won ? "勝利" : "敗北"}` : "市場作戦",
      detail: result.message,
      tone: result.ok && result.status.won ? "green" : "blue",
      rank: result.status.rank,
      score: result.status.score,
      metrics: [
        `味方 ${result.status.teamPower.toLocaleString("ja-JP")}`,
        `CPU ${result.status.enemyAttack.toLocaleString("ja-JP")}`,
        result.ok ? `C +${result.status.kabuCoins.toLocaleString("ja-JP")}` : "本日完了済み",
        result.ok ? `D +${result.status.dividendCoins}` : `ランク ${result.status.rank}`,
        result.ok ? `EXP +${result.status.exp}` : `スコア ${result.status.score}`
      ],
      action: result.ok
        ? {
            label: result.status.won ? "チーム確認" : "強化する",
            tab: result.status.won ? "team" : "market"
          }
        : undefined
    });
  }

  async function handleUserBattle(opponentCode: string) {
    const localSnapshot = findBattleSnapshot(battleSnapshots, opponentCode);
    const cloudSnapshot = localSnapshot ? null : await fetchBattleSnapshotFromCloud(opponentCode);
    const opponentSnapshot = localSnapshot ?? cloudSnapshot;
    if (cloudSnapshot) {
      setBattleSnapshots(saveBattleSnapshot(cloudSnapshot, battleSnapshots));
    }
    const result = runUserBattle(state!, opponentCode, new Date(), opponentSnapshot);
    setMissionMessage(result.message);

    if (!result.ok || !result.preview) {
      update(result.state);
      setResultToast({
        title: "ユーザー対戦",
        detail: result.message,
        tone: "blue",
        metrics: [
          result.state.userBattleTickets <= 0 ? "対戦券 0" : "コード確認",
          `本日 ${result.state.userBattleCountToday}戦`
        ]
      });
      return;
    }

    update(result.state);
    setResultToast({
      title: `ユーザー対戦 ${result.preview.won ? "勝利" : "敗北"}`,
      detail: result.message,
      tone: result.preview.won ? "green" : "blue",
      rank: result.preview.rank,
      metrics: [
        `味方 ${result.preview.playerAttack.toLocaleString("ja-JP")}`,
        `相手 ${result.preview.opponentAttack.toLocaleString("ja-JP")}`,
        result.preview.reward.label,
        result.preview.reward.policyLabel,
        `C +${result.preview.reward.kabuCoins.toLocaleString("ja-JP")}`,
        `D +${result.preview.reward.dividendCoins}`,
        `EXP +${result.preview.reward.exp}`,
        result.preview.reward.gachaTickets > 0 ? `ガチャ券 +${result.preview.reward.gachaTickets}` : "ガチャ券 +0",
        `対戦券 残り${result.state.userBattleTickets}`
      ],
      action: {
        label: result.preview.won ? "履歴を見る" : "強化する",
        tab: result.preview.won ? "event" : "market"
      }
    });
  }

  async function handlePublishBattleSnapshot() {
    const snapshot = createTeamBattleSnapshot(state!);
    const nextSnapshots = saveBattleSnapshot(snapshot, battleSnapshots);
    const cloudResult = await publishBattleSnapshotToCloud(state!, snapshot);
    const nextProfile = cloudResult.ok && !cloudResult.skipped
      ? {
          ...state!.accountProfile,
          cloudStatus: "linked" as const,
          updatedAt: new Date().toISOString()
        }
      : state!.accountProfile;
    update({
      ...state!,
      accountProfile: nextProfile,
      battleSnapshotPublishCount: state!.battleSnapshotPublishCount + 1
    });
    if (cloudResult.ok && !cloudResult.skipped) {
      fetchBattleSnapshotLeaderboard(20)
        .then((snapshots) => setCloudBattleSnapshots(snapshots))
        .catch(() => undefined);
    }
    setBattleSnapshots(nextSnapshots);
    setAccountMessage(`対戦チームを登録しました。コード: ${snapshot.syncCode} / ${cloudResult.message}`);
    setResultToast({
      title: "対戦チーム登録",
      detail: cloudResult.ok
        ? `${snapshot.ownerName}のチームを登録しました。${cloudResult.skipped ? "ローカル保存です。" : "クラウド同期済みです。"}`
        : `ローカル登録は完了しました。${cloudResult.message}`,
      tone: cloudResult.ok ? "green" : "blue",
      metrics: [
        snapshot.syncCode,
        `総攻撃力 ${snapshot.totalAttack.toLocaleString("ja-JP")}`,
        `${snapshot.members.length}体編成`,
        cloudResult.skipped ? "Local" : cloudResult.ok ? "Cloud OK" : "Cloud未完了"
      ],
      action: {
        label: "対戦へ",
        tab: "event"
      }
    });
  }

  async function handleSyncPlayerProfile() {
    const cloudResult = await publishPlayerProfileToCloud(state!);
    const nextProfile = cloudResult.ok && !cloudResult.skipped
      ? {
          ...state!.accountProfile,
          cloudStatus: "linked" as const,
          updatedAt: new Date().toISOString()
        }
      : state!.accountProfile;
    update({
      ...state!,
      accountProfile: nextProfile
    });
    setAccountMessage(cloudResult.message);
    setResultToast({
      title: "プロフィール同期",
      detail: cloudResult.message,
      tone: cloudResult.ok ? "green" : "blue",
      metrics: [
        state!.accountProfile.guestId,
        state!.accountProfile.displayName,
        cloudResult.skipped ? "Local" : cloudResult.ok ? "Cloud OK" : "Cloud未完了"
      ]
    });
  }

  async function handleCheckCloudSync() {
    const result = await runCloudSyncDiagnostics();
    if (result.ok && !result.skipped) {
      fetchBattleSnapshotLeaderboard(20)
        .then((snapshots) => setCloudBattleSnapshots(snapshots))
        .catch(() => undefined);
    }
    setAccountMessage(result.message);
    setResultToast({
      title: "クラウド接続チェック",
      detail: result.message,
      tone: result.ok ? "green" : "blue",
      metrics: [
        result.provider,
        result.configured ? "設定済み" : "未設定",
        `ランキング ${result.leaderboardCount}件`
      ]
    });
  }

  async function handleRefreshMarket() {
    const market = await fetchMarketEnergy();
    const result = market
      ? refreshMarketEnergy(state!, new Date(), market)
      : refreshMarketEnergy(state!);
    setMarketMessage(result.message);
    update(result.state);
    setResultToast({
      title: "市場データ更新",
      detail: result.message,
      tone: "blue",
      metrics: [
        result.state.currentMarket.indexName,
        `${formatSigned(result.state.currentMarket.change)}%`,
        result.state.currentMarket.theme
      ]
    });
  }

  return (
    <main className="app-shell">
      <section
        className="phone-frame"
        style={{
          "--ideal-market-icon": `url(${withBasePath("/ui/ideal-market-icon.png")})`,
          "--kabumon-logo": `url(${withBasePath("/ui/kabumon-logo-header-v2.png")})`,
          "--header-icon-coin": `url(${withBasePath("/ui/header-coin.png")})`,
          "--header-icon-gem": `url(${withBasePath("/ui/header-gem.png")})`,
          "--header-icon-avatar": `url(${withBasePath("/ui/header-avatar.png")})`
        } as CSSProperties}
      >
        <AppHeader state={state} />

        {activeTab === "home" && (
          <HomePanel
            state={state}
            buddy={buddy}
            buddyMaster={buddyMaster}
            teamBonus={teamBonus}
            onRefreshMarket={handleRefreshMarket}
            onClaimOffline={handleClaim}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "gacha" && (
          <GachaPanel
            state={state}
            message={gachaMessage}
            onGacha={handleGacha}
          />
        )}

        {activeTab === "train" && (
          <TrainPanel
            state={state}
            buddy={buddy}
            buddyMaster={buddyMaster}
            displayStats={displayStats}
            result={trainResult}
            onTrain={handleTrain}
          />
        )}

        {activeTab === "event" && (
          <EventPanel
            state={state}
            message={missionMessage}
            result={eventResult}
            onRun={handleDailyEvent}
            onRunUserBattle={handleUserBattle}
            battleSnapshots={battleSnapshots}
            battleLeaderboard={battleLeaderboard}
            onNavigate={setActiveTab}
            onClaimDailyTask={(id) => {
              const task = getDailyTasks(state).find((item) => item.id === id);
              const result = claimDailyTaskReward(state, id);
              setMissionMessage(result.message);
              update(result.state);
              if (result.ok) {
                setResultToast({
                  title: "デイリー任務",
                  detail: result.message,
                  tone: "green",
                  metrics: [
                    `カブコイン +${(task?.reward.kabuCoins ?? 0).toLocaleString("ja-JP")}`,
                    `配当 +${task?.reward.dividendCoins ?? 0}`,
                    ...(task?.reward.gachaTickets ? [`ガチャ券 +${task.reward.gachaTickets}`] : [])
                  ]
                });
              }
            }}
            onClaimWeeklyTask={(id) => {
              const task = getWeeklyTasks(state).find((item) => item.id === id);
              const result = claimWeeklyTaskReward(state, id);
              setMissionMessage(result.message);
              update(result.state);
              if (result.ok) {
                setResultToast({
                  title: "ウィークリー任務",
                  detail: result.message,
                  tone: "gold",
                  metrics: [
                    `カブコイン +${(task?.reward.kabuCoins ?? 0).toLocaleString("ja-JP")}`,
                    `配当 +${task?.reward.dividendCoins ?? 0}`,
                    ...(task?.reward.gachaTickets ? [`ガチャ券 +${task.reward.gachaTickets}`] : [])
                  ]
                });
              }
            }}
            onClaimMission={(id) => {
              const mission = getMissions(state).find((item) => item.id === id);
              const result = claimMissionReward(state, id);
              setMissionMessage(result.message);
              update(result.state);
              if (result.ok) {
                setResultToast({
                  title: "ミッション報酬",
                  detail: result.message,
                  tone: "gold",
                  metrics: [
                    `カブコイン +${(mission?.reward.kabuCoins ?? 0).toLocaleString("ja-JP")}`,
                    `配当 +${mission?.reward.dividendCoins ?? 0}`,
                    ...(mission?.reward.gachaTickets ? [`ガチャ券 +${mission.reward.gachaTickets}`] : [])
                  ]
                });
              }
            }}
          />
        )}

        {activeTab === "team" && (
          <TeamPanel
            state={state}
            onToggle={(id) => update(toggleTeamMember(state, id))}
            onBuddy={(id) => update(setBuddy(state, id))}
          />
        )}

        {activeTab === "dex" && (
          <DexPanel
            state={state}
            onBuddy={(id) => update(setBuddy(state, id))}
            onLock={(id) => update(toggleMonsterLock(state, id))}
          />
        )}

        {activeTab === "market" && (
          <MarketPanel
            state={state}
            message={marketMessage}
            onBuy={(id, quantity) => {
              const result = buyMonsterFromMarket(state, id, quantity);
              setMarketMessage(result.message);
              update(result.state);
              if (result.ok) {
                const monster = monsterById.get(id);
                setResultToast({
                  title: "マーケット購入",
                  detail: result.message,
                  tone: "gold",
                  monster,
                  metrics: [
                    `${result.quantity}株`,
                    `C -${result.totalPrice.toLocaleString("ja-JP")}`,
                    "購入完了"
                  ],
                  action: monster
                    ? {
                        label: "ホームで見る",
                        tab: "home",
                        buddyId: monster.id
                      }
                    : undefined
                });
              }
            }}
            onSell={(id, quantity) => {
              const monster = monsterById.get(id);
              if (!monster) return;
              const sellPrice = getMarketQuote(state, id).sellPrice;
              const totalPrice = sellPrice * quantity;
              if (window.confirm(`${monster.name}を${quantity}株売却しますか？\n獲得コイン: ${totalPrice.toLocaleString("ja-JP")}`)) {
                const result = sellMonsterUnit(state, id, quantity);
                setMarketMessage(result.message);
                update(result.state);
                if (result.ok) {
                  setResultToast({
                    title: "株売却",
                    detail: result.message,
                    tone: "green",
                    metrics: [
                      `${result.quantity}株`,
                      `カブコイン +${result.totalPrice.toLocaleString("ja-JP")}`
                    ]
                  });
                }
              }
            }}
            onRefreshMarket={handleRefreshMarket}
            onReset={() => {
              if (window.confirm("セーブデータを初期状態に戻しますか？")) {
                setGachaMessage("");
                setMarketMessage("");
                setMissionMessage("");
                setDailyMessage("");
                setAccountMessage("");
                setTrainResult(null);
                setEventResult(null);
                setResultToast(null);
                update(createInitialState(new Date()));
                setActiveTab("home");
              }
            }}
          />
        )}

        {activeTab === "account" && (
          <AccountPanel
            state={state}
            message={accountMessage}
            battleSnapshots={battleSnapshots}
            onPublishBattleSnapshot={handlePublishBattleSnapshot}
            onSyncPlayerProfile={handleSyncPlayerProfile}
            onCheckCloudSync={handleCheckCloudSync}
            onSaveName={(name) => {
              const result = updateAccountProfile(state, name);
              setAccountMessage(result.message);
              update(result.state);
              if (result.ok) {
                setResultToast({
                  title: "プロフィール更新",
                  detail: result.message,
                  tone: "blue",
                  metrics: [
                    result.state.accountProfile.cloudStatus === "linked" ? "クラウド連携済み" : "連携準備中",
                    result.state.accountProfile.provider === "guest" ? "ゲスト" : result.state.accountProfile.provider
                  ]
                });
              }
            }}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "policy" && (
          <PolicyPanel onNavigate={setActiveTab} />
        )}

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        {resultToast && (
          <ResultToastOverlay
            toast={resultToast}
            onClose={() => setResultToast(null)}
            onAction={(action) => {
              if (action.buddyId) {
                setState((current) => current ? setBuddy(current, action.buddyId!) : current);
              }
              setActiveTab(action.tab);
              setResultToast(null);
            }}
          />
        )}
      </section>
    </main>
  );
}

function ResultToastOverlay({
  toast,
  onClose,
  onAction
}: {
  toast: ResultToast;
  onClose: () => void;
  onAction: (action: NonNullable<ResultToast["action"]>) => void;
}) {
  return (
    <div className={`result-overlay result-${toast.tone}`} role="dialog" aria-modal="true">
      <div className="result-burst" />
      <section className="result-modal pixel-panel">
        <button className="result-close" onClick={onClose} aria-label="結果を閉じる">
          ×
        </button>
        <div className="result-title">
          <span>{toast.tone === "gold" ? "★" : toast.tone === "green" ? "✓" : "▲"}</span>
          <strong>{toast.title}</strong>
        </div>
        {toast.rank && (
          <div className={`result-rank-badge rank-${toast.rank.toLowerCase()}`}>
            <span>作戦ランク</span>
            <strong>{toast.rank}</strong>
            {typeof toast.score === "number" && <small>スコア {toast.score}</small>}
          </div>
        )}
        {toast.monster && (
          <div className="result-monster">
            <MonsterArt monster={toast.monster} />
            <div>
              <h3>{toast.monster.name}</h3>
              <p>{toast.monster.rarity} / {toast.monster.attribute}</p>
            </div>
          </div>
        )}
        <p className="result-detail">{toast.detail}</p>
        {toast.metrics && toast.metrics.length > 0 && (
          <div className="result-metrics">
            {toast.metrics.map((metric) => (
              <span key={metric}>{metric}</span>
            ))}
          </div>
        )}
        {toast.action && (
          <button className="result-action-button" onClick={() => onAction(toast.action!)}>
            {toast.action.label}
          </button>
        )}
      </section>
    </div>
  );
}
function DailyTaskPanel({
  state,
  onClaim,
  limit = 6
}: {
  state: GameState;
  onClaim: (id: string) => void;
  limit?: number;
}) {
  const allTasks = getDailyTasks(state);
  const tasks = [...allTasks]
    .sort((a, b) => {
      const priority = (task: DailyTask) => {
        if (task.completed && !task.claimed) return 0;
        if (!task.completed) return 1;
        return 2;
      };
      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.progress / b.target) - (a.progress / a.target);
    })
    .slice(0, limit);
  const claimableCount = allTasks.filter((task) => task.completed && !task.claimed).length;
  const completedCount = allTasks.filter((task) => task.completed).length;

  return (
    <section className="mission-panel daily-task-panel pixel-panel">
      <div className="mission-header">
        <div>
          <strong>デイリー任務</strong>
          <p>毎日リセットされる日課報酬</p>
        </div>
        <span>{claimableCount}件受取可</span>
      </div>
      <div className="mission-summary-strip">
        <i>受取可 <b>{claimableCount}</b></i>
        <i>達成 <b>{completedCount}</b></i>
        <i>全任務 <b>{allTasks.length}</b></i>
      </div>
      <div className="mission-list">
        {tasks.map((task) => {
          const progressPercent = Math.min(100, Math.round((task.progress / task.target) * 100));
          const rowState = task.claimed ? "claimed" : task.completed ? "completed" : "active";

          return (
            <article key={task.id} className={`mission-row ${rowState}`}>
              <div>
                <div className="mission-title-line">
                  <strong>{task.title}</strong>
                  <span>{task.claimed ? "受取済" : task.completed ? "達成" : `${progressPercent}%`}</span>
                </div>
                <p>{task.detail}</p>
                <div className="mission-progress" aria-label={`${task.title}の進捗`}>
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
                <small>{task.progress} / {task.target} ・ 報酬 {formatRewardText(task.reward)}</small>
              </div>
              <button
                disabled={!task.completed || task.claimed}
                onClick={() => onClaim(task.id)}
              >
                {task.claimed ? "済" : task.completed ? "受取" : "進行中"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WeeklyTaskPanel({
  state,
  onClaim,
  limit = 6
}: {
  state: GameState;
  onClaim: (id: string) => void;
  limit?: number;
}) {
  const allTasks = getWeeklyTasks(state);
  const tasks = [...allTasks]
    .sort((a, b) => {
      const priority = (task: WeeklyTask) => {
        if (task.completed && !task.claimed) return 0;
        if (!task.completed) return 1;
        return 2;
      };
      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.progress / b.target) - (a.progress / a.target);
    })
    .slice(0, limit);
  const claimableCount = allTasks.filter((task) => task.completed && !task.claimed).length;
  const completedCount = allTasks.filter((task) => task.completed).length;

  return (
    <section className="mission-panel weekly-task-panel pixel-panel">
      <div className="mission-header">
        <div>
          <strong>ウィークリー任務</strong>
          <p>今週の継続プレイ報酬</p>
        </div>
        <span>{claimableCount}件受取可</span>
      </div>
      <div className="mission-summary-strip">
        <i>受取可 <b>{claimableCount}</b></i>
        <i>達成 <b>{completedCount}</b></i>
        <i>全任務 <b>{allTasks.length}</b></i>
      </div>
      <div className="mission-list">
        {tasks.map((task) => {
          const progressPercent = Math.min(100, Math.round((task.progress / task.target) * 100));
          const rowState = task.claimed ? "claimed" : task.completed ? "completed" : "active";

          return (
            <article key={task.id} className={`mission-row ${rowState}`}>
              <div>
                <div className="mission-title-line">
                  <strong>{task.title}</strong>
                  <span>{task.claimed ? "受取済" : task.completed ? "達成" : `${progressPercent}%`}</span>
                </div>
                <p>{task.detail}</p>
                <div className="mission-progress" aria-label={`${task.title}の進捗`}>
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
                <small>{task.progress} / {task.target} ・ 報酬 {formatRewardText(task.reward)}</small>
              </div>
              <button
                disabled={!task.completed || task.claimed}
                onClick={() => onClaim(task.id)}
              >
                {task.claimed ? "済" : task.completed ? "受取" : "進行中"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MissionPanel({
  state,
  message,
  onClaim,
  limit = 8
}: {
  state: GameState;
  message: string;
  onClaim: (id: string) => void;
  limit?: number;
}) {
  const allMissions = getMissions(state);
  const missions = [...allMissions]
    .sort((a, b) => {
      const priority = (mission: typeof a) => {
        if (mission.completed && !mission.claimed) return 0;
        if (!mission.completed) return 1;
        return 2;
      };
      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.progress / b.target) - (a.progress / a.target);
    })
    .slice(0, limit);
  const claimableCount = allMissions.filter((mission) => mission.completed && !mission.claimed).length;
  const activeCount = allMissions.filter((mission) => !mission.completed).length;
  const completedCount = allMissions.filter((mission) => mission.completed).length;

  return (
    <section className="mission-panel pixel-panel">
      <div className="mission-header">
        <div>
          <strong>ミッション</strong>
          <p>放置・育成・編成の次の目標</p>
        </div>
        <span>{claimableCount}件受取可</span>
      </div>
      <div className="mission-summary-strip">
        <i>受取可 <b>{claimableCount}</b></i>
        <i>進行中 <b>{activeCount}</b></i>
        <i>達成 <b>{completedCount}</b></i>
      </div>
      {message && <div className="message-box compact">{message}</div>}
      <div className="mission-list">
        {missions.map((mission) => {
          const progressPercent = Math.min(100, Math.round((mission.progress / mission.target) * 100));
          const rowState = mission.claimed ? "claimed" : mission.completed ? "completed" : "active";

          return (
          <article key={mission.id} className={`mission-row ${rowState}`}>
            <div>
              <div className="mission-title-line">
                <strong>{mission.title}</strong>
                <span>{mission.claimed ? "受取済" : mission.completed ? "達成" : `${progressPercent}%`}</span>
              </div>
              <p>{mission.detail}</p>
              <div className="mission-progress" aria-label={`${mission.title}の進捗`}>
                <i style={{ width: `${progressPercent}%` }} />
              </div>
              <small>{mission.progress} / {mission.target} ・ 報酬 {formatRewardText(mission.reward)}</small>
            </div>
            <button
              disabled={!mission.completed || mission.claimed}
              onClick={() => onClaim(mission.id)}
            >
              {mission.claimed ? "済" : mission.completed ? "受取" : "進行中"}
            </button>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function formatRewardText(reward: { kabuCoins: number; dividendCoins: number; gachaTickets?: number }): string {
  return [
    reward.kabuCoins > 0 ? `C+${reward.kabuCoins.toLocaleString("ja-JP")}` : "",
    reward.dividendCoins > 0 ? `D+${reward.dividendCoins}` : "",
    (reward.gachaTickets ?? 0) > 0 ? `券+${reward.gachaTickets}` : ""
  ].filter(Boolean).join(" / ") || "なし";
}

function ListTools<T extends string, S extends string = string>({
  query,
  onQuery,
  placeholder,
  filters,
  activeFilter,
  onFilter,
  sortOptions,
  activeSort,
  onSort
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  filters: { id: T; label: string }[];
  activeFilter: T;
  onFilter: (value: T) => void;
  sortOptions?: { id: S; label: string }[];
  activeSort?: S;
  onSort?: (value: S) => void;
}) {
  return (
    <div className="list-tools">
      <label className="list-search">
        <span>検索</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          inputMode="search"
        />
      </label>
      <div className="list-filter" aria-label="表示条件">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? "active" : ""}
            onClick={() => onFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {sortOptions && activeSort && onSort && (
        <label className="list-sort">
          <span>並び替え</span>
          <select value={activeSort} onChange={(event) => onSort(event.target.value as S)}>
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function EmptyListNotice({ label }: { label: string }) {
  return (
    <div className="empty-list-notice pixel-panel">
      <strong>{label}</strong>
      <span>検索条件を変えてください</span>
    </div>
  );
}

function AdSlot({ slotKey }: { slotKey: AdSlotKey }) {
  const slot = getAdSlotConfig(slotKey);
  const status = getAdDisplayStatus(slot);

  useEffect(() => {
    if (status.mode !== "production" || !status.ready) return;

    try {
      const adsWindow = window as unknown as { adsbygoogle?: unknown[] };
      adsWindow.adsbygoogle = adsWindow.adsbygoogle ?? [];
      adsWindow.adsbygoogle.push({});
    } catch {
      // Ad blockers or script timing can fail silently without affecting gameplay.
    }
  }, [status.mode, status.ready, slot.slotId]);

  if (status.mode === "disabled") {
    return null;
  }

  if (status.mode === "production" && status.ready) {
    return (
      <aside className="ad-slot pixel-panel ad-production ready ad-rendered" aria-label={slot.label}>
        <div className="ad-slot-header">
          <span>AD</span>
          <div>
            <strong>{slot.label}</strong>
            <p>{slot.placement}</p>
          </div>
        </div>
        <ins
          className="adsbygoogle kabumon-adsense-unit"
          data-ad-client={adClientId}
          data-ad-format="auto"
          data-ad-slot={slot.slotId}
          data-full-width-responsive="true"
        />
      </aside>
    );
  }

  return (
    <aside className={`ad-slot pixel-panel ad-${status.mode} ${status.ready ? "ready" : "pending"}`} aria-label={slot.label}>
      <span>AD</span>
      <div>
        <strong>{status.title}</strong>
        <p>{status.detail}</p>
      </div>
    </aside>
  );
}

function GachaPanel({
  state,
  message,
  onGacha
}: {
  state: GameState;
  message: string;
  onGacha: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [sort, setSort] = useState<GachaSort>("recommended");
  const dropRates = getGachaDropRates();
  const dropRateById = new Map(dropRates.map((entry) => [entry.monsterId, entry.rate]));
  const dropWeightById = new Map(dropRates.map((entry) => [entry.monsterId, entry.weight]));
  const nextCostLabel = state.gachaTickets > 0
    ? `チケット ${state.gachaTickets}枚`
    : `C ${balance.gachaCost.toLocaleString("ja-JP")}`;
  const allGachaRows = playableMonsters
    .map((monster) => {
      const owned = state.owned[monster.id];
      const dropRate = dropRateById.get(monster.id) ?? 0;
      const dropWeight = dropWeightById.get(monster.id) ?? getGachaWeight(monster);
      return {
        monster,
        owned,
        dropRate,
        dropWeight,
        attack: owned ? getAttackPower(owned) : monster.sharePrice
      };
    })
    .sort((a, b) => {
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      if (b.dropRate !== a.dropRate) return b.dropRate - a.dropRate;
      return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
    });
  const gachaRows = allGachaRows
    .filter(({ monster, owned }) => {
      if (!matchesMonsterSearch(monster, query)) return false;
      if (filter === "owned") return Boolean(owned);
      if (filter === "unowned") return !owned;
      return true;
    })
    .sort((a, b) => {
      if (sort === "rate") return b.dropRate - a.dropRate;
      if (sort === "ticker") return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
      if (sort === "attack") return b.attack - a.attack;
      if (sort === "price") return a.monster.sharePrice - b.monster.sharePrice;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      if (b.dropRate !== a.dropRate) return b.dropRate - a.dropRate;
      return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
    });
  const ownedCount = allGachaRows.filter((row) => row.owned).length;
  const highestRate = allGachaRows.reduce((max, row) => Math.max(max, row.dropRate), 0);
  const lowestRate = allGachaRows.reduce((min, row) => Math.min(min, row.dropRate), Number.POSITIVE_INFINITY);
  const issuedSharesRange = allGachaRows.reduce((range, row) => ({
    min: Math.min(range.min, row.monster.issuedShares),
    max: Math.max(range.max, row.monster.issuedShares)
  }), { min: Number.POSITIVE_INFINITY, max: 0 });
  const dataSourceCounts = getCompanyDataSourceCounts(playableMonsters);
  const rateLeader = allGachaRows[0];

  const rateLeaderOwned = rateLeader ? state.owned[rateLeader.monster.id] : undefined;

  return (
    <div className="screen-content gacha-screen">
      <section className="feature-panel pixel-panel gacha-hero">
        <div>
          <h2>銘柄ガチャ</h2>
        <p>1株単位で所持数が増え、攻撃力は株価×株数で決まります。配当効果は100株ごとに強くなります。</p>
        </div>
        <div className="gacha-resource">
          <span>次回消費</span>
          <strong>{nextCostLabel}</strong>
        </div>
        <div className="gacha-summary-strip">
          <span>登録 {ownedCount}/{playableMonsters.length}</span>
          <span>最高排出 {(highestRate * 100).toFixed(1)}%</span>
          <span>{state.gachaTickets > 0 ? `券 ${state.gachaTickets}` : `C ${formatCompactAmount(state.kabuCoins)}`}</span>
        </div>
        <div className="gacha-data-strip">
          <span>推定 {dataSourceCounts.estimated}</span>
          <span>手入力 {dataSourceCounts.manual}</span>
          <span>実データ {dataSourceCounts.live}</span>
          <span>排出基準 発行株数</span>
          <span>{rateLeader ? `最大 ${rateLeader.monster.ticker}` : "最大 -"}</span>
        </div>
        <div className="gacha-rule-panel">
          <span>
            <b>入手単位</b>
            1回 = 1株
          </span>
          <span>
            <b>排出率</b>
            発行株数で調整
          </span>
          <span>
            <b>排出幅</b>
            {(Number.isFinite(lowestRate) ? lowestRate * 100 : 0).toFixed(1)}% - {(highestRate * 100).toFixed(1)}%
          </span>
          <span>
            <b>発行株数</b>
            {formatIssuedShares(issuedSharesRange.min)} - {formatIssuedShares(issuedSharesRange.max)}
          </span>
        </div>
        {rateLeader && (
          <article className="gacha-focus-card">
            <MonsterArt monster={rateLeader.monster} />
            <div>
              <span>注目候補</span>
              <strong>{rateLeader.monster.name}</strong>
              <p>{rateLeader.monster.ticker} / {rateLeader.monster.companyAlias}</p>
              <small>
                排出 {(rateLeader.dropRate * 100).toFixed(1)}% ・ 発行 {formatIssuedShares(rateLeader.monster.issuedShares)} ・ 1株攻撃 {rateLeader.monster.sharePrice.toLocaleString("ja-JP")}
                {rateLeaderOwned ? ` ・ 所持 ${rateLeaderOwned.shares}株` : " ・ 未所持"}
              </small>
            </div>
          </article>
        )}
        <ListTools
          query={query}
          onQuery={setQuery}
          placeholder="銘柄・企業名を検索"
          filters={[
            { id: "all", label: "全て" },
            { id: "owned", label: "所持" },
            { id: "unowned", label: "未所持" }
          ]}
          activeFilter={filter}
          onFilter={(value) => setFilter(value as CollectionFilter)}
          sortOptions={[
            { id: "recommended", label: "おすすめ" },
            { id: "rate", label: "排出率" },
            { id: "ticker", label: "コード" },
            { id: "attack", label: "攻撃力" },
            { id: "price", label: "株価" }
          ]}
          activeSort={sort}
          onSort={(value) => setSort(value as GachaSort)}
        />
        <button className="gold-button full" onClick={onGacha}>1回まわす</button>
        {message && <div className="message-box">{message}</div>}
      </section>
      <AdSlot slotKey="gacha" />
      <section className="grid-panel gacha-grid">
        <div className="gacha-list-header">
          <strong>排出リスト</strong>
          <span>表示 {gachaRows.length}/{playableMonsters.length}</span>
        </div>
        {gachaRows.length > 0 ? gachaRows.map(({ monster, dropRate, dropWeight }) => (
          <MonsterMiniCard key={monster.id} state={state} monster={monster} dropRate={dropRate} dropWeight={dropWeight} />
        )) : <EmptyListNotice label="条件に合う株モンがいません" />}
      </section>
    </div>
  );
}

function TrainPanel({
  state,
  buddy,
  buddyMaster,
  displayStats,
  result,
  onTrain
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  displayStats: MonsterStats;
  result: TrainResult | null;
  onTrain: () => void;
}) {
  const expRequired = getRequiredExp(state.traderLevel);
  const canTrain = state.dividendCoins >= balance.trainCost;
  const expPercent = Math.min(100, (state.traderExp / expRequired) * 100);
  const attackPower = getAttackPower(buddy);
  const teamBonus = getTeamBonus(state);
  const dividendUnits = Math.floor(buddy.shares / 100);
  const marketAbsChange = Math.abs(state.currentMarket.change);
  const previewExp = state.currentMarket.change >= 0
    ? Math.floor((balance.traderBaseExp + marketAbsChange * 10 + dividendUnits * 3) * teamBonus.expMultiplier)
    : 0;
  const previewTickets = state.currentMarket.change < 0
    ? Math.max(1, Math.floor(marketAbsChange / 2) + 1)
    : 0;
  const previewDividend = Math.floor(baseDividendPerUnit[buddyMaster.dividendType] * dividendUnits * teamBonus.dividendMultiplier);
  const previewMode = state.currentMarket.change >= 0 ? "経験値アップ" : "ガチャ券獲得";

  return (
    <div className="screen-content train-screen">
      <section
        className="train-hero pixel-panel"
        style={{ "--home-stage-bg": `url(${withBasePath("/ui/pixel-stage-bg.png")})` } as CSSProperties}
      >
        <div className="train-stage">
          <MonsterArt monster={buddyMaster} large />
        </div>
        <div className="train-control">
          <span className="train-label">トレーダー育成</span>
          <h2>{state.playerName}</h2>
          <p>{buddyMaster.name} / 攻撃力 {attackPower.toLocaleString("ja-JP")}</p>
          <div className="level-row train-level-row">
            <strong>Lv.{state.traderLevel}</strong>
            <div className="exp-bar">
              <span style={{ width: `${expPercent}%` }} />
            </div>
            <small>あと {Math.max(0, expRequired - state.traderExp)}</small>
          </div>
          <div className="train-resource-grid">
            <span>必要 D{balance.trainCost}</span>
            <span>所持 D{state.dividendCoins}</span>
            <span className={canTrain ? "positive" : "negative"}>{canTrain ? "育成可" : "配当不足"}</span>
          </div>
          <div className={`train-preview-panel ${state.currentMarket.change >= 0 ? "up" : "down"}`}>
            <span>{previewMode}</span>
            <strong>{previewExp > 0 ? `EXP +${previewExp}` : `券 +${previewTickets}`}</strong>
            <small>配当 +{previewDividend} / 単元 {dividendUnits}</small>
          </div>
          <button className="gold-button full train-main-button" onClick={onTrain} disabled={!canTrain}>
            育成する
          </button>
        </div>
      </section>

      <section className="train-market-panel pixel-panel">
        <div>
          <span>今日の市場</span>
          <strong>{state.currentMarket.indexName}</strong>
        </div>
        <div>
          <span>変動</span>
          <strong className={state.currentMarket.change >= 0 ? "positive" : "negative"}>
            {formatSigned(state.currentMarket.change)}%
          </strong>
        </div>
        <div>
          <span>テーマ</span>
          <strong>{state.currentMarket.theme}</strong>
        </div>
      </section>

      <section className="train-rule-panel pixel-panel">
        <div className={state.currentMarket.change >= 0 ? "active" : ""}>
          <span>市場上昇</span>
          <strong>トレーダー経験値</strong>
          <small>今日の予測 +{previewExp}</small>
        </div>
        <div className={state.currentMarket.change < 0 ? "active" : ""}>
          <span>市場下落</span>
          <strong>ガチャ券</strong>
          <small>今日の予測 +{previewTickets}</small>
        </div>
        <div>
          <span>100株単元</span>
          <strong>配当報酬</strong>
          <small>今日の予測 +{previewDividend}</small>
        </div>
      </section>

      <section className="result-panel train-result-panel pixel-panel">
        <div className="section-label">育成結果</div>
        <ResultTile label="トレーダー経験値" value={`+${result?.traderExp ?? 0}`} />
        <ResultTile label="ガチャ券" value={`+${result?.gachaTickets ?? 0}`} />
        <ResultTile label="配当" value={`+${result?.dividendCoins ?? 0}`} />
      </section>

      {result && (
        <section className="train-result-note pixel-panel">
          <div>
            <strong>{result.market.indexName} {formatSigned(result.market.change)}%</strong>
            <p>
              {result.market.change >= 0
                ? `上昇でトレーダー経験値 +${result.traderExp}`
                : `下落でガチャチケット +${result.gachaTickets}`}
              {" "} / 配当 +{result.dividendCoins}
            </p>
          </div>
        </section>
      )}

      <StatsPanel stats={displayStats} />
      <LogList state={state} compact />
    </div>
  );
}

function EventPanel({
  state,
  message,
  result,
  onRun,
  onRunUserBattle,
  battleSnapshots,
  battleLeaderboard,
  onNavigate,
  onClaimDailyTask,
  onClaimWeeklyTask,
  onClaimMission
}: {
  state: GameState;
  message: string;
  result: DailyEventResult | null;
  onRun: () => void;
  onRunUserBattle: (opponentCode: string) => void;
  battleSnapshots: TeamBattleSnapshot[];
  battleLeaderboard: TeamBattleSnapshot[];
  onNavigate: (tab: Tab) => void;
  onClaimDailyTask: (id: string) => void;
  onClaimWeeklyTask: (id: string) => void;
  onClaimMission: (id: string) => void;
}) {
  const ownBattleSnapshot = createTeamBattleSnapshot(state);
  const [opponentCode, setOpponentCode] = useState("");
  const savedOpponentSnapshot = findBattleSnapshot(battleSnapshots, opponentCode);
  const status = getDailyEventStatus(state);
  const battlePreview = getCpuBattlePreview(state);
  const userBattlePreview = savedOpponentSnapshot
    ? getUserBattlePreviewFromSnapshot(state, savedOpponentSnapshot)
    : getUserBattlePreview(state, opponentCode);
  const userBattleTicketStatus = getUserBattleTicketStatus(state);
  const teamBonus = getTeamBonus(state);
  const teamAttackSummary = getTeamAttackSummary(state);
  const recentBattles = state.battleHistory.slice(0, 5);
  const battleRecord = getBattleRecordSummary(state.battleHistory);
  const ownLeaderboardRankIndex = battleLeaderboard.findIndex((snapshot) => normalizeBattleCodeInput(snapshot.syncCode) === normalizeBattleCodeInput(ownBattleSnapshot.syncCode));
  const ownLeaderboardRank = ownLeaderboardRankIndex >= 0 ? `${ownLeaderboardRankIndex + 1}位` : "未登録";
  const scorePercent = Math.min(100, (status.score / status.target) * 100);
  const allyTeam = state.team.slice(0, 3).flatMap((id) => {
    const monster = monsterById.get(id);
    const owned = state.owned[id];
    if (!monster || !owned) return [];

    const attack = getAttackPower(owned);
    return [{
      monster,
      owned,
      attack,
      adjustedAttack: Math.floor(attack * teamBonus.multiplier)
    }];
  });
  const displayStatus = result?.status ?? status;
  const enemyBaseAttack = displayStatus.enemyTeam.reduce((sum, member) => sum + member.attack, 0);
  const battleTotalPower = Math.max(1, displayStatus.teamPower + displayStatus.enemyAttack);
  const allyPowerPercent = Math.max(6, Math.min(94, (displayStatus.teamPower / battleTotalPower) * 100));
  const enemyPowerPercent = Math.max(6, Math.min(94, (displayStatus.enemyAttack / battleTotalPower) * 100));
  const battleDiff = Math.abs(displayStatus.teamPower - displayStatus.enemyAttack);
  const battleRatio = displayStatus.enemyAttack > 0 ? displayStatus.teamPower / displayStatus.enemyAttack : 1;
  const winGauge = Math.max(8, Math.min(100, Math.round(battleRatio * 100)));
  const missingPower = Math.max(0, displayStatus.enemyAttack - displayStatus.teamPower);
  const growthTargets = allyTeam
    .map(({ monster }) => ({
      monster,
      gain: Math.round(monster.sharePrice * teamBonus.multiplier)
    }))
    .sort((a, b) => b.gain - a.gain);
  const bestGrowthTarget = growthTargets[0];
  const eventGuide = state.team.length < 3
    ? {
        title: "3体編成が先",
        detail: "チーム枠を埋めると総合攻撃力とチーム効果が安定します。",
        action: "チームへ",
        tab: "team" as Tab
      }
    : displayStatus.won
      ? {
          title: "作戦有利",
          detail: `余力 ${formatCompactAmount(displayStatus.teamPower - displayStatus.enemyAttack)}。今日の作戦はこのまま挑戦できます。`,
          action: "作戦開始",
          tab: "event" as Tab
        }
      : {
          title: "強化が必要",
          detail: bestGrowthTarget
            ? `不足 ${formatCompactAmount(missingPower)}。${bestGrowthTarget.monster.name}を1株増やすと約${bestGrowthTarget.gain.toLocaleString("ja-JP")}伸びます。`
            : `不足 ${formatCompactAmount(missingPower)}。まず株モンを入手してください。`,
          action: "マーケットへ",
          tab: "market" as Tab
        };
  const resultLabel = result
    ? displayStatus.won
      ? "市場作戦 勝利"
      : "市場作戦 敗北"
    : status.available
      ? "勝敗予測"
      : "本日の判定";
  const resultMessage = result
    ? result.message
    : `${displayStatus.teamPower.toLocaleString("ja-JP")} vs ${displayStatus.enemyAttack.toLocaleString("ja-JP")} / 報酬 C+${displayStatus.kabuCoins.toLocaleString("ja-JP")} D+${displayStatus.dividendCoins} EXP+${displayStatus.exp}`;
  const decisionTitle = result
    ? displayStatus.won
      ? "作戦成功"
      : "作戦失敗"
    : displayStatus.won
      ? "勝利見込み"
      : "強化推奨";
  const decisionNextAction = result
    ? displayStatus.won
      ? "報酬を受け取り、次はチーム効果を伸ばす"
      : "マーケットで攻撃力を補強する"
    : status.available
      ? "作戦開始で本日の報酬判定"
      : "明日の市場作戦を待つ";
  const resultAction = result?.ok
    ? {
        label: displayStatus.won ? "チーム確認" : "強化する",
        tab: displayStatus.won ? "team" as Tab : "market" as Tab
      }
    : null;
  const upgradeTargets = getPurchaseUpgradeTargets(state, displayStatus).slice(0, 3);
  const upgradePanelTitle = displayStatus.won ? "次の強化候補" : "勝利までの購入目安";
  const upgradePanelDetail = displayStatus.won
    ? "余力を伸ばすなら、総合攻撃力の伸びが大きい株モンから買い増しします。"
    : "不足分を埋めるために、効果込みの総合攻撃力で必要株数を試算しています。";
  const rewardItems = [
    { label: "カブコイン", value: `+${displayStatus.kabuCoins.toLocaleString("ja-JP")}`, kind: "coin" },
    { label: "配当", value: `+${displayStatus.dividendCoins}`, kind: "dividend" },
    { label: "トレーダー経験値", value: `+${displayStatus.exp}`, kind: "exp" }
  ];
  const enemyLead = displayStatus.enemyTeam[0];
  const nextActions = state.team.length < 3
    ? {
        title: "次は3体編成",
        detail: "空き枠を埋めると作戦の総合攻撃力が安定します。",
        primaryLabel: "チームへ",
        primaryTab: "team" as Tab,
        secondaryLabel: "ガチャへ",
        secondaryTab: "gacha" as Tab
      }
    : !status.available
      ? {
          title: "本日の作戦完了",
          detail: displayStatus.won
            ? "明日に備えてチーム効果か持ち株を伸ばします。"
            : "次の作戦に向けて攻撃力を補強します。",
          primaryLabel: displayStatus.won ? "チーム確認" : "マーケットへ",
          primaryTab: displayStatus.won ? "team" as Tab : "market" as Tab,
          secondaryLabel: "ホームへ",
          secondaryTab: "home" as Tab
        }
      : displayStatus.won
        ? {
            title: "作戦準備OK",
            detail: "勝利見込みです。作戦開始後は報酬を受け取り、次の育成へ進めます。",
            primaryLabel: "作戦開始",
            primaryTab: "event" as Tab,
            secondaryLabel: "チーム確認",
            secondaryTab: "team" as Tab
          }
        : {
            title: "攻撃力を補強",
            detail: upgradeTargets[0]
              ? `${upgradeTargets[0].monster.name}を買い増すと勝利に近づきます。`
              : "マーケットで1株ずつ買い増して総合攻撃力を上げます。",
            primaryLabel: "マーケットへ",
            primaryTab: "market" as Tab,
            secondaryLabel: "チームへ",
            secondaryTab: "team" as Tab
          };

  return (
    <div className="screen-content event-screen">
      <section className="feature-panel pixel-panel event-hero">
        <div>
          <h2>市場作戦</h2>
          <p>チームの総合力で1日1回の作戦に出ます。放置報酬とは別に、カブコイン、配当、トレーダー経験値を獲得できます。</p>
        </div>
        <div className={`event-rank rank-${status.rank.toLowerCase()}`}>
          <span>RANK</span>
          <strong>{status.rank}</strong>
        </div>
        <div className={`event-battle-summary ${displayStatus.won ? "won" : "lost"}`}>
          <span>{displayStatus.won ? "勝利見込み" : "戦力不足"}</span>
          <strong>{formatCompactAmount(battleDiff)}差</strong>
          <small>
            味方 {formatCompactAmount(displayStatus.teamPower)} / CPU {formatCompactAmount(displayStatus.enemyAttack)}
          </small>
        </div>
        <div className={`event-mode-panel ${battlePreview.won ? "won" : "lost"}`}>
          <span>{battlePreview.title}</span>
          <strong>{battlePreview.playerName} vs {battlePreview.opponentName}</strong>
          <p>
            非同期対戦の土台です。将来はCPUの代わりに保存済みユーザーチームと戦います。
          </p>
          <small>
            {battlePreview.playerBonusName} x{battlePreview.playerBonusMultiplier.toFixed(2)}
            {" "} / 相手 {battlePreview.opponentBonusName} x{battlePreview.opponentBonusMultiplier.toFixed(2)}
          </small>
        </div>
        <div className="user-battle-panel">
          <div className="user-battle-header">
            <span>ユーザー対戦</span>
            <strong>{ownBattleSnapshot.syncCode}</strong>
          </div>
          <div className={`user-battle-ticket-strip ${userBattleTicketStatus.canBattle ? "ready" : "empty"}`}>
            <span>対戦券</span>
            <strong>{userBattleTicketStatus.tickets} / {userBattleTicketStatus.maxTickets}</strong>
            <small>
              本日 {userBattleTicketStatus.countToday}戦 / 毎日{userBattleTicketStatus.dailyRefill}枚補充
            </small>
          </div>
          <div className={`user-battle-source ${savedOpponentSnapshot ? "saved" : "generated"}`}>
            <span>{savedOpponentSnapshot ? "登録済みチーム" : "未登録コード"}</span>
            <strong>{savedOpponentSnapshot ? savedOpponentSnapshot.ownerName : "仮想相手で予測"}</strong>
            <small>{savedOpponentSnapshot ? `${formatLogTime(savedOpponentSnapshot.createdAt)} 登録` : "クラウド連携前はコードから相手を仮生成します"}</small>
          </div>
          <label className="user-battle-input">
            <span>相手コード</span>
            <input
              value={opponentCode}
              onChange={(event) => setOpponentCode(event.target.value.toUpperCase())}
              placeholder="KBM-ABC-123"
              inputMode="text"
              maxLength={16}
            />
          </label>
          {userBattlePreview ? (
            <div className={`user-battle-preview ${userBattlePreview.won ? "won" : "lost"}`}>
              <div className="user-battle-score">
                <span>{userBattlePreview.opponentName}</span>
                <strong>
                  {formatAttackPower(userBattlePreview.playerAttack)}
                  <b>vs</b>
                  {formatAttackPower(userBattlePreview.opponentAttack)}
                </strong>
              </div>
              <small>
                {userBattlePreview.opponentBonusName} x{userBattlePreview.opponentBonusMultiplier.toFixed(2)}
                {" "} / Rank {userBattlePreview.rank}
              </small>
              <div className="user-battle-reward-line">
                <span>{userBattlePreview.reward.label}</span>
                <span>{userBattlePreview.reward.policyLabel}</span>
                <strong>C+{formatCompactAmount(userBattlePreview.reward.kabuCoins)}</strong>
                <strong>D+{userBattlePreview.reward.dividendCoins}</strong>
                <strong>EXP+{userBattlePreview.reward.exp}</strong>
                {userBattlePreview.reward.gachaTickets > 0 && <strong>券+{userBattlePreview.reward.gachaTickets}</strong>}
              </div>
              <div className="user-battle-opponent-team">
                {userBattlePreview.opponentMembers.map((member) => {
                  const monster = monsterById.get(member.id);
                  return (
                    <article key={member.id}>
                      {monster && <MonsterArt monster={monster} />}
                      <div>
                        <b>{member.name}</b>
                        <span>{member.effectName}</span>
                        <strong>{formatAttackPower(member.attack)}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="user-battle-empty">相手の対戦コードを入れると勝敗予測を表示します。</p>
          )}
          <button
            type="button"
            disabled={!userBattleTicketStatus.canBattle}
            onClick={() => onRunUserBattle(opponentCode)}
          >
            {userBattleTicketStatus.canBattle ? "対戦する" : "対戦券なし"}
          </button>
          <div className="user-battle-ranking">
            <div className="user-battle-ranking-header">
              <span>対戦ランキング</span>
              <strong>{battleLeaderboard.length}チーム</strong>
            </div>
            {battleLeaderboard.length > 0 ? (
              battleLeaderboard.map((snapshot, index) => (
                <button
                  key={snapshot.syncCode}
                  type="button"
                  className="user-battle-rank-row"
                  onClick={() => setOpponentCode(snapshot.syncCode)}
                >
                  <span>{index + 1}</span>
                  <div>
                    <b>{snapshot.ownerName}</b>
                    <small>{snapshot.syncCode} / {snapshot.teamBonusName}</small>
                  </div>
                  <strong>{formatAttackPower(snapshot.totalAttack)}</strong>
                </button>
              ))
            ) : (
              <p className="user-battle-empty">アカウント画面で対戦チームを登録するとランキングに表示されます。</p>
            )}
          </div>
        </div>
        <div className={`event-battle-formula ${displayStatus.won ? "won" : "lost"}`}>
          <span>
            <b>味方</b>
            {formatAttackPower(teamAttackSummary.baseAttack)} x{teamAttackSummary.multiplier.toFixed(2)}
            <strong>{formatAttackPower(displayStatus.teamPower)}</strong>
          </span>
          <em>{displayStatus.won ? ">=" : "<"}</em>
          <span>
            <b>CPU</b>
            {formatAttackPower(enemyBaseAttack)} x{displayStatus.enemyBonusMultiplier.toFixed(2)}
            <strong>{formatAttackPower(displayStatus.enemyAttack)}</strong>
          </span>
        </div>
        {result && (
          <div className={`event-outcome-strip ${displayStatus.won ? "won" : "lost"}`}>
            <div>
              <span>{result.ok ? "作戦結果" : "本日完了"}</span>
              <strong>{result.ok ? (displayStatus.won ? "勝利" : "敗北") : "完了済み"}</strong>
            </div>
            <p>
              C +{displayStatus.kabuCoins.toLocaleString("ja-JP")} / D +{displayStatus.dividendCoins} / トレーダー経験値 +{displayStatus.exp}
            </p>
            {resultAction && (
              <button type="button" onClick={() => onNavigate(resultAction.tab)}>
                {resultAction.label}
              </button>
            )}
          </div>
        )}
        <div className="event-power-meter" aria-label="味方とCPUの攻撃力比較">
          <i className="ally" style={{ width: `${allyPowerPercent}%` }}>
            味方
          </i>
          <i className="enemy" style={{ width: `${enemyPowerPercent}%` }}>
            CPU
          </i>
        </div>
        <div className={`event-tactical-panel ${displayStatus.won ? "won" : "lost"}`}>
          <div>
            <span>勝率目安</span>
            <strong>{winGauge}%</strong>
            <i>
              <em style={{ width: `${winGauge}%` }} />
            </i>
          </div>
          <div>
            <span>{eventGuide.title}</span>
            <p>{eventGuide.detail}</p>
          </div>
          {eventGuide.tab === "event" ? (
            <span className="event-guide-badge">{status.available ? "準備OK" : "完了済"}</span>
          ) : (
            <button type="button" onClick={() => onNavigate(eventGuide.tab)}>
              {eventGuide.action}
            </button>
          )}
        </div>
        <div className={`event-reward-summary ${displayStatus.won ? "won" : "lost"}`}>
          <header>
            <span>{result ? "獲得報酬" : "勝敗後の報酬"}</span>
            <strong>{displayStatus.won ? "通常報酬" : "敗北報酬"}</strong>
          </header>
          {rewardItems.map((item) => (
            <i key={item.kind} className={`reward-${item.kind}`}>
              <b>{item.label}</b>
              <strong>{item.value}</strong>
            </i>
          ))}
        </div>
        <div className="event-score-grid">
          <span>作戦スコア <strong>{status.score}</strong></span>
          <span>目標 <strong>{status.target}</strong></span>
          <span>味方攻撃力 <strong>{status.teamPower.toLocaleString("ja-JP")}</strong></span>
          <span>相手攻撃力 <strong>{status.enemyAttack.toLocaleString("ja-JP")}</strong></span>
          <span>市場補正 <strong>x{status.marketModifier.toFixed(2)}</strong></span>
          <span>勝敗 <strong className={status.won ? "positive" : "negative"}>{status.won ? "勝利" : "敗北"}</strong></span>
        </div>
        <div className="event-progress">
          <span style={{ width: `${scorePercent}%` }} />
        </div>
        <button className={`gold-button full event-start-button ${status.available ? "ready" : ""}`} disabled={!status.available} onClick={onRun}>
          {status.available ? "作戦開始" : "本日完了"}
        </button>
        {!result && (
          <div className="event-reward-row">
            <span>カブコイン +{status.kabuCoins.toLocaleString("ja-JP")}</span>
            <span>配当 +{status.dividendCoins}</span>
            <span>トレーダー経験値 +{status.exp}</span>
          </div>
        )}
      </section>

      <section className="feature-panel pixel-panel event-detail-panel">
        <div className="message-box compact">
          現在: {teamBonus.name} / {teamBonus.detail}
        </div>
        <div className="event-cpu-summary">
          <span>CPU敵チーム</span>
          <strong>{displayStatus.enemyTeamName}</strong>
          <p>
            主力 {enemyLead?.name ?? "CPUモン"} / 基礎 {formatAttackPower(enemyBaseAttack)} / 効果 {displayStatus.enemyBonusName}
          </p>
        </div>
        <div className="event-effect-compare">
          <span>
            <b>味方効果</b>
            <strong>{teamBonus.name}</strong>
            <small>{teamBonus.detail} / x{teamBonus.multiplier.toFixed(2)}</small>
          </span>
          <span>
            <b>CPU効果</b>
            <strong>{status.enemyBonusName}</strong>
            <small>{status.enemyBonusDetail} / x{status.enemyBonusMultiplier.toFixed(2)}</small>
          </span>
        </div>
        <div className="event-versus-panel">
          <div>
            <header>
              <strong>味方チーム</strong>
              <span>{status.teamPower.toLocaleString("ja-JP")} / x{teamBonus.multiplier.toFixed(2)}</span>
            </header>
            <div className="event-team-list">
              {allyTeam.map(({ monster, owned, attack, adjustedAttack }) => (
                <span key={monster.id}>
                  <MonsterArt monster={monster} />
                  <b>{monster.name}</b>
                  <small>{owned.shares}株 / 素 {attack.toLocaleString("ja-JP")}</small>
                  <small className="adjusted">補正後 {adjustedAttack.toLocaleString("ja-JP")}</small>
                </span>
              ))}
            </div>
          </div>
          <em>VS</em>
          <div>
            <header>
              <strong>{status.enemyTeamName}</strong>
              <span>{status.enemyAttack.toLocaleString("ja-JP")} / x{status.enemyBonusMultiplier.toFixed(2)}</span>
            </header>
            <div className="event-team-list">
              {status.enemyTeam.map((enemy) => (
                <span key={enemy.id}>
                  <MonsterArt monster={monsterById.get(enemy.id) ?? monsters[0]} />
                  <b>{enemy.name}</b>
                  <small>素 {enemy.attack.toLocaleString("ja-JP")}</small>
                  <small className="adjusted">
                    補正後 {Math.floor(enemy.attack * status.enemyBonusMultiplier).toLocaleString("ja-JP")}
                  </small>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={`event-result-card ${displayStatus.won ? "won" : "lost"} ${result ? "settled" : "preview"}`}>
          <span>{displayStatus.won ? "WIN" : "LOSE"}</span>
          <div>
            <strong>{resultLabel}</strong>
            <p>{resultMessage}</p>
          </div>
        </div>
        <div className={`event-decision-panel ${displayStatus.won ? "won" : "lost"} ${result ? "settled" : "preview"}`}>
          <div>
            <span>判定</span>
            <strong>{decisionTitle}</strong>
          </div>
          <div>
            <span>戦力差</span>
            <strong>{displayStatus.won ? "+" : "-"}{formatCompactAmount(battleDiff)}</strong>
          </div>
          <div>
            <span>獲得予定</span>
            <strong>C{formatCompactAmount(displayStatus.kabuCoins)} / D{displayStatus.dividendCoins}</strong>
          </div>
          <p>{decisionNextAction}</p>
        </div>
        <div className={`event-next-action-panel ${displayStatus.won ? "won" : "lost"}`}>
          <div>
            <span>次の一手</span>
            <strong>{nextActions.title}</strong>
            <p>{nextActions.detail}</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (nextActions.primaryTab === "event") {
                onRun();
              } else {
                onNavigate(nextActions.primaryTab);
              }
            }}
            disabled={nextActions.primaryTab === "event" && !status.available}
          >
            {nextActions.primaryLabel}
          </button>
          <button type="button" onClick={() => onNavigate(nextActions.secondaryTab)}>
            {nextActions.secondaryLabel}
          </button>
        </div>
        <div className={`event-upgrade-panel ${displayStatus.won ? "won" : "lost"}`}>
          <header>
            <div>
              <strong>{upgradePanelTitle}</strong>
              <small>{upgradePanelDetail}</small>
            </div>
            <button type="button" onClick={() => onNavigate("market")}>マーケットへ</button>
          </header>
          <div className="event-upgrade-list">
            {upgradeTargets.map((target) => (
              <article key={target.monster.id}>
                <MonsterArt monster={target.monster} />
                <div>
                  <b>{target.monster.name}</b>
                  <span>
                    1株 +{target.oneShareGain.toLocaleString("ja-JP")}
                    {target.sharesNeeded > 1 ? ` / 合計 +${formatAttackPower(target.projectedGain)}` : ""}
                  </span>
                </div>
                <p>
                  {displayStatus.won
                    ? `1株 C${formatCompactAmount(target.quote.buyPrice)}`
                    : `${target.sharesNeeded}株 C${formatCompactAmount(target.totalPrice)}`}
                </p>
                <em className={target.affordable ? "positive" : ""}>
                  {target.affordable ? "購入可" : `不足 C${formatCompactAmount(Math.max(0, target.totalPrice - state.kabuCoins))}`}
                </em>
              </article>
            ))}
          </div>
        </div>
        {result && (
          <div className="event-loot-panel">
            <div>
              <b>C</b>
              <span>カブコイン</span>
              <strong>+{result.status.kabuCoins.toLocaleString("ja-JP")}</strong>
            </div>
            <div>
              <b>D</b>
              <span>配当</span>
              <strong>+{result.status.dividendCoins}</strong>
            </div>
            <div>
              <b>EXP</b>
              <span>トレーダー経験値</span>
              <strong>+{result.status.exp}</strong>
            </div>
          </div>
        )}
      </section>

      <section className="event-record-panel pixel-panel">
        <header>
          <div>
            <strong>対戦戦績</strong>
            <p>ユーザー対戦とCPU戦の成績</p>
          </div>
          <span>{battleRecord.totalBattles}戦</span>
        </header>
        <div className="event-record-grid">
          <div>
            <span>勝率</span>
            <strong>{battleRecord.winRate}%</strong>
            <small>{battleRecord.totalWins}勝 / {battleRecord.totalLosses}敗</small>
          </div>
          <div>
            <span>ユーザー戦</span>
            <strong>{battleRecord.userWinRate}%</strong>
            <small>{battleRecord.userWins}勝 / {battleRecord.userBattles}戦</small>
          </div>
          <div>
            <span>最高Rank</span>
            <strong>{battleRecord.bestRank}</strong>
            <small>直近 {battleRecord.latestResult}</small>
          </div>
          <div>
            <span>総攻撃力順位</span>
            <strong>{ownLeaderboardRank}</strong>
            <small>{ownBattleSnapshot.syncCode}</small>
          </div>
        </div>
        <div className="event-record-rewards">
          <span>C +{battleRecord.kabuCoins.toLocaleString("ja-JP")}</span>
          <span>D +{battleRecord.dividendCoins.toLocaleString("ja-JP")}</span>
          <span>EXP +{battleRecord.exp.toLocaleString("ja-JP")}</span>
          <span>券 +{battleRecord.gachaTickets.toLocaleString("ja-JP")}</span>
        </div>
      </section>

      {recentBattles.length > 0 && (
        <section className="event-history-panel pixel-panel">
          <header>
            <div>
              <strong>対戦履歴</strong>
              <p>非同期対戦の保存データ</p>
            </div>
            <span>{recentBattles.length}件</span>
          </header>
          <div className="event-history-list">
            {recentBattles.map((battle) => (
              <article key={battle.id} className={battle.won ? "won" : "lost"}>
                <span>{battle.mode === "cpu" ? "CPU" : "USER"}</span>
                <div>
                  <b>{battle.opponentName}</b>
                  <small>{formatLogTime(battle.date)} / Rank {battle.rank}</small>
                </div>
                <strong>{battle.won ? "WIN" : "LOSE"}</strong>
                <em>
                  {formatCompactAmount(battle.playerAttack)} vs {formatCompactAmount(battle.opponentAttack)}
                  {battle.gachaTickets > 0 ? ` / 券+${battle.gachaTickets}` : ""}
                </em>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid-panel event-ally-grid">
        {state.team.map((id) => {
          const monster = monsterById.get(id);
          const owned = state.owned[id];
          if (!monster || !owned) return null;

          return (
            <article key={id} className="mini-card pixel-panel selected">
              <MonsterArt monster={monster} />
              <h3>{monster.name}</h3>
              <p>{owned.shares}株 / 攻撃力 {getAttackPower(owned).toLocaleString("ja-JP")}</p>
              <strong>{monster.role}</strong>
            </article>
          );
        })}
      </section>

      <DailyTaskPanel state={state} onClaim={onClaimDailyTask} limit={4} />

      <WeeklyTaskPanel state={state} onClaim={onClaimWeeklyTask} limit={4} />

      <MissionPanel state={state} message={message} onClaim={onClaimMission} limit={4} />

      <LogList state={state} limit={3} />
    </div>
  );
}

function TeamPanel({
  state,
  onToggle,
  onBuddy
}: {
  state: GameState;
  onToggle: (id: string) => void;
  onBuddy: (id: string) => void;
}) {
  const teamBonus = getTeamBonus(state);
  const teamAttackSummary = getTeamAttackSummary(state);
  const teamSlots = Array.from({ length: 3 }, (_, index) => {
    const id = state.team[index];
    const owned = id ? state.owned[id] : undefined;
    const monster = id ? monsterById.get(id) : undefined;
    return owned && monster ? { owned, monster } : null;
  });
  const teamTags = new Set(
    state.team.flatMap((id) => monsterById.get(id)?.tags ?? [])
  );
  const teamCandidateSource = Array.from(
    new Set([...state.team, ...Object.keys(state.owned), ...playableMonsters.map((monster) => monster.id)])
  ).flatMap((id) => {
    const monster = monsterById.get(id);
    return monster ? [monster] : [];
  });
  const recipeStatuses = teamRecipes.map((recipe) => {
    const primaryMatched = recipe.requiredTags.filter((tag) => teamTags.has(tag));
    const fallbackMatched = recipe.fallbackTags?.filter((tag) => teamTags.has(tag)) ?? [];
    const useFallback = fallbackMatched.length > primaryMatched.length;
    const targetTags = useFallback && recipe.fallbackTags ? recipe.fallbackTags : recipe.requiredTags;
    const matchedTags = targetTags.filter((tag) => teamTags.has(tag));
    const missingTags = targetTags.filter((tag) => !teamTags.has(tag));
    const matchedCount = matchedTags.length;
    const isActive = teamBonus.name === recipe.name;
    const ownedCandidates = missingTags.length > 0
      ? teamCandidateSource
          .filter((monster) => state.owned[monster.id] && !state.team.includes(monster.id))
          .map((monster) => {
            const owned = state.owned[monster.id];
            const tagHits = monster.tags.filter((tag) => missingTags.includes(tag)).length;
            return {
              id: monster.id,
              name: monster.name,
              tagHits,
              attack: owned ? getAttackPower(owned) : 0
            };
          })
          .filter((candidate) => candidate.tagHits > 0)
          .sort((a, b) => {
            if (b.tagHits !== a.tagHits) return b.tagHits - a.tagHits;
            if (b.attack !== a.attack) return b.attack - a.attack;
            return a.name.localeCompare(b.name, "ja");
          })
          .slice(0, 2)
      : [];

    return {
      ...recipe,
      matchedCount,
      matchedTags,
      missingTags,
      ownedCandidates,
      isActive
    };
  });
  const bestRecipe = [...recipeStatuses].sort((a, b) => {
    if (Number(b.isActive) !== Number(a.isActive)) return Number(b.isActive) - Number(a.isActive);
    return b.matchedCount - a.matchedCount;
  })[0];
  const projectTeamChange = (monsterId: string) => {
    if (state.team.includes(monsterId)) {
      const nextTeam = state.team.filter((id) => id !== monsterId);
      const summary = getTeamAttackSummaryForIds(state, nextTeam);
      return {
        nextTeam,
        replacedId: "",
        summary,
        gain: summary.totalAttack - teamAttackSummary.totalAttack
      };
    }

    if (state.team.length < 3) {
      const nextTeam = [...state.team, monsterId].slice(0, 3);
      const summary = getTeamAttackSummaryForIds(state, nextTeam);
      return {
        nextTeam,
        replacedId: "",
        summary,
        gain: summary.totalAttack - teamAttackSummary.totalAttack
      };
    }

    return state.team.reduce((best, replacedId, index) => {
      const nextTeam = state.team.map((id, memberIndex) => memberIndex === index ? monsterId : id).slice(0, 3);
      const summary = getTeamAttackSummaryForIds(state, nextTeam);
      const gain = summary.totalAttack - teamAttackSummary.totalAttack;
      return gain > best.gain
        ? { nextTeam, replacedId, summary, gain }
        : best;
    }, {
      nextTeam: state.team,
      replacedId: state.team[0] ?? "",
      summary: teamAttackSummary,
      gain: Number.NEGATIVE_INFINITY
    });
  };
  const candidateRows = teamCandidateSource
    .map((monster) => {
      const owned = state.owned[monster.id];
      const inTeam = state.team.includes(monster.id);
      const attack = owned ? getAttackPower(owned) : 0;
      const projection = owned ? projectTeamChange(monster.id) : null;
      const projectedBonus = projection ? getTeamBonus({ ...state, team: projection.nextTeam }) : null;
      return {
        monster,
        owned,
        inTeam,
        attack,
        projection,
        projectedBonus
      };
    })
    .sort((a, b) => {
      if (a.inTeam !== b.inTeam) return a.inTeam ? -1 : 1;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      if ((b.projection?.gain ?? -Infinity) !== (a.projection?.gain ?? -Infinity)) {
        return (b.projection?.gain ?? -Infinity) - (a.projection?.gain ?? -Infinity);
      }
      if (b.attack !== a.attack) return b.attack - a.attack;
      return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
    });
  const bestBenchRow = candidateRows.find((row) => row.owned && !row.inTeam) ?? null;
  const replacementGain = bestBenchRow?.projection?.gain ?? 0;
  const replacedMonster = bestBenchRow?.projection?.replacedId
    ? monsterById.get(bestBenchRow.projection.replacedId)
    : null;
  const suggestion = state.team.length < 3 && bestBenchRow
    ? {
        title: "空き枠に編成",
        detail: `${bestBenchRow.monster.name}を入れると総合攻撃力 ${formatAttackPower(bestBenchRow.projection?.summary.totalAttack ?? teamAttackSummary.totalAttack)} になります。`,
        action: "編成する",
        targetId: bestBenchRow.monster.id,
        positive: true
      }
    : bestBenchRow && replacedMonster && replacementGain > 0
      ? {
          title: "おすすめ入替",
          detail: `${replacedMonster.name} → ${bestBenchRow.monster.name} で総合攻撃力 +${formatAttackPower(replacementGain)}`,
          action: "入替する",
          targetId: bestBenchRow.monster.id,
          positive: true
        }
      : {
          title: "現チーム優先",
          detail: "攻撃力だけなら現在の3体が有利です。効果狙いなら下の候補からタグを見て入れ替えてください。",
          action: "候補確認",
          targetId: "",
          positive: false
        };
  const teamEffectRows = teamSlots.flatMap((slot) => {
    if (!slot) return [];
    const baseAttack = getAttackPower(slot.owned);
    return [{
      id: slot.monster.id,
      name: slot.monster.name,
      effect: slot.monster.effect.name,
      shares: slot.owned.shares,
      baseAttack,
      adjustedAttack: Math.floor(baseAttack * teamAttackSummary.multiplier)
    }];
  });
  const candidateInsightRows = candidateRows
    .filter((row) => row.owned && !row.inTeam && row.projection)
    .map((row) => {
      const projectedGain = row.projection?.gain ?? 0;
      const projectedBonus = row.projectedBonus;
      const effectChanged = Boolean(projectedBonus && projectedBonus.name !== teamBonus.name);
      return {
        ...row,
        projectedGain,
        effectChanged,
        replacedMonster: row.projection?.replacedId ? monsterById.get(row.projection.replacedId) : null
      };
    });
  const recommendedCandidates = candidateInsightRows
    .filter((row) => row.projectedGain > 0 || row.effectChanged)
    .sort((a, b) => {
      if (Number(b.projectedGain > 0) !== Number(a.projectedGain > 0)) {
        return Number(b.projectedGain > 0) - Number(a.projectedGain > 0);
      }
      if (b.projectedGain !== a.projectedGain) return b.projectedGain - a.projectedGain;
      return Number(b.effectChanged) - Number(a.effectChanged);
    })
    .slice(0, 3);
  const positiveCandidateCount = candidateInsightRows.filter((row) => row.projectedGain > 0).length;
  const effectChangeCandidateCount = candidateInsightRows.filter((row) => row.effectChanged).length;
  const ownedCandidateRows = candidateRows.filter((row) => row.owned);

  return (
    <div className="screen-content team-screen">
      <section className="feature-panel pixel-panel team-hero">
        <h2>チーム編成</h2>
        <p>3体でチームを組み、効果反映後の総合攻撃力で勝敗を決めます。</p>
        <div className="message-box">現在: {teamBonus.name} / {teamBonus.detail}</div>
        <div className="team-power-readout">
          <div>
            <span>総合攻撃力</span>
            <strong>{teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</strong>
          </div>
          <i>
            基礎 {teamAttackSummary.baseAttack.toLocaleString("ja-JP")}
            <b>x{teamAttackSummary.multiplier.toFixed(2)}</b>
          </i>
        </div>
        <div className="team-battle-rule">
          <span>
            <b>1</b>
            3体の攻撃力を合計
          </span>
          <span>
            <b>2</b>
            チーム効果を反映
          </span>
          <span>
            <b>3</b>
            CPU以上なら勝利
          </span>
        </div>
        <div className="team-bonus-grid">
          <span>編成 {teamAttackSummary.memberCount}/3</span>
          <span>総合攻撃力 {teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</span>
          <span>放置 x{teamBonus.offlineMultiplier.toFixed(2)}</span>
          <span>トレーダー経験値 x{teamBonus.expMultiplier.toFixed(2)}</span>
          <span>配当 x{teamBonus.dividendMultiplier.toFixed(2)}</span>
        </div>
      </section>
      <section className="team-slots-panel pixel-panel">
        <div className="team-slots-header">
          <strong>現在の3体チーム</strong>
          <span>総合攻撃力 {teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</span>
        </div>
        <div className="team-slots-grid">
          {teamSlots.map((slot, index) => (
            <article key={slot?.monster.id ?? `slot-${index}`} className={`team-slot-card ${slot ? "" : "empty"}`}>
              {slot ? (
                <>
                  <MonsterArt monster={slot.monster} />
                  <div>
                    <h3>{slot.monster.name}</h3>
                    <p>{slot.monster.effect.name}</p>
                    <strong>{getAttackPower(slot.owned).toLocaleString("ja-JP")}</strong>
                    <small>補正後 {Math.floor(getAttackPower(slot.owned) * teamAttackSummary.multiplier).toLocaleString("ja-JP")}</small>
                  </div>
                </>
              ) : (
                <>
                  <span className="team-slot-empty-icon">+</span>
                  <div>
                    <h3>空き枠 {index + 1}</h3>
                    <p>株モンを編成</p>
                    <strong>0</strong>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className={`team-suggestion-panel pixel-panel ${suggestion.positive ? "positive" : ""}`}>
        <div>
          <span>チーム判断</span>
          <strong>{suggestion.title}</strong>
          <p>{suggestion.detail}</p>
        </div>
        <button disabled={!suggestion.targetId} onClick={() => suggestion.targetId && onToggle(suggestion.targetId)}>
          {suggestion.action}
        </button>
      </section>
      <section className={`team-effect-panel pixel-panel ${teamBonus.active ? "active" : ""}`}>
        <div className="team-effect-header">
          <div>
            <span>発動中の効果</span>
            <strong>{teamBonus.name}</strong>
            <p>{teamBonus.detail}</p>
          </div>
          <i>{teamBonus.active ? "発動中" : "未発動"}</i>
        </div>
        <div className="team-effect-formula">
          <span>基礎攻撃力 <b>{teamAttackSummary.baseAttack.toLocaleString("ja-JP")}</b></span>
          <span>攻撃補正 <b>x{teamAttackSummary.multiplier.toFixed(2)}</b></span>
          <span>総合攻撃力 <b>{teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</b></span>
        </div>
        <div className="team-effect-member-list">
          {teamEffectRows.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.effect} / {row.shares}株</span>
              </div>
              <p>
                {row.baseAttack.toLocaleString("ja-JP")}
                <b>{row.adjustedAttack.toLocaleString("ja-JP")}</b>
              </p>
            </article>
          ))}
          {teamEffectRows.length === 0 && (
            <article className="empty">
              <div>
                <strong>未編成</strong>
                <span>3体を編成すると効果が計算されます</span>
              </div>
              <p>0<b>0</b></p>
            </article>
          )}
        </div>
      </section>
      <section className="team-recommend-panel pixel-panel">
        <div className="team-recommend-header">
          <div>
            <span>入替候補</span>
            <strong>おすすめ候補</strong>
          </div>
          <p>
            攻撃力UP {positiveCandidateCount}
            <b>効果変化 {effectChangeCandidateCount}</b>
          </p>
        </div>
        <div className="team-recommend-list">
          {recommendedCandidates.length > 0 ? recommendedCandidates.map((row) => {
            const projectedTotal = row.projection?.summary.totalAttack ?? teamAttackSummary.totalAttack;
            return (
              <article key={row.monster.id} className={row.projectedGain > 0 ? "positive" : ""}>
                <MonsterArt monster={row.monster} />
                <div>
                  <strong>{row.monster.name}</strong>
                  <span>
                    {row.replacedMonster ? `${row.replacedMonster.name}と入替` : "空き枠へ編成"}
                  </span>
                  <small>
                    総合 {formatAttackPower(projectedTotal)}
                    {row.projectedGain !== 0 ? ` / ${row.projectedGain > 0 ? "+" : ""}${formatAttackPower(row.projectedGain)}` : ""}
                  </small>
                  {row.effectChanged && row.projectedBonus && (
                    <small className="positive">効果: {row.projectedBonus.name}</small>
                  )}
                </div>
                <button onClick={() => onToggle(row.monster.id)}>
                  {row.projectedGain > 0 ? "入替" : "効果狙い"}
                </button>
              </article>
            );
          }) : (
            <article className="empty">
              <div>
                <strong>今の3体が安定</strong>
                <span>攻撃力を伸ばすにはマーケットで買い増し</span>
                <small>所持株を増やすと候補が変わります</small>
              </div>
            </article>
          )}
        </div>
      </section>
      <section className="team-recipe-panel pixel-panel">
        <div className="team-recipe-header">
          <strong>おすすめ効果</strong>
          <span>{bestRecipe.isActive ? "発動中" : `${bestRecipe.matchedCount}/3`}</span>
        </div>
        <div className="team-recipe-list">
          {recipeStatuses.map((recipe) => (
            <article key={recipe.name} className={recipe.isActive ? "active" : ""}>
              <div>
                <strong>{recipe.name}</strong>
                <p>{recipe.detail}</p>
                <div className="team-recipe-tags">
                  {recipe.matchedTags.map((tag) => (
                    <i key={`${recipe.name}-${tag}`} className="matched">{tag}</i>
                  ))}
                  {recipe.missingTags.map((tag) => (
                    <i key={`${recipe.name}-${tag}`}>{tag}</i>
                  ))}
                </div>
                <small>
                  {recipe.isActive
                    ? "発動条件を満たしています"
                    : recipe.ownedCandidates.length > 0
                      ? `候補: ${recipe.ownedCandidates.map((candidate) => candidate.name).join(" / ")}`
                      : "候補はガチャ・マーケットで入手"}
                </small>
              </div>
              <div className="team-recipe-action">
                <span>{recipe.isActive ? "発動中" : `${recipe.matchedCount}/3`}</span>
                {!recipe.isActive && recipe.ownedCandidates[0] && (
                  <button onClick={() => onToggle(recipe.ownedCandidates[0].id)}>
                    候補編成
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="grid-panel team-candidate-grid">
        <div className="team-candidate-list-header">
          <strong>所持株モン一覧</strong>
          <span>所持 {ownedCandidateRows.length} / 攻撃UP {positiveCandidateCount}</span>
        </div>
        <div className="team-candidate-summary-strip">
          <span>編成中 <b>{teamAttackSummary.memberCount}</b></span>
          <span>入替候補 <b>{positiveCandidateCount}</b></span>
          <span>効果変化 <b>{effectChangeCandidateCount}</b></span>
        </div>
        {ownedCandidateRows.map(({ monster, owned, inTeam, attack, projection, projectedBonus }) => {
          if (!owned) return null;
          const projectedGain = projection?.gain ?? 0;
          const projectedTotal = projection?.summary.totalAttack ?? teamAttackSummary.totalAttack;
          const replacedName = projection?.replacedId ? monsterById.get(projection.replacedId)?.name : "";
          const effectChanged = projectedBonus && projectedBonus.name !== teamBonus.name;
          const actionLabel = inTeam
            ? "外す"
            : state.team.length >= 3 && projectedGain > 0
              ? `+${formatAttackPower(projectedGain)}`
              : state.team.length >= 3
                ? "入替"
                : "編成";
          return (
            <article key={monster.id} className={`mini-card team-candidate-card pixel-panel ${inTeam ? "selected" : ""} ${projectedGain > 0 ? "gain-positive" : ""} ${effectChanged ? "effect-change" : ""}`}>
              <MonsterArt monster={monster} />
              <div className="team-candidate-body">
                <div className="team-candidate-title">
                  <h3>{monster.name}</h3>
                  <em>{inTeam ? "編成中" : projectedGain > 0 ? "攻撃UP" : effectChanged ? "効果" : "所持"}</em>
                </div>
                <small className="stock-code-chip">{monster.ticker} / {monster.companyAlias}</small>
                <p>{owned.shares}株 / 攻撃力 {attack.toLocaleString("ja-JP")}</p>
                <span>{monster.effect.name} / {monster.dividendType}</span>
                {owned && !inTeam && (
                  <small className={projectedGain > 0 ? "positive" : ""}>
                    {state.team.length >= 3 && replacedName ? `${replacedName}と入替 / ` : ""}
                    総合 {formatAttackPower(projectedTotal)}
                    {projectedGain !== 0 ? ` (${projectedGain > 0 ? "+" : ""}${formatAttackPower(projectedGain)})` : ""}
                  </small>
                )}
                {owned && !inTeam && projectedBonus && projectedBonus.name !== teamBonus.name && (
                  <small className={projectedBonus.active ? "positive" : ""}>
                    効果: {projectedBonus.name}
                  </small>
                )}
              </div>
              <div className="mini-actions">
                <button onClick={() => onToggle(monster.id)}>
                  {actionLabel}
                </button>
                <button onClick={() => onBuddy(monster.id)}>
                  相棒
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function DexPanel({
  state,
  onBuddy,
  onLock
}: {
  state: GameState;
  onBuddy: (id: string) => void;
  onLock: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [sort, setSort] = useState<CollectionSort>("recommended");
  const dropRates = getGachaDropRates();
  const dropRateById = new Map(dropRates.map((entry) => [entry.monsterId, entry.rate]));
  const allDexRows = playableMonsters
    .map((monster) => {
      const owned = state.owned[monster.id];
      const isBuddy = state.buddyId === monster.id;
      return {
        monster,
        owned,
        isBuddy,
        attack: owned ? getAttackPower(owned) : 0,
        dropRate: dropRateById.get(monster.id) ?? 0
      };
    })
    .sort((a, b) => {
      if (a.isBuddy !== b.isBuddy) return a.isBuddy ? -1 : 1;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      if (b.attack !== a.attack) return b.attack - a.attack;
      return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
    });
  const dexRows = allDexRows
    .filter(({ monster, owned }) => {
      if (!matchesMonsterSearch(monster, query)) return false;
      if (filter === "owned") return Boolean(owned);
      if (filter === "unowned") return !owned;
      return true;
    })
    .sort((a, b) => {
      if (sort === "ticker") return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
      if (sort === "attack") return b.attack - a.attack;
      if (sort === "price") return a.monster.sharePrice - b.monster.sharePrice;
      if (a.isBuddy !== b.isBuddy) return a.isBuddy ? -1 : 1;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      if (b.attack !== a.attack) return b.attack - a.attack;
      return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
    });
  const ownedCount = allDexRows.filter((row) => row.owned).length;
  const lockedCount = allDexRows.filter((row) => row.owned?.locked).length;
  const ignoredAssetCount = companyMonsterAssetDiagnostics.ignoredFiles.length;
  const duplicateAssetCount = companyMonsterAssetDiagnostics.duplicateTickers.length;
  const buddyMonster = monsterById.get(state.buddyId);
  const buddyOwned = buddyMonster ? state.owned[buddyMonster.id] : undefined;
  const buddyAttack = buddyOwned ? getAttackPower(buddyOwned) : 0;

  return (
    <div className="screen-content dex-screen">
      <section className="feature-panel pixel-panel dex-hero">
        <h2>株モン図鑑</h2>
        <p>登録済み株モンの所持状況を確認できます。</p>
        {buddyMonster && (
          <article className="dex-buddy-card">
            <MonsterArt monster={buddyMonster} />
            <div>
              <span>現在の相棒</span>
              <strong>{buddyMonster.name}</strong>
              <p>{buddyMonster.ticker} / {buddyMonster.companyAlias}</p>
              <small>
                {buddyOwned
                  ? `${buddyOwned.shares}株 ・ 攻撃力 ${formatAttackPower(buddyAttack)}`
                  : "未所持"}
              </small>
            </div>
          </article>
        )}
        <div className="dex-summary-strip">
          <span>登録 {ownedCount}/{playableMonsters.length}</span>
          <span>画像 {companyMonsterAssetDiagnostics.usableFiles}</span>
          <span>ロック {lockedCount}</span>
          <span>相棒 {monsterById.get(state.buddyId)?.name ?? "未設定"}</span>
        </div>
        <div className="asset-check-strip">
          <span>対象外 {ignoredAssetCount}</span>
          <span>重複コード {duplicateAssetCount}</span>
          <span>上書き {companyDataOverrideCount}</span>
        </div>
        <div className="dex-asset-rule-panel">
          <span>
            <b>画像ルール</b>
            public/monsters/コード-企業名.png / コード 企業名.png
          </span>
          <span>
            <b>自動登録</b>
            {companyMonsterAssetDiagnostics.usableFiles}体
          </span>
          <span className={duplicateAssetCount > 0 ? "negative" : "positive"}>
            <b>重複コード</b>
            {duplicateAssetCount}件
          </span>
        </div>
        <ListTools
          query={query}
          onQuery={setQuery}
          placeholder="図鑑を検索"
          filters={[
            { id: "all", label: "全て" },
            { id: "owned", label: "登録済" },
            { id: "unowned", label: "未登録" }
          ]}
          activeFilter={filter}
          onFilter={(value) => setFilter(value as CollectionFilter)}
          sortOptions={[
            { id: "recommended", label: "おすすめ" },
            { id: "ticker", label: "コード" },
            { id: "attack", label: "攻撃力" },
            { id: "price", label: "株価" }
          ]}
          activeSort={sort}
          onSort={(value) => setSort(value as CollectionSort)}
        />
      </section>
      <AdSlot slotKey="dex" />
      <section className="dex-list">
        {dexRows.length > 0 ? dexRows.map(({ monster, owned, isBuddy, attack, dropRate }) => {
          const attackBreakdown = owned ? getAttackPowerBreakdown(owned) : null;
          return (
            <article key={monster.id} className={`dex-row pixel-panel ${owned ? "owned" : "locked-row"} ${isBuddy ? "is-buddy" : ""}`}>
              <MonsterArt monster={monster} />
              <div>
                <div className="dex-row-title">
                  <h3>{monster.name}</h3>
                  <em>{isBuddy ? "相棒" : owned ? `${owned.shares}株` : monster.rarity}</em>
                </div>
                <div className="dex-metric-grid">
                  <span><b>コード</b>{monster.ticker}</span>
                  <span><b>企業</b>{monster.companyAlias}</span>
                  <span><b>所持</b>{owned ? `${owned.shares}株` : "未所持"}</span>
                  <span><b>攻撃力</b>{owned ? formatAttackPower(attack) : "-"}</span>
                </div>
                <div className="dex-effect-strip" title={monster.effect.description}>
                  <span>{monster.effect.name}</span>
                  <span>{monster.dividendType}</span>
                  <span>{attackBreakdown ? `${attackBreakdown.dividendUnits}単元` : "0単元"}</span>
                  <span>排出 {(dropRate * 100).toFixed(1)}%</span>
                </div>
                <p className="effect-meta">1株{monster.sharePrice.toLocaleString("ja-JP")}円 / 発行 {formatIssuedShares(monster.issuedShares)} / {formatCompanyDataSource(monster.dataSource)}</p>
                <p className="asset-file-meta">画像: {monster.assetFile}</p>
                <p className="owned-meta">{owned ? `${owned.locked ? "ロック中 / " : ""}配当ボーナス ${formatAttackPower(attackBreakdown?.dividendBonus ?? 0)}` : "未登録。ガチャは1株入手、マーケットは1株単位で購入できます。"}</p>
              </div>
              <div className="dex-actions">
                <button disabled={!owned} onClick={() => onBuddy(monster.id)}>相棒</button>
                <button disabled={!owned} onClick={() => onLock(monster.id)}>
                  {owned?.locked ? "解除" : "ロック"}
                </button>
              </div>
            </article>
          );
        }) : <EmptyListNotice label="条件に合う登録がありません" />}
      </section>
    </div>
  );
}

function MarketPanel({
  state,
  message,
  onBuy,
  onSell,
  onRefreshMarket,
  onReset
}: {
  state: GameState;
  message: string;
  onBuy: (id: string, quantity: number) => void;
  onSell: (id: string, quantity: number) => void;
  onRefreshMarket: () => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [sort, setSort] = useState<MarketSort>("recommended");
  const allMarketRows = playableMonsters
    .map((monster) => {
      const owned = state.owned[monster.id];
      const quote = getMarketQuote(state, monster.id);
      return {
        monster,
        owned,
        quote,
        affordable: state.kabuCoins >= quote.buyPrice,
        sellable: Boolean(owned && owned.shares > 1 && !owned.locked),
        priceTier: getPriceTier(quote.buyPrice)
      };
    })
    .sort((a, b) => {
      if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
      if (a.quote.themeMatched !== b.quote.themeMatched) return a.quote.themeMatched ? -1 : 1;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      return a.quote.buyPrice - b.quote.buyPrice;
    });
  const marketRows = allMarketRows
    .filter(({ monster, owned, quote, affordable }) => {
      if (!matchesMonsterSearch(monster, query)) return false;
      if (filter === "affordable") return affordable;
      if (filter === "owned") return Boolean(owned);
      if (filter === "theme") return quote.themeMatched;
      return true;
    })
    .sort((a, b) => {
      const attackA = a.owned ? getAttackPower(a.owned) : a.monster.sharePrice;
      const attackB = b.owned ? getAttackPower(b.owned) : b.monster.sharePrice;
      if (sort === "priceAsc") return a.quote.buyPrice - b.quote.buyPrice;
      if (sort === "priceDesc") return b.quote.buyPrice - a.quote.buyPrice;
      if (sort === "attack") return attackB - attackA;
      if (sort === "ticker") return a.monster.ticker.localeCompare(b.monster.ticker, "ja");
      if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
      if (a.quote.themeMatched !== b.quote.themeMatched) return a.quote.themeMatched ? -1 : 1;
      if (Boolean(a.owned) !== Boolean(b.owned)) return a.owned ? -1 : 1;
      return a.quote.buyPrice - b.quote.buyPrice;
    });
  const marketSummary = {
    affordable: allMarketRows.filter((row) => row.affordable).length,
    matched: allMarketRows.filter((row) => row.quote.themeMatched).length,
    owned: allMarketRows.filter((row) => row.owned).length
  };
  const dataSourceCounts = getCompanyDataSourceCounts(playableMonsters);
  const targetRow = marketRows[0];
  const targetProgress = targetRow
    ? Math.min(100, (state.kabuCoins / Math.max(1, targetRow.quote.buyPrice)) * 100)
    : 0;
  const targetShortage = targetRow
    ? Math.max(0, targetRow.quote.buyPrice - state.kabuCoins)
    : 0;
  const operationStatus = getDailyEventStatus(state);
  const operationMissingPower = Math.max(0, operationStatus.enemyAttack - operationStatus.teamPower);
  const operationBoostRows = getPurchaseUpgradeTargets(state, operationStatus);
  const bestOperationRow = operationBoostRows[0] ?? null;
  const bestOperationQuantity = bestOperationRow
    ? operationStatus.won ? 1 : bestOperationRow.sharesNeeded
    : 0;
  const bestOperationCost = bestOperationRow
    ? bestOperationRow.quote.buyPrice * bestOperationQuantity
    : 0;
  const bestOperationShortage = Math.max(0, bestOperationCost - state.kabuCoins);
  const bestOperationUnitPlan = bestOperationRow
    ? getNextDividendUnitPlan(bestOperationRow.monster, bestOperationRow.owned)
    : null;
  const operationPanelTitle = operationStatus.won ? "作戦余力を伸ばす" : "作戦勝利まで買い増し";
  const operationPanelDetail = operationStatus.won
    ? `現在は勝利見込み。総合攻撃力の伸びが大きい順に表示しています。`
    : `不足 ${formatAttackPower(operationMissingPower)} を効果込みの総合攻撃力で試算しています。`;

  return (
    <div className="screen-content market-screen">
      <section className="feature-panel pixel-panel market-hero">
        <h2>マーケット</h2>
        <p>カブコインで株モンを1株単位で購入できます。配当や配当ブーストは100株ごとに変化します。</p>
        <div className="market-price-note">
          <span>{state.currentMarket.theme}</span>
          <strong>{formatSigned(state.currentMarket.change)}%</strong>
          <small>本日の価格補正</small>
          <small>{marketSourceLabels[state.currentMarket.source]} {formatLogTime(state.currentMarket.updatedAt)}</small>
        </div>
        <div className="market-summary-strip">
          <span>購入可 {marketSummary.affordable}</span>
          <span>テーマ一致 {marketSummary.matched}</span>
          <span>所持 {marketSummary.owned}</span>
        </div>
        <div className="market-data-strip">
          <span>推定 {dataSourceCounts.estimated}</span>
          <span>手入力 {dataSourceCounts.manual}</span>
          <span>実データ {dataSourceCounts.live}</span>
        </div>
        <ListTools
          query={query}
          onQuery={setQuery}
          placeholder="マーケットを検索"
          filters={[
            { id: "all", label: "全て" },
            { id: "affordable", label: "購入可" },
            { id: "owned", label: "所持" },
            { id: "theme", label: "テーマ" }
          ]}
          activeFilter={filter}
          onFilter={(value) => setFilter(value as MarketFilter)}
          sortOptions={[
            { id: "recommended", label: "おすすめ" },
            { id: "priceAsc", label: "安い順" },
            { id: "priceDesc", label: "高い順" },
            { id: "attack", label: "攻撃力" },
            { id: "ticker", label: "コード" }
          ]}
          activeSort={sort}
          onSort={(value) => setSort(value as MarketSort)}
        />
        <button className="mini-gold-button market-refresh-wide" onClick={onRefreshMarket}>市場データ更新</button>
        {message && <div className="message-box">{message}</div>}
      </section>
      {targetRow && (
        <section className="market-target pixel-panel">
          <FrameCorners />
          <MonsterArt monster={targetRow.monster} />
          <div>
            <span>{targetRow.affordable ? "次の購入" : "次の目標"}</span>
            <strong>{targetRow.monster.name}</strong>
            <p>
              {targetRow.affordable
                ? `${formatCompactAmount(targetRow.quote.buyPrice)}で1株購入できます`
                : `あと${formatCompactAmount(targetShortage)}で1株購入できます`}
            </p>
            <div className="market-target-stats">
              <i>{targetRow.monster.ticker}</i>
              <i>所持 {formatCompactAmount(state.kabuCoins)}</i>
              <i>必要 {formatCompactAmount(targetRow.quote.buyPrice)}</i>
              <i>100株 {formatAttackPower(targetRow.monster.sharePrice * 100)}</i>
            </div>
          </div>
          <div className="market-target-meter" aria-label="購入資金進捗">
            <span style={{ width: `${targetProgress}%` }} />
          </div>
        </section>
      )}
      {bestOperationRow && bestOperationUnitPlan && (
        <section className={`market-action-panel pixel-panel ${operationStatus.won ? "won" : "lost"}`}>
          <div className="market-action-head">
            <span>{operationStatus.won ? "勝利後の買い増し" : "作戦補強"}</span>
            <strong>{bestOperationRow.monster.name}</strong>
            <p>
              {operationStatus.won
                ? `1株で総合攻撃力 +${bestOperationRow.oneShareGain.toLocaleString("ja-JP")}`
                : `${bestOperationQuantity}株で不足 ${formatAttackPower(operationMissingPower)} を補います`}
            </p>
          </div>
          <div className="market-action-metrics">
            <i>
              <b>必要</b>
              {bestOperationQuantity}株
            </i>
            <i>
              <b>費用</b>
              C{formatCompactAmount(bestOperationCost)}
            </i>
            <i className={bestOperationShortage === 0 ? "positive" : "negative"}>
              <b>{bestOperationShortage === 0 ? "購入可" : "不足"}</b>
              {bestOperationShortage === 0 ? "OK" : `C${formatCompactAmount(bestOperationShortage)}`}
            </i>
          </div>
          <div className="market-action-unit">
            <span>{bestOperationRow.owned.shares}株 → {bestOperationRow.owned.shares + bestOperationQuantity}株</span>
            <small>次単元まで {bestOperationUnitPlan.sharesNeeded}株 / 配当は100株単元</small>
          </div>
          <button
            type="button"
            disabled={bestOperationShortage > 0}
            onClick={() => onBuy(bestOperationRow.monster.id, bestOperationQuantity)}
          >
            {bestOperationShortage > 0 ? "コイン不足" : `${bestOperationQuantity}株買う`}
          </button>
        </section>
      )}
      {operationBoostRows.length > 0 && (
        <section className={`market-operation-panel pixel-panel ${operationStatus.won ? "won" : "lost"}`}>
          <div className="market-operation-header">
            <div>
              <strong>{operationPanelTitle}</strong>
              <p>{operationPanelDetail}</p>
            </div>
            <span>{operationStatus.won ? "有利" : "補強"}</span>
          </div>
          <div className="market-operation-list">
            {operationBoostRows.map((row) => (
              <article key={row.monster.id}>
                <MonsterArt monster={row.monster} />
                <div>
                  <b>{row.monster.name}</b>
                  <small>
                    {row.monster.ticker} / {row.owned.shares}株 / 1株 +{row.oneShareGain.toLocaleString("ja-JP")}
                    {row.sharesNeeded > 1 ? ` / 合計 +${formatAttackPower(row.projectedGain)}` : ""}
                  </small>
                </div>
                <span>
                  {operationStatus.won
                    ? `1株 C${formatCompactAmount(row.quote.buyPrice)}`
                    : `${row.sharesNeeded}株 C${formatCompactAmount(row.totalPrice)}`}
                </span>
                <button
                  disabled={!row.affordable}
                  onClick={() => onBuy(row.monster.id, row.sharesNeeded)}
                >
                  {operationStatus.won ? "1株買う" : `${row.sharesNeeded}株買う`}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      <AdSlot slotKey="market" />
      <section className="market-list">
        {marketRows.length > 0 ? marketRows.map(({ monster, owned, quote, affordable, sellable, priceTier }) => {
          const unitPlan = getNextDividendUnitPlan(monster, owned);
          const buyQuantities = [1, 10, 100, unitPlan.sharesNeeded]
            .filter((quantity, index, values) => quantity > 0 && values.indexOf(quantity) === index)
            .sort((a, b) => a - b);
          const buyOptions = buyQuantities.map((quantity) => ({
            quantity,
            totalPrice: quote.buyPrice * quantity,
            affordable: state.kabuCoins >= quote.buyPrice * quantity,
            label: quantity === unitPlan.sharesNeeded && ![1, 10, 100].includes(quantity)
              ? "次単元"
              : quantity === 100
                ? "100株"
                : `${quantity}株`,
            note: quantity === 1
              ? "1株単位"
              : quantity === 10
                ? "まとめ"
                : quantity === 100
                  ? "100株単元"
                  : "単元到達",
            kind: quantity === unitPlan.sharesNeeded && ![1, 10, 100].includes(quantity)
              ? "unit"
              : quantity === 100
                ? "hundred"
                : quantity === 1
                  ? "single"
                  : "bulk"
          }));
          const sellOptions = [1, 10].map((quantity) => ({
            quantity,
            totalPrice: quote.sellPrice * quantity,
            sellable: Boolean(sellable && owned && owned.shares - quantity >= 1)
          }));
          return (
            <article key={monster.id} className={`market-row pixel-panel ${affordable ? "affordable" : ""} ${quote.themeMatched ? "theme-matched" : ""} ${owned ? "owned" : ""}`}>
              <MonsterArt monster={monster} />
              <div>
                <div className="market-row-title">
                  <h3>{monster.name}</h3>
                  <em>{owned ? `${owned.shares}株` : affordable ? "購入可" : "目標"}</em>
                </div>
                <p className="stock-meta">{monster.ticker} / {monster.companyAlias} / 1株{monster.sharePrice.toLocaleString("ja-JP")}円</p>
                <div className="market-effect-strip" title={monster.effect.description}>
                  <span>{monster.effect.name}</span>
                  <span>100株 {formatAttackPower(monster.sharePrice * 100)}</span>
                  <span>発行 {formatIssuedShares(monster.issuedShares)}</span>
                  <span>{formatCompanyDataSource(monster.dataSource)}</span>
                  <span>{monster.dividendType}</span>
                  <span className={priceTier.className}>{priceTier.label}</span>
                </div>
                <p className="owned-meta">{owned ? `${owned.shares}株 攻撃力${formatAttackPower(getAttackPower(owned))}${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
                <div className="market-unit-plan">
                  <div>
                    <span>{owned ? `次の${unitPlan.targetShares}株単元まで` : "初回100株単元まで"}</span>
                    <strong>{unitPlan.sharesNeeded}株</strong>
                  </div>
                  <i aria-label={`${monster.name}の単元進捗`}>
                    <em style={{ width: `${unitPlan.progress}%` }} />
                  </i>
                  <div className="market-unit-metrics">
                    <span>現在 {unitPlan.currentUnits}単元</span>
                    <span>次 {unitPlan.nextUnits}単元</span>
                    <span>単元 +{unitPlan.dividendPerUnit}</span>
                  </div>
                  <small>
                    到達後 配当+{unitPlan.projectedDividend} / 攻撃力 {formatAttackPower(unitPlan.projectedAttack)}
                  </small>
                </div>
                <div className="market-quote">
                  <span className={quote.themeMatched ? "matched" : ""}>
                    {quote.themeMatched ? "テーマ一致" : "分散価格"}
                  </span>
                  <span>市場 x{quote.marketMultiplier.toFixed(2)}</span>
                  <span>保有 x{quote.demandMultiplier.toFixed(2)}</span>
                </div>
                {owned && (
                  <p className="sell-meta" title={`売却価格 ${quote.sellPrice.toLocaleString("ja-JP")}コイン / 1株`}>
                    売却 {formatCompactAmount(quote.sellPrice)} / 1株
                  </p>
                )}
              </div>
              <div className="market-buy">
                <strong title={`${quote.buyPrice.toLocaleString("ja-JP")}コイン`}>
                  {formatCompactAmount(quote.buyPrice)}
                </strong>
                <small title={`基準 ${quote.basePrice.toLocaleString("ja-JP")}コイン`}>
                  1株 / 基準 {formatCompactAmount(quote.basePrice)}
                </small>
                <div className="market-buy-rule">
                  <span>購入は1株単位</span>
                  <span>配当は100株単元</span>
                </div>
                <div className="market-buy-options" aria-label={`${monster.name}の購入数`}>
                  {buyOptions.map((option) => (
                    <button
                      key={option.quantity}
                      className={`buy-option-${option.kind}`}
                      disabled={!option.affordable}
                      title={`${option.quantity}株 ${option.totalPrice.toLocaleString("ja-JP")}コイン`}
                      onClick={() => onBuy(monster.id, option.quantity)}
                    >
                      {option.label}
                      <b>{option.note}</b>
                      <small>{formatCompactAmount(option.totalPrice)}</small>
                    </button>
                  ))}
                </div>
                {owned && (
                  <div className="market-sell-options" aria-label={`${monster.name}の売却数`}>
                    {sellOptions.map((option) => (
                      <button
                        key={option.quantity}
                        className="sell-button"
                        disabled={!option.sellable}
                        title={`${option.quantity}株 ${option.totalPrice.toLocaleString("ja-JP")}コイン`}
                        onClick={() => onSell(monster.id, option.quantity)}
                      >
                        売{option.quantity}
                        <small>{formatCompactAmount(option.totalPrice)}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        }) : <EmptyListNotice label="条件に合う銘柄がありません" />}
      </section>
      <section className="feature-panel pixel-panel">
        <h2>セーブ管理</h2>
        <p>現在のプレイデータを初期状態へ戻せます。</p>
        <button className="danger-button full" onClick={onReset}>初期化</button>
      </section>
      <LegalNotice />
    </div>
  );
}

function AccountPanel({
  state,
  message,
  battleSnapshots,
  onPublishBattleSnapshot,
  onSyncPlayerProfile,
  onCheckCloudSync,
  onSaveName,
  onNavigate
}: {
  state: GameState;
  message: string;
  battleSnapshots: TeamBattleSnapshot[];
  onPublishBattleSnapshot: () => void;
  onSyncPlayerProfile: () => void;
  onCheckCloudSync: () => void;
  onSaveName: (name: string) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [displayName, setDisplayName] = useState(state.accountProfile.displayName);
  const teamAttack = getTeamAttackSummary(state);
  const teamSnapshot = createTeamBattleSnapshot(state);
  const publishedSnapshot = findBattleSnapshot(battleSnapshots, teamSnapshot.syncCode);
  const cloudSync = getCloudSyncStatus();
  const battlePayload = buildBattleSnapshotPayload(teamSnapshot);
  const profilePayload = buildPlayerProfilePayload(state);
  const winCount = state.battleHistory.filter((battle) => battle.won).length;
  const battleCount = state.battleHistory.length;
  const winRate = battleCount > 0 ? Math.round((winCount / battleCount) * 100) : 0;

  useEffect(() => {
    setDisplayName(state.accountProfile.displayName);
  }, [state.accountProfile.displayName]);

  return (
    <div className="screen-content account-screen">
      <section className="feature-panel pixel-panel account-hero">
        <div className="account-avatar" aria-hidden="true" />
        <div>
          <h2>アカウント</h2>
          <p>今はゲスト保存です。後からクラウド保存やユーザー対戦に接続できる形で管理します。</p>
        </div>
        <div className={`account-status ${state.accountProfile.cloudStatus}`}>
          <span>{state.accountProfile.provider === "guest" ? "GUEST" : state.accountProfile.provider.toUpperCase()}</span>
          <strong>{state.accountProfile.cloudStatus === "linked" ? "連携済み" : state.accountProfile.cloudStatus === "ready" ? "連携準備中" : "ローカル保存"}</strong>
        </div>
        {message && <div className="message-box compact">{message}</div>}
      </section>

      <section className="account-edit-panel pixel-panel">
        <div>
          <strong>プロフィール</strong>
          <p>対戦時に表示する名前です。</p>
        </div>
        <label>
          <span>表示名</span>
          <input
            value={displayName}
            maxLength={16}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="トレーダー名"
          />
        </label>
        <button className="mini-gold-button" type="button" onClick={() => onSaveName(displayName)}>
          保存する
        </button>
      </section>

      <section className="account-data-panel pixel-panel">
        <header>
          <strong>プレイヤーデータ</strong>
          <span>保存準備</span>
        </header>
        <div className="account-data-grid">
          <span><b>ゲストID</b>{state.accountProfile.guestId}</span>
          <span><b>トレーダーLv</b>{state.traderLevel}</span>
          <span><b>チーム攻撃力</b>{formatAttackPower(teamAttack.totalAttack)}</span>
          <span><b>対戦成績</b>{winCount}勝 / {battleCount}戦 / {winRate}%</span>
          <span><b>作成</b>{formatLogTime(state.accountProfile.createdAt)}</span>
          <span><b>更新</b>{formatLogTime(state.accountProfile.updatedAt)}</span>
        </div>
      </section>

      <section className="account-snapshot-panel pixel-panel">
        <header>
          <strong>対戦用チームデータ</strong>
          <span>同期準備</span>
        </header>
        <div className="account-sync-code">
          <span>対戦コード</span>
          <strong>{teamSnapshot.syncCode}</strong>
          <small>{publishedSnapshot ? `${formatLogTime(publishedSnapshot.createdAt)} 登録済み` : "チーム・持ち株・攻撃力から作る固定コード"}</small>
        </div>
        <button className="account-publish-button" type="button" onClick={onPublishBattleSnapshot}>
          {publishedSnapshot ? "対戦チームを更新" : "対戦チームを登録"}
        </button>
        <div className="account-snapshot-summary">
          <span><b>共有ID</b>{teamSnapshot.snapshotId}</span>
          <span><b>総攻撃力</b>{formatAttackPower(teamSnapshot.totalAttack)}</span>
          <span><b>効果</b>{teamSnapshot.teamBonusName} x{teamSnapshot.teamBonusMultiplier.toFixed(2)}</span>
          <span><b>登録名</b>{teamSnapshot.ownerName}</span>
        </div>
        <div className="account-snapshot-members">
          {teamSnapshot.members.length > 0 ? teamSnapshot.members.map((member) => (
            <article key={member.id}>
              <b>{member.name}</b>
              <span>{member.ticker} / {member.shares}株</span>
              <strong>{formatAttackPower(member.attack)}</strong>
            </article>
          )) : (
            <article className="empty">
              <b>未編成</b>
              <span>チームを3体にしてください</span>
              <strong>0</strong>
            </article>
          )}
        </div>
      </section>

      <section className="account-cloud-panel pixel-panel">
        <header>
          <strong>クラウド連携ロードマップ</strong>
          <span>{cloudSync.label}</span>
        </header>
        <div className={`account-cloud-status ${cloudSync.provider} ${cloudSync.configured ? "configured" : "missing"}`}>
          <strong>{cloudSync.provider === "supabase" ? "Supabase" : "Local"}</strong>
          <p>{cloudSync.detail}</p>
        </div>
        <div className="account-cloud-payload">
          <span><b>profile</b>{profilePayload.guest_id} / {profilePayload.display_name}</span>
          <span><b>battle_snapshots</b>{battlePayload.sync_code} / {formatAttackPower(battlePayload.total_attack)}</span>
        </div>
        <div className="account-cloud-steps">
          <span className="done"><b>1</b>ゲストID発行</span>
          <span className={state.accountProfile.cloudStatus !== "local" ? "done" : ""}><b>2</b>表示名保存</span>
          <span className={publishedSnapshot ? "done" : ""}><b>3</b>対戦チーム登録</span>
          <span className={cloudSync.provider === "supabase" && cloudSync.configured ? "done" : ""}><b>4</b>クラウド設定</span>
        </div>
        <p>プロフィールと対戦チームをSupabaseへ保存し、他ユーザーの対戦コードから実チームを取得します。</p>
        <div className="account-cloud-controls">
          <button type="button" onClick={onSyncPlayerProfile}>プロフィール同期</button>
          <button type="button" onClick={onCheckCloudSync}>接続チェック</button>
        </div>
        <div className="account-actions">
          <button type="button" onClick={() => onNavigate("event")}>対戦へ</button>
          <button type="button" onClick={() => onNavigate("team")}>チーム確認</button>
          <button type="button" onClick={() => onNavigate("policy")}>ポリシー</button>
        </div>
      </section>
    </div>
  );
}

function PolicyPanel({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className="screen-content policy-screen">
      <section className="feature-panel pixel-panel policy-hero">
        <h2>ポリシー</h2>
        <p>株モンの公開、広告審査、クラウド連携に備えた利用方針です。ゲーム内からいつでも確認できるようにしています。</p>
      </section>

      <section className="policy-panel pixel-panel">
        <header>
          <strong>投資に関する注意</strong>
          <span>重要</span>
        </header>
        <p>
          株モンは株式や企業を題材にした育成・放置ゲームです。ゲーム内の銘柄名、株価、攻撃力、配当、レア度、排出率は娯楽表現であり、特定銘柄の売買や投資判断をすすめるものではありません。
        </p>
      </section>

      <section className="policy-panel pixel-panel">
        <header>
          <strong>保存データ</strong>
          <span>Local</span>
        </header>
        <p>
          プレイ状況、所持株数、チーム、対戦履歴、ミッション進捗、表示名などはブラウザ内に保存されます。端末やブラウザのデータを削除すると、保存データも消える場合があります。
        </p>
      </section>

      <section className="policy-panel pixel-panel">
        <header>
          <strong>クラウド同期</strong>
          <span>Optional</span>
        </header>
        <p>
          Supabase設定を有効にした場合、ゲストID、表示名、トレーダーレベル、対戦コード、チーム攻撃力、編成メンバー情報を同期します。メールアドレスや決済情報は現在扱いません。
        </p>
      </section>

      <section className="policy-panel pixel-panel">
        <header>
          <strong>広告表示方針</strong>
          <span>Ads</span>
        </header>
        <p>
          広告はガチャ、図鑑、マーケットなどの一覧前に表示する想定です。誤タップしやすい下部ナビ付近、主要操作ボタン直下、結果確認を妨げる位置には配置しません。審査前は本物の広告コードを挿入せず、プレースホルダーのみ表示します。
        </p>
      </section>

      <section className="policy-panel pixel-panel">
        <header>
          <strong>課金と年齢配慮</strong>
          <span>Safe</span>
        </header>
        <p>
          現在のWeb版には課金機能はありません。ゲーム内のコイン、配当、ガチャ券は現金や金融商品に交換できません。将来アプリ化する場合は、ストア審査に合わせて広告、年齢区分、プライバシー表示を更新します。
        </p>
      </section>

      <section className="policy-actions pixel-panel">
        <a href={withBasePath("/about/")}>説明ページ</a>
        <button type="button" onClick={() => onNavigate("account")}>アカウントへ戻る</button>
        <button type="button" onClick={() => onNavigate("home")}>ホームへ</button>
      </section>
    </div>
  );
}

function DailyInfoPanel({ state }: { state: GameState }) {
  const knowledge = getDailyKnowledge(state.currentMarket.theme);
  const ignoredAssetCount = companyMonsterAssetDiagnostics.ignoredFiles.length;
  const duplicateAssetCount = companyMonsterAssetDiagnostics.duplicateTickers.length;

  return (
    <section className="daily-info pixel-panel">
      <div>
        <strong>株ミニ知識</strong>
        <p>{knowledge}</p>
      </div>
      <div>
        <strong>運用データ</strong>
        <p>企業画像 {companyMonsterAssetDiagnostics.usableFiles}件 / 調整データ {companyDataOverrideCount}件 / セーブ形式 {SAVE_VERSION}</p>
      </div>
      <div>
        <strong>画像チェック</strong>
        <p>対象外 {ignoredAssetCount}件 / 重複コード {duplicateAssetCount}件</p>
      </div>
      <div>
        <strong>市場データ</strong>
        <p>{marketSourceLabels[state.currentMarket.source]} / {state.currentMarket.note}</p>
      </div>
      <div>
        <strong>ゲームバランス</strong>
        <p>ガチャ {balance.gachaCost.toLocaleString("ja-JP")}C / 育成 {balance.trainCost}D / 放置上限 {balance.offlineMaxHours}時間</p>
      </div>
    </section>
  );
}

function DailyReportPanel({ state }: { state: GameState }) {
  const summary = getDailyLogSummary(state.logs);
  const latestLogs = summary.logs.slice(0, 3);

  return (
    <section className="daily-report pixel-panel">
      <div className="daily-report-header">
        <div>
          <strong>本日の運用レポート</strong>
          <p>{summary.dateLabel} / {summary.actionCount}件の行動</p>
        </div>
        <span>{summary.trainCount}育成</span>
      </div>
      <div className="daily-report-grid">
        <ReportTile label="カブコイン" value={formatDelta(summary.kabuCoins)} />
        <ReportTile label="配当" value={formatDelta(summary.dividendCoins)} />
        <ReportTile label="トレーダー経験値" value={`+${summary.exp.toLocaleString("ja-JP")}`} />
      </div>
      <div className="daily-report-logs">
        {latestLogs.length > 0 ? (
          latestLogs.map((log) => <LogEntry key={log.id} log={log} />)
        ) : (
          <p className="empty-report">今日はまだ行動履歴がありません。</p>
        )}
      </div>
    </section>
  );
}

function MonsterMiniCard({
  state,
  monster,
  dropRate,
  dropWeight
}: {
  state: GameState;
  monster: MonsterMaster;
  dropRate?: number;
  dropWeight?: number;
}) {
  const owned = state.owned[monster.id];
  const attackPerShare = monster.sharePrice;
  const dividendUnitAttack = monster.sharePrice * 100;
  return (
    <article className={`mini-card gacha-card pixel-panel ${owned ? "owned" : ""}`}>
      <MonsterArt monster={monster} />
      <div className="gacha-card-body">
        <div className="gacha-card-title">
          <h3>{monster.name}</h3>
          <span>{monster.rarity}</span>
          <em>{owned ? `${owned.shares}株` : "未所持"}</em>
        </div>
        <p className="stock-meta">{monster.ticker} / {monster.companyAlias}</p>
        <p className="stock-meta">1株攻撃力 {attackPerShare.toLocaleString("ja-JP")} / 100株 {dividendUnitAttack.toLocaleString("ja-JP")}</p>
        <p className="effect-meta">{monster.effect.name} / 100株ごと</p>
        <div className="gacha-card-meta">
          {typeof dropRate === "number" && <span>排出 {(dropRate * 100).toFixed(1)}%</span>}
          <span>発行 {formatIssuedShares(monster.issuedShares)}</span>
          {typeof dropWeight === "number" && <span>発行補正 x{dropWeight.toFixed(1)}</span>}
          <span>{formatCompanyDataSource(monster.dataSource)}</span>
          <span>{monster.dividendType}</span>
        </div>
        <strong>{owned ? `攻撃力 ${getAttackPower(owned).toLocaleString("ja-JP")}` : `入手時 ${attackPerShare.toLocaleString("ja-JP")}`}</strong>
      </div>
    </article>
  );
}

function getPriceTier(price: number): { label: string; className: string } {
  if (price < 100_000) {
    return { label: "入門価格", className: "price-tier-low" };
  }
  if (price < 500_000) {
    return { label: "標準価格", className: "price-tier-mid" };
  }
  if (price < 1_000_000) {
    return { label: "高額銘柄", className: "price-tier-high" };
  }
  return { label: "大型目標", className: "price-tier-premium" };
}

function getNextDividendUnitPlan(monster: MonsterMaster, owned: GameState["owned"][string] | undefined) {
  const currentShares = owned?.shares ?? 0;
  const currentUnitBase = Math.floor(currentShares / 100) * 100;
  const targetShares = currentShares > 0 && currentShares % 100 === 0
    ? currentShares + 100
    : currentUnitBase + 100;
  const sharesNeeded = Math.max(1, targetShares - currentShares);
  const projectedShares = currentShares + sharesNeeded;
  const projectedOwned = owned
    ? { ...owned, shares: projectedShares }
    : {
        id: monster.id,
        shares: projectedShares,
        level: 1,
        exp: 0,
        stats: { ...monster.baseStats },
        locked: false
      };

  return {
    targetShares,
    sharesNeeded,
    currentUnits: Math.floor(currentShares / 100),
    nextUnits: Math.floor(projectedShares / 100),
    dividendPerUnit: baseDividendPerUnit[monster.dividendType],
    projectedDividend: Math.floor(baseDividendPerUnit[monster.dividendType] * Math.floor(projectedShares / 100)),
    progress: Math.min(100, Math.round((currentShares / targetShares) * 100)),
    projectedAttack: getAttackPower(projectedOwned)
  };
}

function formatCompactAmount(value: number): string {
  if (value >= 100_000_000) {
    return `${trimFixed(value / 100_000_000)}億`;
  }
  if (value >= 10_000) {
    return `${trimFixed(value / 10_000)}万`;
  }
  return value.toLocaleString("ja-JP");
}

function formatAttackPower(value: number): string {
  return Math.floor(value).toLocaleString("ja-JP");
}

function loadBattleSnapshots(): TeamBattleSnapshot[] {
  try {
    const raw = window.localStorage?.getItem(BATTLE_SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBattleSnapshot).slice(0, 20);
  } catch {
    return [];
  }
}

function saveBattleSnapshot(snapshot: TeamBattleSnapshot, currentSnapshots: TeamBattleSnapshot[]): TeamBattleSnapshot[] {
  const nextSnapshots = [
    snapshot,
    ...currentSnapshots.filter((item) => item.syncCode !== snapshot.syncCode)
  ].slice(0, 20);

  try {
    window.localStorage?.setItem(BATTLE_SNAPSHOT_STORAGE_KEY, JSON.stringify(nextSnapshots));
  } catch {
    // 保存できない環境では、現在のセッション内だけで使います。
  }

  return nextSnapshots;
}

function mergeBattleSnapshots(snapshots: TeamBattleSnapshot[]): TeamBattleSnapshot[] {
  const snapshotMap = new Map<string, TeamBattleSnapshot>();

  snapshots.forEach((snapshot) => {
    const key = normalizeBattleCodeInput(snapshot.syncCode);
    const current = snapshotMap.get(key);
    if (!current || snapshot.totalAttack >= current.totalAttack) {
      snapshotMap.set(key, snapshot);
    }
  });

  return Array.from(snapshotMap.values()).sort((a, b) => b.totalAttack - a.totalAttack);
}

function getBattleRecordSummary(history: GameState["battleHistory"]) {
  const totalBattles = history.length;
  const totalWins = history.filter((battle) => battle.won).length;
  const totalLosses = totalBattles - totalWins;
  const userBattles = history.filter((battle) => battle.mode === "user");
  const userWins = userBattles.filter((battle) => battle.won).length;
  const totals = history.reduce(
    (sum, battle) => ({
      kabuCoins: sum.kabuCoins + battle.kabuCoins,
      dividendCoins: sum.dividendCoins + battle.dividendCoins,
      exp: sum.exp + battle.exp,
      gachaTickets: sum.gachaTickets + battle.gachaTickets
    }),
    { kabuCoins: 0, dividendCoins: 0, exp: 0, gachaTickets: 0 }
  );
  const bestRank = history
    .map((battle) => battle.rank)
    .sort((a, b) => getBattleRankScore(b) - getBattleRankScore(a))[0] ?? "-";
  const latestBattle = history[0];

  return {
    totalBattles,
    totalWins,
    totalLosses,
    userBattles: userBattles.length,
    userWins,
    winRate: totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0,
    userWinRate: userBattles.length > 0 ? Math.round((userWins / userBattles.length) * 100) : 0,
    bestRank,
    latestResult: latestBattle ? `${latestBattle.won ? "WIN" : "LOSE"} / ${latestBattle.rank}` : "未対戦",
    ...totals
  };
}

function getBattleRankScore(rank: string): number {
  if (rank === "S") return 4;
  if (rank === "A") return 3;
  if (rank === "B") return 2;
  if (rank === "C") return 1;
  return 0;
}

function findBattleSnapshot(snapshots: TeamBattleSnapshot[], code: string): TeamBattleSnapshot | null {
  const normalized = normalizeBattleCodeInput(code);
  if (!normalized) return null;
  return snapshots.find((snapshot) => normalizeBattleCodeInput(snapshot.syncCode) === normalized) ?? null;
}

function normalizeBattleCodeInput(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isBattleSnapshot(value: unknown): value is TeamBattleSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TeamBattleSnapshot>;
  return typeof snapshot.snapshotId === "string"
    && typeof snapshot.syncCode === "string"
    && typeof snapshot.ownerName === "string"
    && typeof snapshot.createdAt === "string"
    && typeof snapshot.totalAttack === "number"
    && Array.isArray(snapshot.members);
}

function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatIssuedShares(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}億株`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万株`;
  }
  return `${value.toLocaleString("ja-JP")}株`;
}

function formatCompanyDataSource(source: MonsterMaster["dataSource"]): string {
  if (source === "live") return "実データ";
  if (source === "manual") return "手入力";
  return "推定データ";
}

function getCompanyDataSourceCounts(monsterList: MonsterMaster[]) {
  return monsterList.reduce(
    (counts, monster) => ({
      ...counts,
      [monster.dataSource]: counts[monster.dataSource] + 1
    }),
    { estimated: 0, manual: 0, live: 0 } satisfies Record<MonsterMaster["dataSource"], number>
  );
}

function MonsterArt({ monster, large = false }: { monster: MonsterMaster; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const showPlaceholder = !monster.assetReady || failed;
  const imageSource = useFallback && monster.fallbackImage
    ? monster.fallbackImage
    : large ? monster.image : monster.icon;

  useEffect(() => {
    setFailed(false);
    setUseFallback(false);
  }, [monster.id]);

  return (
    <div className={`monster-art ${large ? "large" : ""} ${showPlaceholder ? "placeholder-art" : ""} monster-${monster.id}`}>
      {!showPlaceholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSource}
          alt={monster.name}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={large ? "high" : "auto"}
          onError={() => {
            if (!useFallback && monster.fallbackImage) {
              setUseFallback(true);
              return;
            }
            setFailed(true);
          }}
        />
      )}
      {showPlaceholder && (
        <div className="placeholder-creature" aria-label={`${monster.name}の画像未登録`}>
          <i />
          <span>{monster.name.slice(0, 2)}</span>
          <small>準備中</small>
        </div>
      )}
    </div>
  );
}

function StatsPanel({ stats }: { stats: MonsterStats }) {
  const rows: { key: keyof MonsterStats; label: string; max: number }[] = [
    { key: "attack", label: "攻撃力", max: 50000 }
  ];

  return (
    <section className="stats-panel pixel-panel">
      <FrameCorners />
      {rows.map((row) => {
        const value = stats[row.key];
        return (
          <div className={`stat-row stat-${row.key}`} key={row.key}>
            <span>{row.label}</span>
            <div className="stat-bar">
              <i style={{ width: `${Math.min(100, (value / row.max) * 100)}%` }} />
            </div>
            <strong>{value.toLocaleString("ja-JP")}</strong>
          </div>
        );
      })}
    </section>
  );
}

function FrameCorners() {
  return (
    <>
      <span className="frame-edge-top" aria-hidden="true" />
      <span className="frame-edge-bottom" aria-hidden="true" />
      <span className="frame-edge-side frame-edge-left" aria-hidden="true" />
      <span className="frame-edge-side frame-edge-right" aria-hidden="true" />
      <span className="frame-corner frame-corner-tr" aria-hidden="true" />
      <span className="frame-corner frame-corner-bl" aria-hidden="true" />
    </>
  );
}

function ResultTile({ kind, label, value }: { kind?: string; label: string; value: string }) {
  return (
    <div className={`result-tile ${kind ? `result-${kind}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LogList({ state, compact = false, limit }: { state: GameState; compact?: boolean; limit?: number }) {
  const displayLimit = limit ?? (compact ? 2 : 8);
  const logs = state.logs.slice(0, displayLimit);
  return (
    <section className="log-list">
      {logs.map((log) => <LogEntry key={log.id} log={log} framed />)}
    </section>
  );
}

function LogEntry({ log, framed = false }: { log: GrowthLog; framed?: boolean }) {
  return (
    <article className={`log-row ${framed ? "pixel-panel" : ""}`}>
      <div>
        <strong>{log.title}</strong>
        <p>{log.detail}</p>
      </div>
      <div className="log-meta">
        <span>{formatLogTime(log.date)}</span>
        {(log.coins !== 0 || log.dividendCoins !== 0 || log.exp !== 0) && (
          <small>
            {log.coins !== 0 && <i>C {formatDelta(log.coins)}</i>}
            {log.dividendCoins !== 0 && <i>D {formatDelta(log.dividendCoins)}</i>}
            {log.exp !== 0 && <i>EXP +{log.exp.toLocaleString("ja-JP")}</i>}
          </small>
        )}
      </div>
    </article>
  );
}

function ReportTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LegalNotice() {
  return (
    <section className="legal-notice pixel-panel">
      このアプリは株価や企業を題材にしたゲームです。特定の銘柄の売買をすすめるものではありません。
      ゲーム内のレア度・能力・価格・配当・利回りは、実際の企業価値や投資判断を示すものではありません。
    </section>
  );
}

function getDailyKnowledge(theme: string): string {
  const items = [
    "終値とは、その日の取引が終わった時点の株価のことです。",
    "単元株は、株を売買するときのまとまった単位です。株モンでは100株を1単元として扱います。",
    "配当は企業が利益の一部を株主に還元する仕組みです。株モンでは配当コインとして表現します。",
    "業種を見ると、企業がどんな分野で事業をしているかをつかみやすくなります。",
    "株価が下がる日でも、株モンでは次のガチャにつながるチケットを得られます。"
  ];
  const index = Math.abs(theme.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % items.length;
  return items[index];
}

function getDailyLogSummary(logs: GrowthLog[]) {
  const now = new Date();
  const todayLogs = logs.filter((log) => isSameLocalDay(new Date(log.date), now));

  return {
    dateLabel: `${now.getMonth() + 1}/${now.getDate()}`,
    logs: todayLogs,
    actionCount: todayLogs.length,
    trainCount: todayLogs.filter((log) => log.title === "市場エネルギー反映").length,
    kabuCoins: todayLogs.reduce((sum, log) => sum + log.coins, 0),
    dividendCoins: todayLogs.reduce((sum, log) => sum + log.dividendCoins, 0),
    exp: todayLogs.reduce((sum, log) => sum + log.exp, 0)
  };
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatLogTime(date: string): string {
  return new Date(date).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ja-JP")}`;
}

async function fetchMarketEnergy(): Promise<MarketEnergy | null> {
  try {
    const response = await fetch(withBasePath("/api/market"), {
      cache: "no-store"
    });
    if (!response.ok) return null;

    const data = await response.json() as { market?: MarketEnergy };
    return data.market ?? null;
  } catch {
    return null;
  }
}
