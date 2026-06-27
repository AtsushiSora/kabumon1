import type { Metadata } from "next";
import { withBasePath } from "@/lib/paths";

export const metadata: Metadata = {
  title: "株モンについて",
  description: "株式をテーマにした育成・放置ゲーム「株モン」の概要、広告、データ保存、投資に関する注意事項です。"
};

const policySections = [
  {
    label: "Game",
    title: "株式テーマの育成・放置ゲーム",
    body: "株モンは、企業をモチーフにしたモンスターを集め、持ち株数と株価を攻撃力として楽しむWebゲームです。放置報酬、ガチャ、チーム編成、図鑑、マーケット、CPU対戦、ユーザー対戦の仕組みを実装しています。"
  },
  {
    label: "Market",
    title: "投資助言ではありません",
    body: "ゲーム内の株価、配当、攻撃力、レア度、排出率、イベント効果は娯楽表現です。特定銘柄の購入、売却、保有、投資判断をすすめるものではありません。実際の投資は利用者自身の判断と責任で行ってください。"
  },
  {
    label: "Data",
    title: "保存データの扱い",
    body: "プレイ状況、所持モンスター、保有株数、チーム、対戦履歴、ミッション進捗、表示名はブラウザ内に保存されます。クラウド同期を有効にした場合は、対戦に必要なゲストID、表示名、チーム情報、総合攻撃力を保存します。"
  },
  {
    label: "Ads",
    title: "広告表示方針",
    body: "広告はゲーム進行を妨げない位置に配置します。主要操作ボタンの直下、下部ナビ付近、誤タップを誘発する場所には配置しません。審査前はプレースホルダー表示のみで、本番広告コードは環境変数で切り替えます。"
  },
  {
    label: "Payment",
    title: "課金について",
    body: "現在のWeb版に課金機能はありません。ゲーム内のコイン、ガチャ券、配当、報酬は現金や金融商品に交換できません。将来アプリ化する場合は、ストア審査に合わせてプライバシー、広告、年齢区分の表示を更新します。"
  }
];

export default function AboutPage() {
  return (
    <main className="public-page">
      <div className="public-page-shell">
        <header className="public-hero">
          <a className="public-back-link" href={withBasePath("/")}>← アプリへ戻る</a>
          <p>株式育成・放置ゲーム</p>
          <h1>株モンについて</h1>
          <span>
            企業モンスターを集め、持ち株数と株価を攻撃力に変えて遊ぶスマホ向けWebゲームです。
          </span>
        </header>

        <section className="public-summary-grid" aria-label="株モンの概要">
          <article>
            <strong>現在の形式</strong>
            <span>スマホ縦画面向けWebアプリ</span>
          </article>
          <article>
            <strong>主な遊び</strong>
            <span>放置報酬 / ガチャ / チーム対戦</span>
          </article>
          <article>
            <strong>収益化方針</strong>
            <span>広告中心、課金なしで準備中</span>
          </article>
        </section>

        <section className="public-section-list">
          {policySections.map((section) => (
            <article className="public-policy-card" key={section.title}>
              <div>
                <span>{section.label}</span>
                <h2>{section.title}</h2>
              </div>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="public-contact-card">
          <h2>運用メモ</h2>
          <p>
            このページは広告審査、公開URL確認、利用方針の説明に使うための公開ページです。
            アプリ本体のポリシー画面と同じ方針を、ブラウザから直接確認できるようにしています。
          </p>
          <a href={withBasePath("/")}>株モンを開く</a>
        </section>
      </div>
    </main>
  );
}
