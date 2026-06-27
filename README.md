# 株モン

株モンは、株式をテーマにした育成・放置ゲームアプリです。

スマホ縦画面向けのWebアプリとして作成しています。現在は `public/monsters/<コード>-<企業名>.png` などの画像ファイルから企業モンスターを自動生成し、ガチャ、放置報酬、図鑑、チーム、マーケット購入、株数管理を動かします。

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで以下を開きます。

```text
http://localhost:3000
```

## 検証コマンド

```bash
npm run verify
```

このコマンドで、企業画像取り込み、企業データCSV生成、上書きデータpreview/import、変換テスト、TypeScript型チェックをまとめて確認できます。

CIでは次のコマンドを使い、生成ファイルのコミット漏れも検出します。

```bash
npm run verify:ci
```

企業データ周りだけ確認したい場合:

```bash
npm run verify:company-data
```

## 企業モンスター画像

企業モンスター画像は `public/monsters/` に置きます。ファイル名にコードと企業名が入っていれば自動登録されます。

```text
public/monsters/<コード>-<企業名>.png
public/monsters/<コード> <企業名>.png
public/monsters/<コード>_<企業名>.png
```

例:

```text
public/monsters/5108-ブリヂストン.png
public/monsters/5108 ブリヂストン.png
```

画像追加後は次のコマンドで、企業モンスター一覧と背景透明版をまとめて更新します。

```bash
npm run prepare:monsters
```

透明版は `public/monsters/transparent/` に生成されます。元画像が変わっていない場合は生成をスキップするため、通常の確認は高速です。

開発サーバー、通常ビルド、GitHub Pagesビルド、検証コマンドの前にも `prepare:monsters` が自動で走ります。

株価・発行株数・配当タイプ・レア度を上書きしたい場合は、[docs/company-data-overrides.md](/Users/soratokushi/Desktop/株モン/docs/company-data-overrides.md) の手順に沿って `docs/company-data-template.csv` を編集します。

## 現在の完成度

v0.1: 100%
v0.2: 100%
v0.3: 100%

完了済み:

- Next.js + TypeScript + Tailwind CSS の土台
- 参考画像寄せのスマホ縦UI
- 企業画像ファイル名からの株モン自動生成
- localStorage保存
- 放置報酬
- ガチャ
- 育成
- チーム編成
- 図鑑
- 簡易マーケット購入
- 100株売却
- ロック機能
- セーブ初期化
- 注意文表示
- 株ミニ知識
- 企業モンスター画像の反映
- ミッションの初期実装
- デイリーログインボーナス
- 連続ログイン日数
- ログインボーナス系ミッション
- チーム効果の実数値反映
- チーム効果発動ミッション
- 本日の運用レポート
- ログの獲得量表示
- PWA manifest
- ホーム画面追加用アイコン
- モバイルWebアプリ用メタデータ
- 市場テーマと変動率によるマーケット価格調整
- 保有株数に応じた買値補正
- レベルと市場状況に応じた売値補正
- ガチャ、育成、報酬受取の結果モーダル
- モンスター台座と結果表示の軽いアニメーション
- 保存データのバージョン管理
- 旧保存形式からの自動移行
- 壊れた保存値の基本補正
- サービスワーカー登録
- オフライン用ページ
- 最低限のアプリシェルキャッシュ
- v0.2バランス定数
- ガチャ、育成、放置上限、ログ保持数の一元管理
- マーケット基準価格の調整
- ホーム画面のバランス目安表示
- 市場データ連携の受け皿
- 市場データのソース/更新時刻表示
- 市場データ更新ボタン
- `/api/market` モックAPIルート
- 市場データ更新ボタンのAPI接続
- API失敗時のゲーム内データフォールバック
- 市場データAPI候補整理
- `MARKET_API_PROVIDER` によるAPI分岐
- Twelve Data / Alpha Vantage 用のサーバー側取得処理
- APIキー未設定時の自動フォールバック
- 市場データAPIのサーバー側短時間キャッシュ
- `.env.example` 追加
- GitHub Pages用の静的書き出し設定
- GitHub ActionsによるPagesデプロイ設定
- `/kabumon1` 配下で動く画像、manifest、service workerパス対応
- GitHub Pages公開URLへのアプリ本体反映確認
- 1日1回の「市場作戦」イベント
- 市場作戦報酬とチーム経験値付与
- 市場作戦ミッション
- 保存形式 v3 への移行
- ホームの市場作戦カード
- 市場作戦のスコア進捗バー
- 市場テーマ「エネルギー」とチーム効果「インフラ安定網」
- 市場作戦のランク結果アニメーション
- ホーム画面のスクロールなし一枚ダッシュボード化
- ホーム画面からガチャ/育成の大ボタンを外し、株モン表示を拡大
- ホーム画面の外枠固定化
- 育成タブのメイン画面化
- ホーム画面を当初案寄せのドットUI配置へ再調整
- 生成したドット絵背景パーツをホームのモンスターカードへ合成
- ホームの結果タイルとステータスバーを初期案寄せのドットUIへ調整
- 育成タブにも生成ドット背景を合成
- ガチャ、作戦、チーム、図鑑、マーケットの共通パネルをドットUIへ統一
- iPhone実機スクリーンショットを元にホームの縦収まりを再調整
- 生成したドットHUDテクスチャをホーム全体へ合成
- 参考画像に合わせてヘッダー、テーマ、情報アイコン、ステータス表示を再調整
- ホームのモンスター画像を低解像度拡大でドット風表示へ調整
- ホーム背景のHUD残像を外し、濃い青のドットグリッド背景へ再調整
- ホームのメインモンスターが途切れない全身表示へ再調整
- ホームのメインモンスターに被る台座リング演出を非表示化
- 全体の文字をレトロなドット風フォント表現へ調整
- 生成フレーム角パーツをホーム主要パネルへ反映
- 61件の企業モンスター画像取り込み
- 企業モンスター画像の背景透明版自動生成
- 画像追加時の差分生成
- 既存の特別7体から企業モンスターへの保存データ移行
- 1株単位の持ち株管理と100株単位の配当効果
- 発行株数ベースのガチャ排出率
- 企業データ上書きCSV、preview、import、検証コマンド

残り:

- v0.1の最小試作は完了
- v0.2は完了
- v0.3では公開版の実機表示確認、追加モンスター拡張、実APIキーでの銘柄検証、クラウド保存、バトル要素の拡張を検討

## 公開URL

GitHub Pages:

```text
https://atsushisora.github.io/kabumon1/
```

`main` ブランチへpushすると、GitHub Actionsが `npm run build:pages` を実行して `out` をGitHub Pagesへデプロイします。

2026-06-06時点で、公開URLがREADME表示からNext.jsアプリ本体へ切り替わるところまで確認済みです。

GitHub Pagesは静的ホスティングのため、公開版の `/api/market` はビルド時のモック市場データとして動きます。本物の市場APIキー連携は、後でNetlifyなどサーバー実行できる環境に移す想定です。

## 市場データ設定

初期状態ではAPIキーなしで動くように、`.env.local` を作らなくてもモック市場データを使います。

実APIを検証するときは `.env.example` を参考に、サーバー側の `.env.local` に以下を設定します。

```bash
MARKET_API_PROVIDER=twelvedata
MARKET_API_SYMBOL=検証するシンボル
MARKET_API_CACHE_SECONDS=300
TWELVE_DATA_API_KEY=取得したAPIキー
```

## 広告設定

初期状態では本物の広告コードを読み込まず、ガチャ、図鑑、マーケットに審査前のプレースホルダー枠だけを表示します。

```bash
NEXT_PUBLIC_KABUMON_AD_MODE=placeholder
```

広告を完全に非表示にしたい場合:

```bash
NEXT_PUBLIC_KABUMON_AD_MODE=disabled
```

AdSense審査後に本番広告へ切り替える場合は、`.env.local` またはデプロイ環境の環境変数に以下を設定します。

```bash
NEXT_PUBLIC_KABUMON_AD_MODE=production
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_GACHA=ガチャ枠のslot ID
NEXT_PUBLIC_ADSENSE_SLOT_DEX=図鑑枠のslot ID
NEXT_PUBLIC_ADSENSE_SLOT_MARKET=マーケット枠のslot ID
```

`production` でも `client ID` または `slot ID` が空の場合は、本物の広告タグを描画せず「広告設定未完了」と表示します。誤タップを避けるため、広告枠は下部ナビ付近や主要操作ボタン直下には置かない方針です。

公開前の確認:

```bash
npm run verify
npm run build:pages
```

公開直前の確認項目は [docs/release_checklist.md](/Users/soratokushi/Desktop/株モン/docs/release_checklist.md) にまとめています。

## 注意

このアプリは株価や企業を題材にしたゲームです。特定の銘柄の売買をすすめるものではありません。ゲーム内のレア度・能力・価格・配当・利回りは、実際の企業価値や投資判断を示すものではありません。
