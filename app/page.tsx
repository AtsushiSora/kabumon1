"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  accrueOfflineReward,
  balance,
  buyMonsterFromMarket,
  calculateOfflineReward,
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
  getMarketQuote,
  getMissions,
  getRequiredExp,
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
import { monsterById, monsters, type MonsterMaster, type MonsterStats } from "@/lib/monsters";
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
};

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "gacha", label: "ガチャ", icon: "gacha" },
  { id: "train", label: "育成", icon: "train" },
  { id: "event", label: "作戦", icon: "event" },
  { id: "team", label: "チーム", icon: "team" },
  { id: "dex", label: "図鑑", icon: "dex" },
  { id: "market", label: "マーケット", icon: "market" }
];

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
          `トレーダーEXP +${reward.exp}`
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
        ? `${monster?.name ?? "株モン"}が重なり、持ち株が100株増えました。`
        : `${monster?.name ?? "株モン"}を新しく入手しました。`;
    setGachaMessage(message);
    update(result.state);
    setResultToast({
      title: result.duplicate ? "持ち株追加" : "新規入手",
      detail: message,
      tone: "gold",
      monster,
      metrics: ["100株", result.usedTicket ? "チケット消費" : "カブコイン消費"]
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
        result.result.traderExp > 0 ? `トレーダーEXP +${result.result.traderExp}` : `ガチャ券 +${result.result.gachaTickets}`,
        `配当 +${result.result.dividendCoins}`
      ]
    });
  }

  function handleDailyEvent() {
    const result = runDailyEvent(state!);
    setEventResult(result);
    update(result.state);
    setResultToast({
      title: result.ok ? "市場作戦完了" : "市場作戦",
      detail: result.message,
      tone: result.ok ? "green" : "blue",
      rank: result.status.rank,
      score: result.status.score,
      metrics: [
        `ランク ${result.status.rank}`,
        `スコア ${result.status.score}`,
        result.ok ? `カブコイン +${result.status.kabuCoins.toLocaleString("ja-JP")}` : "本日完了済み"
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
            result={eventResult}
            onRun={handleDailyEvent}
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
            onBuy={(id) => {
              const result = buyMonsterFromMarket(state, id);
              setMarketMessage(result.message);
              update(result.state);
              if (result.ok) {
                const monster = monsterById.get(id);
                setResultToast({
                  title: "マーケット購入",
                  detail: result.message,
                  tone: "gold",
                  monster,
                  metrics: ["100株", "購入完了"]
                });
              }
            }}
            onSell={(id) => {
              const monster = monsterById.get(id);
              if (!monster) return;
              const sellPrice = getMarketQuote(state, id).sellPrice;
              if (window.confirm(`${monster.name}を100株売却しますか？\n獲得コイン: ${sellPrice.toLocaleString("ja-JP")}`)) {
                const result = sellMonsterUnit(state, id);
                setMarketMessage(result.message);
                update(result.state);
                if (result.ok) {
                  setResultToast({
                    title: "100株売却",
                    detail: result.message,
                    tone: "green",
                    metrics: [`カブコイン +${sellPrice.toLocaleString("ja-JP")}`]
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
          />
        )}
      </section>
    </main>
  );
}

function Header({ state }: { state: GameState }) {
  return (
    <header className="top-header">
      <div className="brand-mark">
        <span className="market-icon">↗</span>
        <h1>株モン</h1>
      </div>
      <div className="trainer-chip">
        <span className="avatar-pixel" aria-hidden="true" />
        <span>Lv.{state.traderLevel}</span>
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
  onClose
}: {
  toast: ResultToast;
  onClose: () => void;
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
  onClaimOffline
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  displayStats: MonsterStats;
  teamBonus: ReturnType<typeof getTeamBonus>;
  trainResult: TrainResult | null;
  onRefreshMarket: () => void;
  onClaimOffline: () => void;
}) {
  const traderExpRequired = getRequiredExp(state.traderLevel);
  const traderExpPercent = Math.min(100, (state.traderExp / traderExpRequired) * 100);
  const attackPower = getAttackPower(buddy);
  const attackBreakdown = getAttackPowerBreakdown(buddy);
  const idleHourlyReward = calculateOfflineReward(state, 1);
  const offlineReward = state.offlinePending;
  const offlineProgress = offlineReward
    ? Math.min(100, (offlineReward.hours / balance.offlineMaxHours) * 100)
    : 0;
  const offlineAtCap = offlineProgress >= 100;

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
          <div className="level-row">
            <strong>Trader Lv.{state.traderLevel}</strong>
            <div className="exp-bar">
              <span style={{ width: `${traderExpPercent}%` }} />
            </div>
            <small>あと {Math.max(0, traderExpRequired - state.traderExp)}</small>
          </div>
          <p className="monster-line shares-line">持ち株: <strong>{buddy.shares}</strong> 株</p>
          <p className="monster-line attr-line power-line">攻撃力: {attackPower.toLocaleString("ja-JP")}</p>
          <p className="monster-line attr-line calc-line">計算: {buddy.shares}株 × {buddyMaster.sharePrice.toLocaleString("ja-JP")}円</p>
          <p className="monster-line attr-line effect-line">
            効果: {attackBreakdown.effectName}
            {attackBreakdown.dividendBonus > 0 && ` +${attackBreakdown.dividendBonus.toLocaleString("ja-JP")}`}
          </p>
          <p className="monster-line trend-line">
            終値変化:
            <strong className={state.currentMarket.change >= 0 ? "positive" : "negative"}>
              {" "}{formatSigned(state.currentMarket.change)}%
            </strong>
          </p>
          <div className="home-monster-mini">
            <MonsterArt monster={buddyMaster} />
          </div>
        </div>
      </section>

      <section className="result-panel home-result-panel pixel-panel">
        <FrameCorners />
        <div className="section-label">本日の成長結果</div>
        <ResultTile kind="exp" label="Trader EXP" value={`+${trainResult?.traderExp ?? 0}`} />
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
          <div className="team-effect-metrics">
            <i>C+{idleHourlyReward.kabuCoins.toLocaleString("ja-JP")}/h</i>
            <i>D+{idleHourlyReward.dividendCoins.toLocaleString("ja-JP")}/h</i>
            <i>EXP+{idleHourlyReward.exp.toLocaleString("ja-JP")}/h</i>
          </div>
        </div>
      </section>

      <StatsPanel stats={displayStats} />
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
  const missions = getMissions(state).slice(0, 7);

  return (
    <section className="mission-panel pixel-panel">
      <div className="mission-header">
        <strong>ミッション</strong>
        <span>{missions.filter((mission) => mission.completed && !mission.claimed).length}件受取可</span>
      </div>
      {message && <div className="message-box compact">{message}</div>}
      <div className="mission-list">
        {missions.map((mission) => (
          <article key={mission.id} className={`mission-row ${mission.completed ? "completed" : ""}`}>
            <div>
              <strong>{mission.title}</strong>
              <p>{mission.detail}</p>
              <small>{mission.progress} / {mission.target}</small>
            </div>
            <button
              disabled={!mission.completed || mission.claimed}
              onClick={() => onClaim(mission.id)}
            >
              {mission.claimed ? "済" : mission.completed ? "受取" : "進行中"}
            </button>
          </article>
        ))}
      </div>
    </section>
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
  const dropRates = getGachaDropRates();
  const dropRateById = new Map(dropRates.map((entry) => [entry.monsterId, entry.rate]));

  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>銘柄ガチャ</h2>
        <p>ガチャチケットまたはカブコイン{balance.gachaCost.toLocaleString("ja-JP")}で株モンを入手。排出率は発行株数をもとに調整されます。</p>
        <div className="message-box compact">所持チケット: {state.gachaTickets}枚</div>
        <button className="gold-button full" onClick={onGacha}>1回まわす</button>
        {message && <div className="message-box">{message}</div>}
      </section>
      <section className="grid-panel">
        {monsters.map((monster) => (
          <MonsterMiniCard key={monster.id} state={state} monster={monster} dropRate={dropRateById.get(monster.id)} />
        ))}
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
        <ResultTile label="Trader EXP" value={`+${result?.traderExp ?? 0}`} />
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
                ? `上昇でトレーダーEXP +${result.traderExp}`
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
  result,
  onRun
}: {
  state: GameState;
  result: DailyEventResult | null;
  onRun: () => void;
}) {
  const status = getDailyEventStatus(state);
  const teamBonus = getTeamBonus(state);
  const scorePercent = Math.min(100, (status.score / status.target) * 100);

  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel event-hero">
        <div>
          <h2>市場作戦</h2>
          <p>チームの総合力で1日1回の作戦に出ます。放置報酬とは別に、カブコイン、配当、トレーダーEXPを獲得できます。</p>
        </div>
        <div className={`event-rank rank-${status.rank.toLowerCase()}`}>
          <span>RANK</span>
          <strong>{status.rank}</strong>
        </div>
        <div className="event-score-grid">
          <span>作戦スコア <strong>{status.score}</strong></span>
          <span>目標 <strong>{status.target}</strong></span>
          <span>チーム力 <strong>{status.teamPower}</strong></span>
          <span>市場補正 <strong>x{status.marketModifier.toFixed(2)}</strong></span>
        </div>
        <div className="event-progress">
          <span style={{ width: `${scorePercent}%` }} />
        </div>
        <button className="gold-button full" disabled={!status.available} onClick={onRun}>
          {status.available ? "作戦開始" : "本日完了"}
        </button>
        <div className="event-reward-row">
          <span>カブコイン +{status.kabuCoins.toLocaleString("ja-JP")}</span>
          <span>配当 +{status.dividendCoins}</span>
          <span>Trader EXP +{status.exp}</span>
        </div>
        <div className="message-box compact">
          現在: {teamBonus.name} / {teamBonus.detail}
        </div>
        {result && (
          <div className="message-box">
            {result.message}
          </div>
        )}
      </section>

      <section className="grid-panel">
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
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>チーム編成</h2>
        <p>3体まで編成できます。編成中の株モンは放置報酬に影響します。</p>
        <div className="message-box">現在: {teamBonus.name} / {teamBonus.detail}</div>
        <div className="team-bonus-grid">
          <span>放置 x{teamBonus.offlineMultiplier.toFixed(2)}</span>
          <span>Trader EXP x{teamBonus.expMultiplier.toFixed(2)}</span>
          <span>配当 x{teamBonus.dividendMultiplier.toFixed(2)}</span>
        </div>
      </section>
      <section className="grid-panel">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          const inTeam = state.team.includes(monster.id);
          return (
            <article key={monster.id} className={`mini-card pixel-panel ${inTeam ? "selected" : ""}`}>
              <MonsterArt monster={monster} />
              <h3>{monster.name}</h3>
              <p>{owned ? `${owned.shares}株 / 攻撃力 ${getAttackPower(owned).toLocaleString("ja-JP")}` : "未所持"}</p>
              <div className="mini-actions">
                <button disabled={!owned} onClick={() => onToggle(monster.id)}>
                  {inTeam ? "外す" : "編成"}
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
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>株モン図鑑</h2>
        <p>登録済み株モンの所持状況を確認できます。</p>
      </section>
      <section className="dex-list">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          return (
            <article key={monster.id} className={`dex-row pixel-panel ${owned ? "" : "locked-row"}`}>
              <MonsterArt monster={monster} />
              <div>
                <h3>{owned ? monster.name : "????"}</h3>
                <p className="stock-meta">{monster.companyAlias} / 1株{monster.sharePrice.toLocaleString("ja-JP")}円 / {monster.rarity}</p>
                <p className="effect-meta">発行株数 {formatIssuedShares(monster.issuedShares)} / 効果: {monster.effect.name}</p>
                <p className="owned-meta">{owned ? `${owned.shares}株 攻撃力${formatCompactAmount(getAttackPower(owned))}${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
              </div>
              <div className="dex-actions">
                <button disabled={!owned} onClick={() => onBuddy(monster.id)}>相棒</button>
                <button disabled={!owned} onClick={() => onLock(monster.id)}>
                  {owned?.locked ? "解除" : "ロック"}
                </button>
              </div>
            </article>
          );
        })}
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
  onBuy: (id: string) => void;
  onSell: (id: string) => void;
  onRefreshMarket: () => void;
  onReset: () => void;
}) {
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>マーケット</h2>
        <p>カブコインで株モンを100株単位で購入できます。基準価格は1株価格×100株です。</p>
        <div className="market-price-note">
          <span>{state.currentMarket.theme}</span>
          <strong>{formatSigned(state.currentMarket.change)}%</strong>
          <small>本日の価格補正</small>
          <small>{marketSourceLabels[state.currentMarket.source]} {formatLogTime(state.currentMarket.updatedAt)}</small>
        </div>
        <button className="mini-gold-button market-refresh-wide" onClick={onRefreshMarket}>市場データ更新</button>
        {message && <div className="message-box">{message}</div>}
      </section>
      <section className="market-list">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          const quote = getMarketQuote(state, monster.id);
          const affordable = state.kabuCoins >= quote.buyPrice;
          const sellable = Boolean(owned && owned.shares > 100 && !owned.locked);
          return (
            <article key={monster.id} className="market-row pixel-panel">
              <MonsterArt monster={monster} />
              <div>
                <h3>{monster.name}</h3>
                <p className="stock-meta">{monster.companyAlias} / 1株{monster.sharePrice.toLocaleString("ja-JP")}円 / {monster.dividendType}</p>
                <p className="effect-meta">{monster.effect.name}: {monster.effect.description}</p>
                <p className="owned-meta">{owned ? `${owned.shares}株 攻撃力${formatCompactAmount(getAttackPower(owned))}${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
                <div className="market-quote">
                  <span className={quote.themeMatched ? "matched" : ""}>
                    {quote.themeMatched ? "テーマ一致" : "分散価格"}
                  </span>
                  <span>市場 x{quote.marketMultiplier.toFixed(2)}</span>
                  <span>保有 x{quote.demandMultiplier.toFixed(2)}</span>
                </div>
                {owned && <p>売却価格: {quote.sellPrice.toLocaleString("ja-JP")}コイン / 100株</p>}
              </div>
              <div className="market-buy">
                <strong title={`${quote.buyPrice.toLocaleString("ja-JP")}コイン`}>
                  {formatCompactAmount(quote.buyPrice)}
                </strong>
                <small title={`基準 ${quote.basePrice.toLocaleString("ja-JP")}コイン`}>
                  基準 {formatCompactAmount(quote.basePrice)}
                </small>
                <button disabled={!affordable} onClick={() => onBuy(monster.id)}>
                  購入
                </button>
                <button className="sell-button" disabled={!sellable} onClick={() => onSell(monster.id)}>
                  売却
                </button>
              </div>
            </article>
          );
        })}
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

  return (
    <section className="daily-info pixel-panel">
      <div>
        <strong>株ミニ知識</strong>
        <p>{knowledge}</p>
      </div>
      <div>
        <strong>データ状態</strong>
        <p>v0.3は保存形式 v{SAVE_VERSION} と市場データ連携の受け皿を検証中</p>
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
        <ReportTile label="Trader EXP" value={`+${summary.exp.toLocaleString("ja-JP")}`} />
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
  dropRate
}: {
  state: GameState;
  monster: MonsterMaster;
  dropRate?: number;
}) {
  const owned = state.owned[monster.id];
  return (
    <article className={`mini-card pixel-panel ${owned ? "owned" : ""}`}>
      <MonsterArt monster={monster} />
      <h3>{monster.name}</h3>
      <p className="stock-meta">{monster.rarity} / 1株{monster.sharePrice.toLocaleString("ja-JP")}円</p>
      {typeof dropRate === "number" && <p className="drop-rate-meta">排出率 {(dropRate * 100).toFixed(1)}%</p>}
      <strong>{owned ? `攻撃力 ${formatCompactAmount(getAttackPower(owned))}` : "未所持"}</strong>
    </article>
  );
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
