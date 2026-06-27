import { getRequiredExp, type GameState } from "@/lib/game";

export function AppHeader({ state }: { state: GameState }) {
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
          <div className="trainer-chip-title">
            <span>トレーダー Lv.{state.traderLevel}</span>
            <b>{state.traderExp.toLocaleString("ja-JP")} / {traderExpRequired.toLocaleString("ja-JP")}</b>
          </div>
          <div className="trainer-exp-row">
            <em>EXP</em>
            <div className="trainer-exp-bar" aria-label="トレーダー経験値">
              <i style={{ width: `${traderExpPercent}%` }} />
            </div>
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
