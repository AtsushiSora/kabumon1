import type { CompanyDataSource, DividendType, Rarity } from "./monsters";

export type CompanyDataOverride = {
  sharePrice?: number;
  issuedShares?: number;
  dividendType?: DividendType;
  rarity?: Rarity;
  dataSource?: CompanyDataSource;
};

// This file can be generated from docs/company-data-template.csv.
// Run npm run import:company-overrides after filling override columns.
export const companyDataOverrides: Record<string, CompanyDataOverride> = {};

export const companyDataOverrideCount = Object.keys(companyDataOverrides).length;
