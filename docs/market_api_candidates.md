# 株モン 市場データAPI候補

## 推奨方針

v0.3では、まず `MARKET_API_PROVIDER=mock` を既定値にして、APIキーなしで開発できる状態を維持します。

本物の市場データへ進める場合は、第一候補を Twelve Data にします。理由は、グローバル市場対応、JSON API、シンボル検索、Quote API がまとまっていて、日本株対応の検証に進みやすいためです。

GitHub Pages公開版は静的ホスティングのため、`/api/market` はビルド時に生成されるモック市場データとして扱います。本物のAPIキーを使ったリアルタイム取得は、後でNetlifyなどサーバー実行できる環境に移す方針です。

## 候補

### 1. Twelve Data

用途:

- 日本株を含むグローバル銘柄の候補
- Quote API / Time Series API
- 将来的な銘柄検索

確認元:

- https://twelvedata.com/market-data
- https://twelvedata.com/docs/market-data/time-series
- https://twelvedata.com/docs/advanced

実装メモ:

- APIキーはサーバー側の環境変数に置く
- `/api/market` 内で `https://api.twelvedata.com/quote` へ接続する
- `percent_change` を `MarketEnergy.change` へ変換する
- 対象シンボルと取引所/MICは、実際のAPIキー取得後に検証する

### 2. Alpha Vantage

用途:

- 軽量なQuote取得
- APIキー取得後の低コスト検証

確認元:

- https://www.alphavantage.co/documentation/

実装メモ:

- `GLOBAL_QUOTE` は1銘柄の最新価格/変化率確認に使いやすい
- 無料枠や更新頻度の制限があるため、ゲーム内ではキャッシュ前提にする
- 日本株シンボルの対応は実キーで検証が必要

### 3. Finnhub

用途:

- 将来的な銘柄マスタ、企業情報、補助データ
- グローバル株式データの検証候補

確認元:

- https://finnhub.io/
- https://finnhub.io/docs/api/introduction
- https://api.finnhub.io/docs/api/quote

実装メモ:

- シンボル体系は `Exchange_Ticker.Exchange_Code` 形式
- 日本株の実運用可否、遅延条件、利用規約はAPIキー取得後に確認する

## 次の実装順

完了済み:

- `/api/market` に `MARKET_API_PROVIDER` 分岐を追加
- `mock` / `twelvedata` / `alphavantage` の3系統を用意
- APIキーまたはシンボルがない場合はゲーム内データへフォールバック
- 実APIレスポンスを `MarketEnergy` に正規化
- 取得失敗時はゲーム内シミュレーションへフォールバック
- `MARKET_API_CACHE_SECONDS` によるサーバー側短時間キャッシュを追加

次:

1. Twelve DataのAPIキーを入れて日本株または指数系シンボルを検証
2. 株モン向けに使う代表シンボルを決定
3. キャッシュ時間と更新UIの体感を調整
