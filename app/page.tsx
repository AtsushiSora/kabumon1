"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buyMonsterFromMarket,
  claimMissionReward,
  claimOfflineReward,
  createInitialState,
  formatSigned,
  getDisplayStats,
  getMissions,
  getRequiredExp,
  getTeamBonus,
  getUnitSellPrice,
  hydrateState,
  marketPrices,
  rollGacha,
  sellMonsterUnit,
  setBuddy,
  STORAGE_KEY,
  toggleTeamMember,
  toggleMonsterLock,
  trainBuddy,
  type GameState,
  type TrainResult
} from "@/lib/game";
import { monsterById, monsters, type MonsterMaster, type MonsterStats } from "@/lib/monsters";

type Tab = "home" | "gacha" | "train" | "team" | "dex" | "market";

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "gacha", label: "ガチャ", icon: "◆" },
  { id: "train", label: "育成", icon: "▲" },
  { id: "team", label: "チーム", icon: "◇" },
  { id: "dex", label: "図鑑", icon: "▤" },
  { id: "market", label: "マーケット", icon: "↗" }
];

export default function KabumonApp() {
  const [state, setState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [gachaMessage, setGachaMessage] = useState("");
  const [marketMessage, setMarketMessage] = useState("");
  const [missionMessage, setMissionMessage] = useState("");
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);

  useEffect(() => {
    setState(hydrateState(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (state) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

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

  const displayStats = getDisplayStats(buddy);

  function update(next: GameState) {
    setState(next);
  }

  function handleClaim() {
    update(claimOfflineReward(state!));
  }

  function handleGacha() {
    const result = rollGacha(state!);
    if (!result.monsterId) {
      setGachaMessage("カブコインが足りません。");
      return;
    }

    const monster = monsterById.get(result.monsterId);
    setGachaMessage(
      result.duplicate
        ? `${monster?.name ?? "株モン"}が重なり、持ち株が100株増えました。`
        : `${monster?.name ?? "株モン"}を新しく入手しました。`
    );
    update(result.state);
  }

  function handleTrain() {
    const result = trainBuddy(state!);
    if (!result.result) {
      setTrainResult(null);
      return;
    }
    setTrainResult(result.result);
    update(result.state);
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <Header state={state} />

        {activeTab === "home" && (
          <HomePanel
            state={state}
            buddy={buddy}
            buddyMaster={buddyMaster}
            displayStats={displayStats}
            teamBonus={teamBonus}
            trainResult={trainResult}
            onClaim={handleClaim}
            onGacha={() => {
              setActiveTab("gacha");
              handleGacha();
            }}
            onTrain={() => {
              setActiveTab("train");
              handleTrain();
            }}
            missionMessage={missionMessage}
            onClaimMission={(id) => {
              const result = claimMissionReward(state, id);
              setMissionMessage(result.message);
              update(result.state);
            }}
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
            result={trainResult}
            onTrain={handleTrain}
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
            }}
            onSell={(id) => {
              const monster = monsterById.get(id);
              const owned = state.owned[id];
              if (!monster || !owned) return;
              const sellPrice = getUnitSellPrice(monster.rarity, owned.level);
              if (window.confirm(`${monster.name}を100株売却しますか？\n獲得コイン: ${sellPrice.toLocaleString("ja-JP")}`)) {
                const result = sellMonsterUnit(state, id);
                setMarketMessage(result.message);
                update(result.state);
              }
            }}
            onReset={() => {
              if (window.confirm("セーブデータを初期状態に戻しますか？")) {
                setGachaMessage("");
                setMarketMessage("");
                setMissionMessage("");
                setTrainResult(null);
                update(createInitialState(new Date()));
                setActiveTab("home");
              }
            }}
          />
        )}

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
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
        <span className="avatar-pixel">◆</span>
        <span>{state.playerName}</span>
      </div>
      <CurrencyChip icon="C" value={state.kabuCoins} />
      <CurrencyChip icon="D" value={state.dividendCoins} />
    </header>
  );
}

function CurrencyChip({ icon, value }: { icon: string; value: number }) {
  return (
    <div className="currency-chip">
      <span>{icon}</span>
      <strong>{value.toLocaleString("ja-JP")}</strong>
      <b>+</b>
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
  onClaim,
  onGacha,
  onTrain,
  missionMessage,
  onClaimMission
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  displayStats: MonsterStats;
  teamBonus: ReturnType<typeof getTeamBonus>;
  trainResult: TrainResult | null;
  onClaim: () => void;
  onGacha: () => void;
  onTrain: () => void;
  missionMessage: string;
  onClaimMission: (id: string) => void;
}) {
  const expRequired = getRequiredExp(buddy.level);

  return (
    <div className="screen-content">
      <section className="market-panel pixel-panel">
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
          <h2>{state.currentMarket.theme}</h2>
        </div>
      </section>

      {state.offlinePending && (
        <section className="offline-panel pixel-panel">
          <div>
            <p>オフライン報酬 {state.offlinePending.hours}時間</p>
            <strong>
              カブコイン +{state.offlinePending.kabuCoins.toLocaleString("ja-JP")} / 配当 +{state.offlinePending.dividendCoins}
            </strong>
          </div>
          <button className="mini-gold-button" onClick={onClaim}>
            受取
          </button>
        </section>
      )}

      <section className="monster-card pixel-panel">
        <div className="monster-stage">
          <MonsterArt monster={buddyMaster} large />
        </div>
        <div className="monster-info">
          <h2>{buddyMaster.name}</h2>
          <div className="stars">★★★★★</div>
          <p>銘柄: {buddyMaster.companyAlias}</p>
          <div className="level-row">
            <strong>Lv.{buddy.level}</strong>
            <div className="exp-bar">
              <span style={{ width: `${Math.min(100, (buddy.exp / expRequired) * 100)}%` }} />
            </div>
            <small>あと {Math.max(0, expRequired - buddy.exp)}</small>
          </div>
          <p>持ち株: <strong>{buddy.shares}</strong> 株</p>
          <p>属性: {buddyMaster.attribute}</p>
          <p>
            終値変化:
            <strong className={state.currentMarket.change >= 0 ? "positive" : "negative"}>
              {" "}{formatSigned(state.currentMarket.change)}%
            </strong>
          </p>
          <MonsterArt monster={buddyMaster} />
        </div>
      </section>

      <section className="result-panel pixel-panel">
        <div className="section-label">本日の成長結果</div>
        <ResultTile label="経験値" value={`+${trainResult?.exp ?? 18}`} />
        <ResultTile label="攻撃" value={`+${trainResult?.statChanges.attack ?? 3}`} />
        <ResultTile label="防御" value={`+${trainResult?.statChanges.defense ?? 1}`} />
        <ResultTile label="配当" value={`+${trainResult?.dividendCoins ?? 80}`} />
      </section>

      <section className="team-effect pixel-panel">
        <span>◇</span>
        <div>
          <strong>チーム効果: {teamBonus.name}</strong>
          <p>{teamBonus.detail}</p>
        </div>
      </section>

      <DailyInfoPanel state={state} />

      <MissionPanel
        state={state}
        message={missionMessage}
        onClaim={onClaimMission}
      />

      <StatsPanel stats={displayStats} />

      <div className="primary-actions">
        <button className="blue-button" onClick={onGacha}>ガチャ</button>
        <button className="gold-button" onClick={onTrain}>育成する</button>
      </div>

      <LogList state={state} compact />
      <LegalNotice />
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
  const missions = getMissions(state).slice(0, 4);

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
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>銘柄ガチャ</h2>
        <p>カブコイン3,000で株モンを入手。被りは100株追加されます。</p>
        <button className="gold-button full" onClick={onGacha}>1回まわす</button>
        {message && <div className="message-box">{message}</div>}
      </section>
      <section className="grid-panel">
        {monsters.map((monster) => (
          <MonsterMiniCard key={monster.id} state={state} monster={monster} />
        ))}
      </section>
    </div>
  );
}

function TrainPanel({
  state,
  buddy,
  buddyMaster,
  result,
  onTrain
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  result: TrainResult | null;
  onTrain: () => void;
}) {
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>{buddyMaster.name}を育成</h2>
        <p>配当コイン40を使い、仮の市場エネルギーを反映します。</p>
        <button className="gold-button full" onClick={onTrain}>市場エネルギー反映</button>
        <div className="train-summary">
          <MonsterArt monster={buddyMaster} />
          <div>
            <strong>Lv.{buddy.level} / {buddy.shares}株</strong>
            <p>現在の配当コイン: {state.dividendCoins}</p>
          </div>
        </div>
        {result && (
          <div className="message-box">
            {result.market.indexName} {formatSigned(result.market.change)}% / 経験値 +{result.exp} / 配当 +{result.dividendCoins}
          </div>
        )}
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
      </section>
      <section className="grid-panel">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          const inTeam = state.team.includes(monster.id);
          return (
            <article key={monster.id} className={`mini-card pixel-panel ${inTeam ? "selected" : ""}`}>
              <MonsterArt monster={monster} />
              <h3>{monster.name}</h3>
              <p>{owned ? `${owned.shares}株 / Lv.${owned.level}` : "未所持"}</p>
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
        <p>初期5体の所持状況を確認できます。</p>
      </section>
      <section className="dex-list">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          return (
            <article key={monster.id} className={`dex-row pixel-panel ${owned ? "" : "locked-row"}`}>
              <MonsterArt monster={monster} />
              <div>
                <h3>{owned ? monster.name : "????"}</h3>
                <p>{monster.companyAlias} / {monster.ticker} / {monster.rarity}</p>
                <p>{owned ? `${owned.shares}株 Lv.${owned.level}${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
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
  onReset
}: {
  state: GameState;
  message: string;
  onBuy: (id: string) => void;
  onSell: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="screen-content">
      <section className="feature-panel pixel-panel">
        <h2>マーケット</h2>
        <p>カブコインで株モンを100株単位で購入できます。価格はゲーム内の固定価格です。</p>
        {message && <div className="message-box">{message}</div>}
      </section>
      <section className="market-list">
        {monsters.map((monster) => {
          const owned = state.owned[monster.id];
          const price = marketPrices[monster.rarity];
          const affordable = state.kabuCoins >= price;
          const sellable = Boolean(owned && owned.shares > 100 && !owned.locked);
          const sellPrice = owned ? getUnitSellPrice(monster.rarity, owned.level) : 0;
          return (
            <article key={monster.id} className="market-row pixel-panel">
              <MonsterArt monster={monster} />
              <div>
                <h3>{monster.name}</h3>
                <p>{monster.companyAlias} / {monster.rarity} / {monster.dividendType}</p>
                <p>{owned ? `${owned.shares}株 所持中${owned.locked ? " / ロック中" : ""}` : "未所持"}</p>
                {owned && <p>売却価格: {sellPrice.toLocaleString("ja-JP")}コイン / 100株</p>}
              </div>
              <div className="market-buy">
                <strong>{price.toLocaleString("ja-JP")}</strong>
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
        <p>v0.1は仮の終値変化で市場エネルギーを生成中</p>
      </div>
    </section>
  );
}

function MonsterMiniCard({ state, monster }: { state: GameState; monster: MonsterMaster }) {
  const owned = state.owned[monster.id];
  return (
    <article className={`mini-card pixel-panel ${owned ? "owned" : ""}`}>
      <MonsterArt monster={monster} />
      <h3>{monster.name}</h3>
      <p>{monster.rarity} / {monster.attribute}</p>
      <strong>{owned ? `${owned.shares}株` : "未所持"}</strong>
    </article>
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
    { key: "hp", label: "HP", max: 2200 },
    { key: "attack", label: "攻撃", max: 1600 },
    { key: "defense", label: "防御", max: 1600 },
    { key: "speed", label: "素早さ", max: 260 },
    { key: "luck", label: "運", max: 220 }
  ];

  return (
    <section className="stats-panel pixel-panel">
      {rows.map((row) => {
        const value = stats[row.key];
        return (
          <div className="stat-row" key={row.key}>
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

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LogList({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const logs = compact ? state.logs.slice(0, 2) : state.logs.slice(0, 8);
  return (
    <section className="log-list">
      {logs.map((log) => (
        <article key={log.id} className="log-row pixel-panel">
          <strong>{log.title}</strong>
          <p>{log.detail}</p>
        </article>
      ))}
    </section>
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
          onClick={() => onChange(item.id)}
        >
          <span>{item.icon}</span>
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
    "株価が下がる日でも、株モンでは防御やHPが育つことがあります。"
  ];
  const index = Math.abs(theme.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % items.length;
  return items[index];
}
