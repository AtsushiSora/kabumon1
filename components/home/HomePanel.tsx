"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  balance,
  formatSigned,
  getAttackPower,
  getAttackPowerBreakdown,
  getTeamAttackSummary,
  getTeamBonus,
  marketSourceLabels,
  type GameState,
  type MarketEnergy
} from "@/lib/game";
import { monsterById, type MonsterMaster } from "@/lib/monsters";
import { withBasePath } from "@/lib/paths";

type HomeNavigationTarget = "event" | "dex" | "policy" | "team";

type HomeTeamSlot = {
  id: string;
  name: string;
  master: MonsterMaster;
  attack: number;
} | null;

export function HomePanel({
  state,
  buddy,
  buddyMaster,
  teamBonus,
  onRefreshMarket,
  onClaimOffline,
  onNavigate
}: {
  state: GameState;
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  teamBonus: ReturnType<typeof getTeamBonus>;
  onRefreshMarket: () => void;
  onClaimOffline: () => void;
  onNavigate: (tab: HomeNavigationTarget) => void;
}) {
  const attackPower = getAttackPower(buddy);
  const attackBreakdown = getAttackPowerBreakdown(buddy);
  const teamSlots: HomeTeamSlot[] = Array.from({ length: 3 }, (_, index) => {
    const id = state.team[index];
    const owned = id ? state.owned[id] : undefined;
    const master = id ? monsterById.get(id) : undefined;
    if (!owned || !master) {
      return null;
    }
    return {
      id,
      name: master.name,
      master,
      attack: getAttackPower(owned)
    };
  });
  const teamAttackSummary = getTeamAttackSummary(state);
  const offlineReward = state.offlinePending;
  const offlineProgress = offlineReward
    ? Math.min(100, (offlineReward.hours / balance.offlineMaxHours) * 100)
    : 0;
  const offlineAtCap = offlineProgress >= 100;
  const sourceLabel = formatCompanyDataSource(buddyMaster.dataSource);
  const unitAttack = buddyMaster.sharePrice * 100;
  const homeMarketIndexName = state.currentMarket.indexName === "マーケット225"
    ? "日経平均"
    : state.currentMarket.indexName;
  const homeMarketThemeName = "モビリティ";

  return (
    <div
      className={`screen-content home-screen ${offlineReward ? "has-offline-reward" : ""}`}
      style={{
        "--home-stage-bg": `url(${withBasePath("/ui/home-stage-bg-v2.png")})`,
        "--home-hud-texture": `url(${withBasePath("/ui/home-pixel-hud.png")})`,
        "--frame-corner-tl": `url(${withBasePath("/ui/frame-corner-tl.png")})`,
        "--frame-corner-tr": `url(${withBasePath("/ui/frame-corner-tr.png")})`,
        "--frame-corner-bl": `url(${withBasePath("/ui/frame-corner-bl.png")})`,
        "--frame-corner-br": `url(${withBasePath("/ui/frame-corner-br.png")})`,
        "--frame-edge-side": `url(${withBasePath("/ui/frame-edge-vertical.png")})`,
        "--frame-edge-horizontal": `url(${withBasePath("/ui/frame-edge-horizontal.png")})`,
        "--ideal-market-graph": `url(${withBasePath("/ui/market-graph-v2.png")})`,
        "--ideal-inner-texture": `url(${withBasePath("/ui/ideal-inner-texture.png")})`,
        "--info-icon-company": `url(${withBasePath("/ui/info-company.png")})`,
        "--info-icon-shares": `url(${withBasePath("/ui/info-shares.png")})`,
        "--info-icon-attr": `url(${withBasePath("/ui/info-attr.png")})`,
        "--info-icon-trend": `url(${withBasePath("/ui/info-trend.png")})`
      } as CSSProperties}
    >
      <HomeMonsterOverview
        buddy={buddy}
        buddyMaster={buddyMaster}
        attackPower={attackPower}
        attackBreakdown={attackBreakdown}
        sourceLabel={sourceLabel}
        unitAttack={unitAttack}
        marketChange={state.currentMarket.change}
        onDetails={() => onNavigate("dex")}
      />

      <HomeMarketOverview
        market={state.currentMarket}
        indexName={homeMarketIndexName}
        themeName={homeMarketThemeName}
        onRefresh={onRefreshMarket}
      />

      <HomeTeamOverview
        teamSlots={teamSlots}
        teamBonus={teamBonus}
        teamAttackSummary={teamAttackSummary}
        onEdit={() => onNavigate("team")}
      />

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

    </div>
  );
}

function HomeMonsterOverview({
  buddy,
  buddyMaster,
  attackPower,
  attackBreakdown,
  sourceLabel,
  unitAttack,
  marketChange,
  onDetails
}: {
  buddy: NonNullable<GameState["owned"][string]>;
  buddyMaster: MonsterMaster;
  attackPower: number;
  attackBreakdown: ReturnType<typeof getAttackPowerBreakdown>;
  sourceLabel: string;
  unitAttack: number;
  marketChange: number;
  onDetails: () => void;
}) {
  const nameLengthClass =
    buddyMaster.name.length >= 9
      ? "is-very-long"
      : buddyMaster.name.length >= 7
        ? "is-long"
        : "";

  return (
    <section className="monster-card home-monster-card pixel-panel">
      <FrameCorners />
      <div className="monster-stage">
        <MonsterArt monster={buddyMaster} large />
        <div className="home-rarity-strip">
          <span>レアリティ</span>
          <strong>★★★★★</strong>
        </div>
      </div>
      <div className="monster-info">
        <h2>
          <span className={`home-monster-name ${nameLengthClass}`}>{buddyMaster.name}</span>
          <span className="home-rarity-badge">{buddyMaster.rarity}</span>
        </h2>
        <div className="home-monster-summary" aria-label="銘柄データ">
          <span>{buddyMaster.ticker}</span>
          <span>{sourceLabel}</span>
          <span>{buddyMaster.dividendType}</span>
        </div>
        <p className="monster-line stock-line">
          <span className="stat-label">銘柄コード</span>
          <strong className="stat-value">{buddyMaster.ticker}</strong>
        </p>
        <p className="monster-line stock-line company-line">
          <span className="stat-label">企業</span>
          <strong className="stat-value">{buddyMaster.companyAlias}</strong>
        </p>
        <p className="monster-line shares-line">
          <span className="stat-label">保有株数</span>
          <strong className="stat-value">{buddy.shares.toLocaleString("ja-JP")} 株</strong>
        </p>
        <p className="monster-line attr-line power-line">
          <span className="stat-label">攻撃力</span>
          <strong className="stat-value">{attackPower.toLocaleString("ja-JP")}</strong>
        </p>
        <p className="monster-line attr-line calc-line">100株攻撃: {unitAttack.toLocaleString("ja-JP")}</p>
        <p className="monster-line attr-line effect-line">
          <span className="stat-label">配当効果</span>
          <strong className="stat-value">
            {attackBreakdown.dividendBonus > 0
              ? `+${attackBreakdown.dividendBonus.toLocaleString("ja-JP")}`
              : attackBreakdown.effectName}
          </strong>
        </p>
        <p className="monster-line trend-line">
          <span className="stat-label">データ出典</span>
          <strong className="stat-value">{sourceLabel}</strong>
        </p>
        <p className="monster-line trend-line home-trend-line">
          今日:
          <strong className={marketChange >= 0 ? "positive" : "negative"}>
            {" "}{formatSigned(marketChange)}%
          </strong>
        </p>
        <button className="monster-detail-button" onClick={onDetails}>
          モンスター詳細
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

function HomeMarketOverview({
  market,
  indexName,
  themeName,
  onRefresh
}: {
  market: MarketEnergy;
  indexName: string;
  themeName: string;
  onRefresh: () => void;
}) {
  return (
    <section className="market-panel home-market-panel pixel-panel">
      <FrameCorners />
      <div className="market-graph">
        <span>↗</span>
      </div>
      <div className="home-market-main">
        <p>今日の市場</p>
        <h2>
          {indexName}
          <strong className={market.change >= 0 ? "positive" : "negative"}>
            {formatSigned(market.change)}%
          </strong>
        </h2>
      </div>
      <div className={`home-market-sparkline ${market.change >= 0 ? "positive" : "negative"}`} aria-hidden="true">
        <i />
      </div>
      <div className="divider" />
      <div className="home-market-theme">
        <p>テーマ</p>
        <h2><span className="theme-pixel-icon" aria-hidden="true">▰</span><span className="theme-name">{themeName}</span></h2>
      </div>
      <div className="market-source-row">
        <small>{marketSourceLabels[market.source]} / {formatLogTime(market.updatedAt)}</small>
        <button className="market-refresh-button" onClick={onRefresh}>更新</button>
      </div>
    </section>
  );
}

function HomeTeamOverview({
  teamSlots,
  teamBonus,
  teamAttackSummary,
  onEdit
}: {
  teamSlots: HomeTeamSlot[];
  teamBonus: ReturnType<typeof getTeamBonus>;
  teamAttackSummary: ReturnType<typeof getTeamAttackSummary>;
  onEdit: () => void;
}) {
  return (
    <section className="team-effect home-team-effect pixel-panel">
      <FrameCorners />
      <span className="home-team-icon" aria-hidden="true">⚙</span>
      <div>
        <div className="home-team-heading">
          <strong>チーム効果</strong>
          <em>チーム総攻撃力 <b>{teamAttackSummary.totalAttack.toLocaleString("ja-JP")}</b></em>
        </div>
        <div className="home-team-cards">
          {teamSlots.map((member, index) => (
            <article key={member?.id ?? `empty-${index}`} className={!member ? "empty" : ""}>
              {member ? <MonsterArt monster={member.master} /> : <span className="team-empty-art">+</span>}
              <div>
                <b
                  className={
                    member && member.name.length >= 9
                      ? "team-member-name is-very-long"
                      : member && member.name.length >= 7
                        ? "team-member-name is-long"
                        : "team-member-name"
                  }
                  title={member?.name}
                >
                  {member?.name ?? `空き枠 ${index + 1}`}
                </b>
                <small>{member ? `攻撃 ${member.attack.toLocaleString("ja-JP")}` : "編成待ち"}</small>
              </div>
            </article>
          ))}
        </div>
        <div className="home-team-footer">
          <p><b>チーム効果: {teamBonus.name}</b> {teamBonus.detail}</p>
          <button className="home-team-action" onClick={onEdit}>
            チーム編成
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="team-effect-metrics">
          <i>3体編成 {teamAttackSummary.memberCount}/3</i>
          <i>補正 x{teamAttackSummary.multiplier.toFixed(2)}</i>
          <i>{teamBonus.active ? "効果発動中" : "組み合わせ確認"}</i>
        </div>
      </div>
    </section>
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

function formatCompanyDataSource(source: MonsterMaster["dataSource"]): string {
  if (source === "live") return "実データ";
  if (source === "manual") return "手入力";
  return "推定データ";
}

function formatLogTime(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
