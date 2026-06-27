import { AppIcon, type AppIconName } from "@/components/layout/AppIcon";

export type AppTab = "home" | "gacha" | "train" | "event" | "team" | "dex" | "market" | "account" | "policy";

const navItems: { id: AppTab; label: string; icon: AppIconName }[] = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "gacha", label: "ガチャ", icon: "gacha" },
  { id: "team", label: "チーム", icon: "team" },
  { id: "dex", label: "図鑑", icon: "dex" },
  { id: "market", label: "マーケット", icon: "market" }
];

export function BottomNav({
  activeTab,
  onChange
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={activeTab === item.id ? "active" : ""}
          onClick={() => onChange(item.id)}
        >
          <AppIcon name={item.icon} />
          <b className="nav-label">{item.label}</b>
        </button>
      ))}
    </nav>
  );
}
