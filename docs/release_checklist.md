# 株モン 公開前チェックリスト

GitHub Pagesへ反映する前、または広告審査へ出す前に確認する項目です。

## 1. 基本検証

- `npm run verify` が成功する
- `npm run build:pages` が成功する
- `out/` に `/about` が静的ページとして生成される
- 企業モンスター画像の同期件数が想定通りである
- `public/monsters/transparent/manifest.json` が更新されている

## 2. スマホ表示

- iPhone幅でホーム画面が横にはみ出さない
- 下部ナビが主要ボタンや広告枠に重なっていない
- ホーム、ガチャ、チーム、図鑑、マーケットが操作できる
- モンスター画像が途切れず、背景が透けすぎていない
- 文字サイズ、余白、フレームの高さが読める状態である

## 3. ゲーム進行

- 放置報酬を受け取れる
- ガチャで企業モンスターを入手できる
- 1株単位の保有数が増減する
- 100株単位の配当効果が攻撃力に反映される
- チーム3体の総合攻撃力でCPU戦、ユーザー戦の勝敗が決まる
- デイリー任務、ウィークリー任務、対戦券のリセットが動く

## 4. アカウントと対戦

- ゲストIDが発行される
- 表示名を保存できる
- 対戦チームを登録できる
- 対戦コードからユーザー対戦できる
- Supabase未設定時はローカル保存として動く
- Supabase設定時はプロフィール同期と接続チェックが通る

## 5. 広告審査

- `/about/` が公開URLから見られる
- アプリ内のポリシー画面から説明ページへ移動できる
- 投資助言ではない旨が表示されている
- 保存データ、クラウド同期、広告表示方針、課金なし方針が表示されている
- `NEXT_PUBLIC_KABUMON_AD_MODE=placeholder` では本物の広告タグを読み込まない
- `NEXT_PUBLIC_KABUMON_AD_MODE=disabled` では広告枠が非表示になる
- `NEXT_PUBLIC_KABUMON_AD_MODE=production` でも client ID / slot ID 未設定なら広告タグを描画しない
- 本番広告IDを設定した場合のみ `adsbygoogle` タグが描画される

## 6. 公開後確認

- [https://atsushisora.github.io/kabumon1/](https://atsushisora.github.io/kabumon1/) でアプリ本体が表示される
- [https://atsushisora.github.io/kabumon1/about/](https://atsushisora.github.io/kabumon1/about/) で説明ページが表示される
- 画像、manifest、service worker が `/kabumon1` 配下で404になっていない
- スマホ実機でホーム画面、ガチャ、チーム、図鑑、マーケットを確認する
- 反映直後に古いキャッシュが残る場合は、ブラウザ再読み込みまたはホーム画面追加の再作成で確認する

## 7. プッシュ前コマンド

```bash
npm run verify
npm run build:pages
git status --short
```

問題なければコミットして `main` へプッシュします。
