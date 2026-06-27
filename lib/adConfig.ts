export type AdMode = "placeholder" | "disabled" | "production";

export type AdSlotKey = "gacha" | "dex" | "market";

export type AdSlotConfig = {
  key: AdSlotKey;
  label: string;
  placement: string;
  slotId: string;
};

const rawAdMode = process.env.NEXT_PUBLIC_KABUMON_AD_MODE;

export const adMode: AdMode = rawAdMode === "production" || rawAdMode === "disabled"
  ? rawAdMode
  : "placeholder";

export const adClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";

export const adScriptSrc = adClientId
  ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adClientId)}`
  : "";

export const adSlots: Record<AdSlotKey, AdSlotConfig> = {
  gacha: {
    key: "gacha",
    label: "ガチャ広告枠",
    placement: "ガチャ一覧の前",
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GACHA ?? ""
  },
  dex: {
    key: "dex",
    label: "図鑑広告枠",
    placement: "図鑑一覧の前",
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEX ?? ""
  },
  market: {
    key: "market",
    label: "マーケット広告枠",
    placement: "マーケット一覧の前",
    slotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_MARKET ?? ""
  }
};

export function getAdSlotConfig(key: AdSlotKey): AdSlotConfig {
  return adSlots[key];
}

export function isAdProductionReady(slot: AdSlotConfig): boolean {
  return adMode === "production" && Boolean(adClientId && slot.slotId);
}

export function getAdDisplayStatus(slot: AdSlotConfig): {
  mode: AdMode;
  ready: boolean;
  title: string;
  detail: string;
} {
  if (adMode === "disabled") {
    return {
      mode: adMode,
      ready: false,
      title: "広告OFF",
      detail: "広告表示は現在無効です。"
    };
  }

  if (adMode === "production") {
    const ready = isAdProductionReady(slot);
    return {
      mode: adMode,
      ready,
      title: ready ? "広告配信準備OK" : "広告設定未完了",
      detail: ready
        ? `${slot.placement} / slot ${slot.slotId}`
        : "AdSense client ID と slot ID を環境変数に設定してください。"
    };
  }

  return {
    mode: adMode,
    ready: false,
    title: slot.label,
    detail: "審査前のプレースホルダーです。本番広告コードは未挿入です。"
  };
}
