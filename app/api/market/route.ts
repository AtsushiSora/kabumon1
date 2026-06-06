import { NextResponse } from "next/server";
import {
  createMarketEnergy,
  createMockExternalMarketEnergy,
  type MarketEnergy
} from "@/lib/game";

export const dynamic = "force-static";

type MarketApiProvider = "mock" | "twelvedata" | "alphavantage";

type MarketCacheEntry = {
  key: string;
  expiresAt: number;
  market: MarketEnergy;
};

type TwelveDataQuoteResponse = {
  name?: string;
  symbol?: string;
  exchange?: string;
  percent_change?: string;
  message?: string;
  code?: number;
};

type AlphaVantageQuoteResponse = {
  "Global Quote"?: {
    "01. symbol"?: string;
    "10. change percent"?: string;
  };
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

let cachedMarket: MarketCacheEntry | null = null;

export async function GET() {
  const now = new Date();
  const provider = getMarketApiProvider();
  const cacheKey = getMarketCacheKey(provider);
  const cached = getCachedMarket(cacheKey, now);

  if (cached) {
    return NextResponse.json({
      market: cached
    });
  }

  let market: MarketEnergy;

  if (provider === "twelvedata") {
    market = await getTwelveDataMarketEnergy(now);
  } else if (provider === "alphavantage") {
    market = await getAlphaVantageMarketEnergy(now);
  } else {
    market = createMockExternalMarketEnergy(now);
  }

  setCachedMarket(cacheKey, market, now);

  return NextResponse.json({
    market
  });
}

function getMarketApiProvider(): MarketApiProvider {
  const provider = process.env.MARKET_API_PROVIDER?.toLowerCase();

  if (provider === "twelvedata" || provider === "alphavantage") {
    return provider;
  }

  return "mock";
}

function getMarketCacheKey(provider: MarketApiProvider): string {
  return `${provider}:${process.env.MARKET_API_SYMBOL ?? ""}`;
}

function getCachedMarket(cacheKey: string, now: Date): MarketEnergy | null {
  if (!cachedMarket) return null;
  if (cachedMarket.key !== cacheKey) return null;
  if (cachedMarket.expiresAt <= now.getTime()) return null;

  return cachedMarket.market;
}

function setCachedMarket(cacheKey: string, market: MarketEnergy, now: Date) {
  cachedMarket = {
    key: cacheKey,
    market,
    expiresAt: now.getTime() + getMarketCacheMs()
  };
}

function getMarketCacheMs(): number {
  const seconds = Number(process.env.MARKET_API_CACHE_SECONDS ?? 300);
  if (!Number.isFinite(seconds) || seconds <= 0) return 300000;

  return Math.min(seconds, 3600) * 1000;
}

async function getTwelveDataMarketEnergy(now: Date): Promise<MarketEnergy> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const symbol = process.env.MARKET_API_SYMBOL;

  if (!apiKey || !symbol) {
    return createProviderFallback(now, "Twelve DataのAPIキーまたはシンボルが未設定です。");
  }

  try {
    const url = new URL("https://api.twelvedata.com/quote");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return createProviderFallback(now, `Twelve Data APIがHTTP ${response.status}を返しました。`);
    }

    const data = await response.json() as TwelveDataQuoteResponse;
    const change = parsePercent(data.percent_change);

    if (data.code || data.message || change === null) {
      return createProviderFallback(now, data.message ?? "Twelve Dataのレスポンスを変換できませんでした。");
    }

    return {
      indexName: data.name || data.symbol || "外部マーケット",
      change,
      theme: pickTheme(change, now),
      source: "external-api",
      updatedAt: now.toISOString(),
      note: `Twelve Data / ${data.exchange ?? symbol}`
    };
  } catch {
    return createProviderFallback(now, "Twelve Data APIへの接続に失敗しました。");
  }
}

async function getAlphaVantageMarketEnergy(now: Date): Promise<MarketEnergy> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const symbol = process.env.MARKET_API_SYMBOL;

  if (!apiKey || !symbol) {
    return createProviderFallback(now, "Alpha VantageのAPIキーまたはシンボルが未設定です。");
  }

  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return createProviderFallback(now, `Alpha Vantage APIがHTTP ${response.status}を返しました。`);
    }

    const data = await response.json() as AlphaVantageQuoteResponse;
    const quote = data["Global Quote"];
    const change = parsePercent(quote?.["10. change percent"]);

    if (data.Note || data.Information || data["Error Message"] || !quote || change === null) {
      return createProviderFallback(
        now,
        data.Note ?? data.Information ?? data["Error Message"] ?? "Alpha Vantageのレスポンスを変換できませんでした。"
      );
    }

    return {
      indexName: quote["01. symbol"] ?? symbol,
      change,
      theme: pickTheme(change, now),
      source: "external-api",
      updatedAt: now.toISOString(),
      note: "Alpha Vantage / Global Quote"
    };
  } catch {
    return createProviderFallback(now, "Alpha Vantage APIへの接続に失敗しました。");
  }
}

function createProviderFallback(now: Date, reason: string): MarketEnergy {
  return {
    ...createMarketEnergy(now),
    note: `${reason} ゲーム内データにフォールバックしました。`
  };
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number(value.replace("%", ""));
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100) / 100;
}

function pickTheme(change: number, now: Date): string {
  if (change >= 1.5) return "半導体";
  if (change >= 0.4) return "モビリティ";
  if (change <= -1.5) return "金融防衛";
  if (change <= -0.4) return "安定配当";

  return createMarketEnergy(now).theme;
}
