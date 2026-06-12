# 企業データ上書きルール

企業画像は `public/monsters/<コード>-<企業名>.png` から自動で株モン化されます。
株価・発行株数・配当タイプを実データに近づけたい銘柄だけ、`lib/companyDataOverrides.ts` に追加します。

## テンプレート生成

```bash
npm run export:company-template
```

生成先:

```text
docs/company-data-template.csv
```

CSVの `override...` 列に実データ候補を入れて確認し、採用する値だけ `companyDataOverrides.ts` へ転記します。
手で転記せず、まず次のコマンドで反映予定を確認できます。

```bash
npm run preview:company-overrides
```

previewでは、入力した銘柄ごとに `現在値 -> 上書き値` が表示されます。ここではファイルを書き換えません。

確認後、次のコマンドでCSVから反映できます。

```bash
npm run import:company-overrides
```

変換処理そのものを確認したい場合は、次のテストを実行します。実データファイルは書き換えません。

```bash
npm run test:company-overrides
```

画像取り込みからCSV生成、preview、import、変換テストまでまとめて確認する場合は、次のコマンドを使います。

```bash
npm run verify:company-data
```

## 入力形式

```ts
export const companyDataOverrides = {
  "5108": {
    sharePrice: 5600,
    issuedShares: 720_000_000,
    dividendType: "高配当",
    rarity: "SSR",
    dataSource: "manual"
  }
};
```

## 値の意味

- `sharePrice`: 1株の価格。ゲーム内では1株あたりの攻撃力にも使います。
- `issuedShares`: 発行株数。ガチャ排出率の重みに使います。
- `dividendType`: `無配当` / `低配当` / `中配当` / `高配当`。
- `rarity`: `R` / `SR` / `SSR` / `UR`。
- `dataSource`: 手入力なら `manual`、将来API連携した値なら `live`。

実データを入れても、投資判断ではなくゲーム用バランス値として扱います。
