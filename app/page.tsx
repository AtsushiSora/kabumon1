"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  accrueOfflineReward,
  balance,
  buyMonsterFromMarket,
  claimDailyCheckin,
  claimMissionReward,
  claimOfflineReward,
  createInitialState,
  formatSigned,
  getDailyCheckinStatus,
  getDailyEventStatus,
  getAttackPower,
  getAttackPowerBreakdown,
  getDisplayStats,
  getGachaDropRates,
  getGachaWeight,
  getMarketQuote,
  getMissions,
  getRequiredExp,
  getTeamAttackSummary,
  getTeamAttackSummaryForIds,
  getTeamBonus,
  hydrateState,
  marketSourceLabels,
  refreshMarketEnergy,
  rollGacha,
  runDailyEvent,
  sellMonsterUnit,
  serializeState,
  setBuddy,
  SAVE_VERSION,
  STORAGE_KEY,
  toggleTeamMember,
  toggleMonsterLock,
  trainBuddy,
  type GrowthLog,
  type GameState,
  type DailyEventResult,
  type MarketEnergy,
  type TrainResult
} from "@/lib/game";
import { companyMonsterAssetDiagnostics } from "@/lib/companyMonsterAssets";
import { companyDataOverrideCount } from "@/lib/companyDataOverrides";
import { baseDividendPerUnit, monsterById, monsters, playableMonsters, type MonsterMaster, type MonsterStats } from "@/lib/monsters";
import { withBasePath } from "@/lib/paths";

type Tab = "home" | "gacha" | "train" | "event" | "team" | "dex" | "market";

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

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "gacha", label: "ガチャ", icon: "gacha" },
  { id: "train", label: "育成", icon: "train" },
  { id: "event", label: "作戦", icon: "event" },
  { id: "team", label: "チーム", icon: "team" },
  { id: "dex", label: "図鑑", icon: "dex" },
  { id: "market", label: "マーケット", icon: "market" }
];

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
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [eventResult, setEventResult] = useState<DailyEventResult | null>(null);
  const [resultToast, setResultToast] = useState<ResultToast | null>(null);

  useEffect(() => {
    let savedState: string | null = null;
    try {
      savedState = window.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      savedState = null;
    }
    setState(hydrateState(savedState));
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

  const buddy = state ? state.owned[state.buddyId] : null;
  const buddyMaster = buddy ? monsterById.get(buddy.id) : undefined;
  const teamBonus = useMemo(() => (state ? getTeamBonus(state) : null), [state]);

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
          "--ideal-chip-frame": `url(${withBasePath("/ui/ideal-chip-frame.png")})`,
          "--ideal-nav-frame": `url(${withBasePath("/ui/ideal-nav-frame.png")})`,
          "--ideal-nav-active-frame": `url(${withBasePath("/ui/ideal-nav-active-frame.png")})`,
          "--nav-icon-home": `url(${withBasePath("/ui/nav-home.png")})`,
          "--nav-icon-gacha": `url(${withBasePath("/ui/nav-gacha.png")})`,
          "--nav-icon-train": `url(${withBasePath("/ui/nav-train.png")})`,
          "--nav-icon-event": `url(${withBasePath("/ui/nav-event.png")})`,
          "--nav-icon-team": `url(${withBasePath("/ui/nav-team.png")})`,
          "--nav-icon-dex": `url(${withBasePath("/ui/nav-dex.png")})`,
          "--nav-icon-market": `url(${withBasePath("/ui/nav-market.png")})`,
          "--header-icon-coin": `url(${withBasePath("/ui/header-coin.png")})`,
          "--header-icon-gem": `url(${withBasePath("/ui/header-gem.png")})`,
          "--header-icon-avatar": `url(${withBasePath("/ui/header-avatar.png")})`
        } as CSSProperties}
      >
        <Header state={state} />

        {activeTab === "home" && (
          <HomePanel
            state={state}
            buddy={buddy}
            buddyMaster={buddyMaster}
            displayStats={displayStats}
            teamBonus={teamBonus}
            trainResult={trainResult}
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
            onNavigate={setActiveTab}
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
                    `配当 +${mission?.reward.dividendCoins ?? 0}`
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
                setTrainResult(null);
                setEventResult(null);
                setResultToast(null);
                update(createInitialState(new Date()));
                setActiveTab("home");
              }
            }}
          />
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

function Header({ state }: { state: GameState }) {
  const traderExpRequired = getRequiredExp(state.traderLevel);
  const traderExpPercent = Math.min(100, (state.traderExp / traderExpRequired) * 100);

  return (
    <header className="top-header">
      <div className="brand-mark">
        <span className="market-icon">↗</span>
        <h1>株モン</h1>
      </div>
      <div className="trainer-chip">
        <span className="avatar-pixel" aria-hidden="true" />
        <div className="trainer-chip-info">
          <span>トレーダー Lv.{state.traderLevel}</span>
          <div className="trainer-exp-bar" aria-label="トレーダー経験値">
            <i style={{ width: `${traderExpPercent}%` }} />
          </div>
        </div>
      </div>
      <CurrencyChip kind="coin" value={state.kabuCoins} />
      <CurrencyChip kind="gem" value={state.dividendCoins} />
    </header>
  );
}

function CurrencyChip({ kind, value }: { kind: "coin" | "gem"; value: number }) {
  return (
    <div className={`currency-chip currency-${kind}`}>
      <span aria-hidden="true" />
      <strong>{value.toLocaleString("ja-JP")}</strong>
      <b>+</b>
    </div>
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

function HomePanel({
  state,
  buddy,
  buddyMaster,
  displayStats,
  teamBonus,
  trainResult,
  onRefreshMarket,
  onClaimOffline,
  onNavigate
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  displayStats: MonsterStats;
  teamBonus: ReturnType<typeof getTeamBonus>;
  trainResult: TrainResult | null;
  onRefreshMarket: () => void;
  onClaimOffline: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const attackPower = getAttackPower(buddy);
  const attackBreakdown = getAttackPowerBreakdown(buddy);
  const teamSlots = Array.from({ length: 3 }, (_, index) => {
    const id = state.team[index];
    const owned = id ? state.owned[id] : undefined;
    const master = id ? monsterById.get(id) : undefined;
    if (!owned || !master) {
      return null;
    }
    return {
      id,
      name: master.name,
      effectName: master.effect.name,
      attack: getAttackPower(owned)
    };
  });
  const teamAttackSummary = getTeamAttackSummary(state);
  const offlineReward = state.offlinePending;
  const offlineProgress = offlineReward
    ? Math.min(100, (offlineReward.hours / balance.offlineMaxHours) * 100)
    : 0;
  const offlineAtCap = offlineProgress >= 100;
  const eventStatus = getDailyEventStatus(state);
  const gachaMainLabel = state.gachaTickets > 0
    ? `${state.gachaTickets}枚`
    : balance.gachaCost.toLocaleString("ja-JP");
  const gachaSubLabel = state.gachaTickets > 0 ? "チケット" : "カブコイン";
  const recommendation = offlineReward
    ? {
        label: offlineAtCap ? "放置MAX" : "放置報酬",
        detail: `${offlineReward.hours}時間分を受け取れます。C+${formatCompactAmount(offlineReward.kabuCoins)} / D+${formatCompactAmount(offlineReward.dividendCoins)}`,
        tab: "home",
        action: "claim",
        progress: offlineProgress
      }
    : eventStatus.available
      ? {
        label: eventStatus.won ? "作戦チャンス" : "戦力確認",
        detail: eventStatus.won
          ? `ランク${eventStatus.rank}で勝利見込み。作戦報酬を狙えます。`
          : "相手攻撃力が高めです。チーム編成で総合攻撃力を上げましょう。",
        tab: eventStatus.won ? "event" : "team",
        action: "navigate",
        progress: Math.min(100, (eventStatus.score / eventStatus.target) * 100)
        }
      : state.gachaTickets > 0
        ? {
            label: "ガチャ券あり",
            detail: `${state.gachaTickets}枚のガチャ券を使えます。新しい株モンを狙いましょう。`,
            tab: "gacha",
            action: "navigate",
            progress: 100
          }
        : {
            label: "チーム確認",
            detail: `現在の総合攻撃力は${formatAttackPower(teamAttackSummary.totalAttack)}です。効果の組み合わせを確認しましょう。`,
            tab: "team",
            action: "navigate",
            progress: Math.min(100, (teamAttackSummary.memberCount / 3) * 100)
          };

  return (
    <div
      className={`screen-content home-screen ${offlineReward ? "has-offline-reward" : ""}`}
      style={{
        "--home-stage-bg": `url(${withBasePath("/ui/pixel-stage-bg.png")})`,
        "--home-hud-texture": `url(${withBasePath("/ui/home-pixel-hud.png")})`,
        "--frame-corner-tl": `url(${withBasePath("/ui/frame-corner-tl.png")})`,
        "--frame-corner-tr": `url(${withBasePath("/ui/frame-corner-tr.png")})`,
        "--frame-corner-bl": `url(${withBasePath("/ui/frame-corner-bl.png")})`,
        "--frame-corner-br": `url(${withBasePath("/ui/frame-corner-br.png")})`,
        "--frame-edge-side": `url(${withBasePath("/ui/frame-edge-vertical.png")})`,
        "--frame-edge-horizontal": `url(${withBasePath("/ui/frame-edge-horizontal.png")})`,
        "--ideal-market-frame": `url(${withBasePath("/ui/ideal-market-frame.png")})`,
        "--ideal-monster-frame": `url(${withBasePath("/ui/ideal-monster-frame.png")})`,
        "--ideal-result-frame": `url(${withBasePath("/ui/ideal-result-frame.png")})`,
        "--ideal-team-frame": `url(${withBasePath("/ui/ideal-team-frame.png")})`,
        "--ideal-stats-frame": `url(${withBasePath("/ui/ideal-stats-frame.png")})`,
        "--ideal-market-graph": `url(${withBasePath("/ui/ideal-market-graph.png")})`,
        "--ideal-inner-texture": `url(${withBasePath("/ui/ideal-inner-texture.png")})`,
        "--stat-icon-hp": `url(${withBasePath("/ui/stat-clean-hp.png")})`,
        "--stat-icon-attack": `url(${withBasePath("/ui/stat-clean-attack.png")})`,
        "--stat-icon-defense": `url(${withBasePath("/ui/stat-clean-defense.png")})`,
        "--stat-icon-speed": `url(${withBasePath("/ui/stat-clean-speed.png")})`,
        "--stat-icon-luck": `url(${withBasePath("/ui/stat-clean-luck.png")})`,
        "--result-icon-exp": `url(${withBasePath("/ui/result-icon-exp.png")})`,
        "--result-icon-attack": `url(${withBasePath("/ui/stat-clean-attack.png")})`,
        "--result-icon-defense": `url(${withBasePath("/ui/stat-clean-defense.png")})`,
        "--result-icon-coin": `url(${withBasePath("/ui/result-icon-coin.png")})`,
        "--info-icon-company": `url(${withBasePath("/ui/info-company.png")})`,
        "--info-icon-shares": `url(${withBasePath("/ui/info-shares.png")})`,
        "--info-icon-attr": `url(${withBasePath("/ui/info-attr.png")})`,
        "--info-icon-trend": `url(${withBasePath("/ui/info-trend.png")})`
      } as CSSProperties}
    >
      <section className="market-panel home-market-panel pixel-panel">
        <FrameCorners />
        <div className="market-graph">
          <span>↗</span>
        </div>
        <div>
          <p>今日の市場エネルギー</p>
          <h2>
            {state.currentMarket.indexName}
            <strong className={state.currentMarket.change >= 0 ? "positive" : "negative"}>
              {formatSigned(state.currentMarket.change)}%
            </strong>
          </h2>
        </div>
        <div className="divider" />
        <div>
          <p>テーマ</p>
          <h2><span className="theme-pixel-icon" aria-hidden="true">▰</span>{state.currentMarket.theme}</h2>
        </div>
        <div className="market-source-row">
          <small>{marketSourceLabels[state.currentMarket.source]} / {formatLogTime(state.currentMarket.updatedAt)}</small>
          <button className="market-refresh-button" onClick={onRefreshMarket}>更新</button>
        </div>
      </section>

      {offlineReward && (
        <section className={`home-offline-claim pixel-panel ${offlineAtCap ? "offline-max" : ""}`}>
          <FrameCorners />
          <em
            className="offline-fill"
            aria-hidden="true"
            style={{ width: `${offlineProgress}%` }}
          />
          <span>{offlineAtCap ? "放置MAX" : "放置報酬"}</span>
          <strong>{offlineAtCap ? `${balance.offlineMaxHours}h` : `${offlineReward.hours}h`}</strong>
          <i>C+{offlineReward.kabuCoins.toLocaleString("ja-JP")} / D+{offlineReward.dividendCoins.toLocaleString("ja-JP")}</i>
          <button onClick={onClaimOffline}>受取</button>
        </section>
      )}

      <section className="home-alert-strip pixel-panel">
        <FrameCorners />
        <button className={`home-alert-button ${eventStatus.available ? "is-ready" : "is-done"}`} onClick={() => onNavigate("event")}>
          <span>作戦</span>
          <strong>{eventStatus.available ? eventStatus.rank : "完了"}</strong>
          <small>{eventStatus.available ? `${eventStatus.won ? "有利" : "不利"} / ${eventStatus.score}` : "本日完了"}</small>
        </button>
        <button className="home-alert-button" onClick={() => onNavigate("team")}>
          <span>チーム</span>
          <strong>{teamAttackSummary.memberCount}/3</strong>
          <small>{formatAttackPower(teamAttackSummary.totalAttack)}</small>
        </button>
        <button className="home-alert-button" onClick={() => onNavigate("gacha")}>
          <span>ガチャ</span>
          <strong>{gachaMainLabel}</strong>
          <small>{gachaSubLabel}</small>
        </button>
      </section>

      <button
        className={`home-recommend-panel pixel-panel ${recommendation.action === "claim" ? "is-claim" : ""}`}
        onClick={recommendation.action === "claim" ? onClaimOffline : () => onNavigate(recommendation.tab as Tab)}
      >
        <FrameCorners />
        <span>今日のおすすめ</span>
        <strong>{recommendation.label}</strong>
        <b>{recommendation.action === "claim" ? "受取" : "移動"}</b>
        <small>{recommendation.detail}</small>
        <i className="home-recommend-meter" aria-hidden="true">
          <em style={{ width: `${recommendation.progress}%` }} />
        </i>
      </button>

      <section
        className="monster-card home-monster-card pixel-panel"
      >
        <FrameCorners />
        <div className="monster-stage">
          <MonsterArt monster={buddyMaster} large />
        </div>
        <div className="monster-info">
          <h2>{buddyMaster.name}</h2>
          <div className="stars">★★★★★</div>
          <p className="monster-line stock-line">銘柄: {buddyMaster.companyAlias}</p>
          <p className="monster-line shares-line">持ち株: <strong>{buddy.shares}</strong> 株</p>
          <p className="monster-line attr-line power-line">攻撃力: {attackPower.toLocaleString("ja-JP")}</p>
          <p className="monster-line attr-line calc-line">計算: {buddy.shares}株 × {buddyMaster.sharePrice.toLocaleString("ja-JP")}円</p>
          <p className="monster-line attr-line effect-line">
            効果: {attackBreakdown.effectName} / 配当単元 {attackBreakdown.dividendUnits}
            {attackBreakdown.dividendBonus > 0 && ` +${attackBreakdown.dividendBonus.toLocaleString("ja-JP")}`}
          </p>
          <p className="monster-line trend-line">
            終値変化:
            <strong className={state.currentMarket.change >= 0 ? "positive" : "negative"}>
              {" "}{formatSigned(state.currentMarket.change)}%
            </strong>
          </p>
        </div>
      </section>

      <section className="result-panel home-result-panel pixel-panel">
        <FrameCorners />
        <div className="section-label">本日の成長結果</div>
        <ResultTile kind="exp" label="トレーダー経験値" value={`+${trainResult?.traderExp ?? 0}`} />
        <ResultTile kind="attack" label="ガチャ券" value={`+${trainResult?.gachaTickets ?? 0}`} />
        <ResultTile kind="defense" label="攻撃力" value={attackPower.toLocaleString("ja-JP")} />
        <ResultTile kind="coin" label="配当" value={`+${trainResult?.dividendCoins ?? 80}`} />
      </section>

      <section className="team-effect home-team-effect pixel-panel">
        <FrameCorners />
        <span>◇</span>
        <div>
          <strong>チーム効果: {teamBonus.name}</strong>
          <p>{teamBonus.detail}</p>
          <div className="home-team-members">
            {teamSlots.map((member, index) => (
              <i key={member?.id ?? `empty-${index}`}>
                <b>{member?.name ?? `空き枠 ${index + 1}`}</b>
                <small>{member?.effectName ?? "編成待ち"}</small>
              </i>
            ))}
          </div>
          <div className="team-effect-metrics">
            <i>3体編成 {teamAttackSummary.memberCount}/3</i>
            <i>補正 x{teamAttackSummary.multiplier.toFixed(2)}</i>
            <i>総合攻撃力 {teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</i>
          </div>
        </div>
      </section>

    </div>
  );
}

function MissionPanel({
  state,
  message,
  onClaim
}: {
  state: GameState;
  message: string;
  onClaim: (id: string) => void;
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
    .slice(0, 8);
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
          const rewardText = [
            mission.reward.kabuCoins > 0 ? `C+${mission.reward.kabuCoins.toLocaleString("ja-JP")}` : "",
            mission.reward.dividendCoins > 0 ? `D+${mission.reward.dividendCoins}` : ""
          ].filter(Boolean).join(" / ");
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
              <small>{mission.progress} / {mission.target} ・ 報酬 {rewardText || "なし"}</small>
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
  const dataSourceCounts = getCompanyDataSourceCounts(playableMonsters);
  const rateLeader = allGachaRows[0];

  return (
    <div className="screen-content">
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
            市場エネルギー反映
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

      <section className="result-panel train-result-panel pixel-panel">
        <div className="section-label">育成結果</div>
        <ResultTile label="トレーダー経験値" value={`+${result?.traderExp ?? 0}`} />
        <ResultTile label="ガチャ券" value={`+${result?.gachaTickets ?? 0}`} />
        <ResultTile label="攻撃力" value={attackPower.toLocaleString("ja-JP")} />
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
  onNavigate,
  onClaimMission
}: {
  state: GameState;
  message: string;
  result: DailyEventResult | null;
  onRun: () => void;
  onNavigate: (tab: Tab) => void;
  onClaimMission: (id: string) => void;
}) {
  const status = getDailyEventStatus(state);
  const teamBonus = getTeamBonus(state);
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
  const upgradeTargets = getPurchaseUpgradeTargets(state, displayStatus).slice(0, 3);
  const upgradePanelTitle = displayStatus.won ? "次の強化候補" : "勝利までの購入目安";
  const upgradePanelDetail = displayStatus.won
    ? "余力を伸ばすなら、総合攻撃力の伸びが大きい株モンから買い増しします。"
    : "不足分を埋めるために、効果込みの総合攻撃力で必要株数を試算しています。";

  return (
    <div className="screen-content">
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
        <div className="event-reward-row">
          <span>カブコイン +{status.kabuCoins.toLocaleString("ja-JP")}</span>
          <span>配当 +{status.dividendCoins}</span>
          <span>トレーダー経験値 +{status.exp}</span>
        </div>
        <div className="message-box compact">
          現在: {teamBonus.name} / {teamBonus.detail}
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

      <MissionPanel state={state} message={message} onClaim={onClaimMission} />

      <LogList state={state} />
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

  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>チーム編成</h2>
        <p>3体でチームを組み、効果反映後の総合攻撃力で勝敗を決めます。</p>
        <div className="message-box">現在: {teamBonus.name} / {teamBonus.detail}</div>
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
      <section className="grid-panel">
        <div className="team-candidate-list-header">
          <strong>株モン一覧</strong>
          <span>編成中・所持済みを優先表示</span>
        </div>
        {candidateRows.map(({ monster, owned, inTeam, attack, projection, projectedBonus }) => {
          const projectedGain = projection?.gain ?? 0;
          const projectedTotal = projection?.summary.totalAttack ?? teamAttackSummary.totalAttack;
          const replacedName = projection?.replacedId ? monsterById.get(projection.replacedId)?.name : "";
          const actionLabel = !owned
            ? "未所持"
            : inTeam
              ? "外す"
              : state.team.length >= 3 && projectedGain > 0
                ? `+${formatAttackPower(projectedGain)}`
                : state.team.length >= 3
                  ? "入替"
                  : "編成";
          return (
            <article key={monster.id} className={`mini-card team-candidate-card pixel-panel ${inTeam ? "selected" : ""} ${owned ? "owned" : "locked-row"}`}>
              <MonsterArt monster={monster} />
              <div className="team-candidate-body">
                <div className="team-candidate-title">
                  <h3>{monster.name}</h3>
                  <em>{inTeam ? "編成中" : owned ? "所持" : monster.rarity}</em>
                </div>
                <small className="stock-code-chip">{monster.ticker} / {monster.companyAlias}</small>
                <p>{owned ? `${owned.shares}株 / 攻撃力 ${attack.toLocaleString("ja-JP")}` : `${monster.companyAlias} / 未所持`}</p>
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
                <button disabled={!owned} onClick={() => onToggle(monster.id)}>
                  {actionLabel}
                </button>
                <button disabled={!owned} onClick={() => onBuddy(monster.id)}>
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

  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>株モン図鑑</h2>
        <p>登録済み株モンの所持状況を確認できます。</p>
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
      <section className="dex-list">
        {dexRows.length > 0 ? dexRows.map(({ monster, owned, isBuddy, attack, dropRate }) => {
          return (
            <article key={monster.id} className={`dex-row pixel-panel ${owned ? "owned" : "locked-row"} ${isBuddy ? "is-buddy" : ""}`}>
              <MonsterArt monster={monster} />
              <div>
                <div className="dex-row-title">
                  <h3>{owned ? monster.name : "????"}</h3>
                  <em>{isBuddy ? "相棒" : owned ? `${owned.shares}株` : monster.rarity}</em>
                </div>
                <p className="stock-meta">{monster.ticker} / {monster.companyAlias} / 1株{monster.sharePrice.toLocaleString("ja-JP")}円 / {monster.rarity}</p>
                <p className="effect-meta">発行株数 {formatIssuedShares(monster.issuedShares)} / {formatCompanyDataSource(monster.dataSource)}</p>
                <p className="effect-meta">排出 {(dropRate * 100).toFixed(1)}% / 効果: {monster.effect.name}</p>
                <p className="owned-meta">{owned ? `${owned.shares}株 攻撃力${formatAttackPower(attack)}${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
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
  const operationPanelTitle = operationStatus.won ? "作戦余力を伸ばす" : "作戦勝利まで買い増し";
  const operationPanelDetail = operationStatus.won
    ? `現在は勝利見込み。総合攻撃力の伸びが大きい順に表示しています。`
    : `不足 ${formatAttackPower(operationMissingPower)} を効果込みの総合攻撃力で試算しています。`;

  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
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
          <div>
            <span>{targetRow.affordable ? "次の購入" : "次の目標"}</span>
            <strong>{targetRow.monster.name}</strong>
            <p>
              {targetRow.affordable
                ? `${formatCompactAmount(targetRow.quote.buyPrice)}で1株購入できます`
                : `あと${formatCompactAmount(targetShortage)}で1株購入できます`}
            </p>
            <div className="market-target-stats">
              <i>所持 {formatCompactAmount(state.kabuCoins)}</i>
              <i>必要 {formatCompactAmount(targetRow.quote.buyPrice)}</i>
            </div>
          </div>
          <div className="market-target-meter" aria-label="購入資金進捗">
            <span style={{ width: `${targetProgress}%` }} />
          </div>
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
            label: quantity === unitPlan.sharesNeeded && ![1, 10, 100].includes(quantity) ? "単元" : `${quantity}株`
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
                  <small>
                    単元到達後 攻撃力 {formatAttackPower(unitPlan.projectedAttack)}
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
                <div className="market-buy-options" aria-label={`${monster.name}の購入数`}>
                  {buyOptions.map((option) => (
                    <button
                      key={option.quantity}
                      disabled={!option.affordable}
                      title={`${option.quantity}株 ${option.totalPrice.toLocaleString("ja-JP")}コイン`}
                      onClick={() => onBuy(monster.id, option.quantity)}
                    >
                      {option.label}
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
        <h2>データ管理</h2>
        <p>試作中の確認用に、localStorageのセーブデータを初期状態へ戻せます。</p>
        <button className="danger-button full" onClick={onReset}>セーブ初期化</button>
      </section>
      <LegalNotice />
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
        <strong>データ状態</strong>
        <p>企業画像 {companyMonsterAssetDiagnostics.usableFiles}件 / 保存形式 v{SAVE_VERSION}</p>
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
        <strong>v0.2バランス</strong>
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
          {typeof dropWeight === "number" && <span>補正 x{dropWeight.toFixed(1)}</span>}
          <span>{formatCompanyDataSource(monster.dataSource)}</span>
          <span>{monster.dividendType}</span>
        </div>
        <strong>{owned ? `攻撃力 ${getAttackPower(owned).toLocaleString("ja-JP")}` : `購入時 ${attackPerShare.toLocaleString("ja-JP")}`}</strong>
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
  const showPlaceholder = !monster.assetReady || failed;

  return (
    <div className={`monster-art ${large ? "large" : ""} ${showPlaceholder ? "placeholder-art" : ""} monster-${monster.id}`}>
      {!showPlaceholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={large ? monster.image : monster.icon}
          alt={monster.name}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={large ? "high" : "auto"}
          onError={() => setFailed(true)}
        />
      )}
      {showPlaceholder && (
        <div className="placeholder-creature" aria-label={`${monster.name}の仮画像`}>
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

function LogList({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const logs = compact ? state.logs.slice(0, 2) : state.logs.slice(0, 8);
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

function BottomNav({
  activeTab,
  onChange
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={activeTab === item.id ? "active" : ""}
          style={{ "--nav-icon": `var(--nav-icon-${item.icon})` } as CSSProperties}
          onClick={() => onChange(item.id)}
        >
          <span aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
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
