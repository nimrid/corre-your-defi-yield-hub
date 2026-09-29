import React from "react";

export interface RwaFeatureCard {
  title: string;
  iconName: "Shield" | "Lock" | "Layers" | "TrendingUp" | "Coins" | "Globe" | "Flame" | "Sparkles";
  description: string;
}

export interface RwaTermItem {
  label: string;
  value: string;
  isHighlight?: boolean;
}

export interface RwaDetailContent {
  headlineBadge: string;
  yieldBadge?: string;
  tenorBadge?: string;
  title: string;
  summary: string[];
  whatIsTitle: string;
  whatIsParagraphs: string[];
  whatIsCards: RwaFeatureCard[];
  summaryNote: string;
  termSheetBadge?: string;
  terms: RwaTermItem[];
  aboutIssuerTitle: string;
  aboutIssuerParagraphs: string[];
  whyConsiderTitle: string;
  whyConsiderCards: RwaFeatureCard[];
}

export const RWA_TOKEN_CONTENTS: Record<string, RwaDetailContent> = {
  ntbs5: {
    headlineBadge: "Sovereign Fixed Income",
    yieldBadge: "16.50% p.a. Yield",
    tenorBadge: "365 Days Tenor",
    title: "Nigerian Treasury Bill Series 5 (NTBS5)",
    summary: [
      "Tokenized sovereign debt instrument backed by the Federal Government of Nigeria and issued through Comercio Partners Asset Management.",
      "NTBS5 delivers a fixed annualized yield of 16.50% over a 365-day tenor with automated digital settlement directly in cNGN on Solana. Investors can purchase seamlessly using either USDC (via automated Jupiter/Orca swap) or cNGN.",
    ],
    whatIsTitle: "What is Nigerian Treasury Bill Series 5?",
    whatIsParagraphs: [
      "Treasury Bills (T-Bills) are short-term government sovereign debt instruments issued under the Central Bank of Nigeria (CBN) monetary framework. They are backed by the full faith and credit of the Federal Government of Nigeria, carrying virtually zero credit default risk within the domestic monetary system.",
      "Through GetEquity's regulated Solana Token-2022 smart contract vault, Comercio Partners brings institutional-grade sovereign yields on-chain, eliminating traditional banking barriers, manual paperwork, and high minimum deposit thresholds.",
    ],
    whatIsCards: [
      {
        title: "Sovereign Credit Backing",
        iconName: "Shield",
        description:
          "Underlying assets are backed by Federal Government of Nigeria debt securities managed by Comercio Partners Asset Management, a licensed SEC-regulated fund manager.",
      },
      {
        title: "On-Chain Vault Custody",
        iconName: "Lock",
        description:
          "Token units are issued and held in a deterministic Token-2022 vault contract on Solana. Each token represents 1 full unit of NTBS5 valued at ₦10,000.00 cNGN.",
      },
    ],
    summaryNote:
      "NTBS5 combines the sovereign security of Nigerian Treasury Bills with the instant settlement and liquidity of Solana DeFi, offering a predictable 16.50% annualized yield.",
    termSheetBadge: "Term Sheet",
    terms: [
      { label: "Issuer / Fund Manager", value: "Comercio Partners Asset Management" },
      { label: "Instrument", value: "Nigerian Treasury Bill Series 5 (NTBS5)" },
      { label: "Asset Class", value: "Sovereign Fixed Income / Money Market Fund" },
      { label: "Indicative Yield", value: "16.50% p.a. (Annualized)", isHighlight: true },
      { label: "Tenor / Duration", value: "365 Days" },
      { label: "Per-Unit Price", value: "₦10,000.00 cNGN (~$7.30 USDC)" },
      { label: "Minimum Order", value: "1 Unit (₦10,000.00 cNGN)" },
      { label: "Settlement Currency", value: "cNGN (Solana Token-2022) or USDC Auto-Swap" },
      { label: "Regulatory Oversight", value: "SEC Nigeria Registered Asset Manager" },
    ],
    aboutIssuerTitle: "About Comercio Partners",
    aboutIssuerParagraphs: [
      "Comercio Partners is a premier African investment banking firm operating across fixed income securities, structured asset management, and private equity advisory.",
      "Through its SEC-registered asset management arm, Comercio Partners manages diversified institutional portfolios, treasury portfolios, and high-yield fixed income funds, bringing institutional-grade African sovereign securities to blockchain rails.",
    ],
    whyConsiderTitle: "Why Consider This Offer",
    whyConsiderCards: [
      {
        title: "16.50% Fixed Yield",
        iconName: "TrendingUp",
        description:
          "Earn an attractive annualized return that strongly outpaces standard dollar money market rates and local bank deposits.",
      },
      {
        title: "Sovereign Security",
        iconName: "Shield",
        description:
          "Backed by Nigerian sovereign treasury obligations, representing the highest credit quality in the Nigerian capital market.",
      },
      {
        title: "USDC & cNGN Settlement",
        iconName: "Coins",
        description:
          "Participate directly using USDC or cNGN with automatic conversion via Jupiter and Orca, with full gas sponsorship.",
      },
      {
        title: "Zero Paperwork",
        iconName: "Globe",
        description:
          "Instant digital settlement directly in your Solana self-custodial wallet without bank queues or paper forms.",
      },
    ],
  },

  gntb: {
    headlineBadge: "Sovereign Money Market Fund",
    yieldBadge: "15.50% p.a. Yield",
    tenorBadge: "Open-Ended / Liquid",
    title: "GetEquity Nigerian Treasury Bills Fund (gNTB)",
    summary: [
      "Tokenized sovereign money market fund managed by BAS Capital on GetEquity, backed by short-term Federal Government of Nigeria sovereign treasury bills.",
      "gNTB generates a fixed 15.50% annualized yield with automatic on-chain interest accrual and settlement directly in cNGN on Solana. Investors can enter or exit seamlessly using either USDC or cNGN with full instant execution.",
    ],
    whatIsTitle: "What is GetEquity Nigerian Treasury Bills Fund?",
    whatIsParagraphs: [
      "The GetEquity Nigerian Treasury Bills Fund is an on-chain institutional liquidity fund offering direct exposure to high-grade Nigerian sovereign treasury bills issued under the Central Bank of Nigeria monetary framework.",
      "Structured by BAS Capital and tokenized through GetEquity's regulated Solana Token-2022 smart contract vault, gNTB provides everyday and institutional investors with fractional, highly liquid access to sovereign yield without high banking minimums or manual settlement friction.",
    ],
    whatIsCards: [
      {
        title: "Sovereign Collateralization",
        iconName: "Shield",
        description:
          "Underlying assets consist of risk-free Nigerian government treasury bills held in custody, offering premier credit quality and consistent interest generation.",
      },
      {
        title: "Token-2022 Transfer Hook Accrual",
        iconName: "Lock",
        description:
          "Token units are issued on Solana's Token-2022 standard with automated accrual program integration for deterministic holding calculations and vault redemption.",
      },
    ],
    summaryNote:
      "gNTB delivers institutional Nigerian money market yields (15.50% p.a.) into your Web3 wallet, featuring fractional minimums (₦1,000 cNGN) and instant 24/7 liquidity on Solana.",
    termSheetBadge: "Term Sheet",
    terms: [
      { label: "Issuer / Fund Manager", value: "BAS Capital" },
      { label: "Instrument", value: "GetEquity Nigerian Treasury Bills Fund (gNTB)" },
      { label: "Asset Class", value: "Sovereign Fixed Income / Money Market Fund" },
      { label: "Indicative Yield", value: "15.50% p.a. (Annualized)", isHighlight: true },
      { label: "Tenor / Duration", value: "Open-Ended / Flexible" },
      { label: "Per-Unit Price", value: "₦1.00 cNGN (~$0.00067 USDC)" },
      { label: "Minimum Order", value: "1,000 Units (₦1,000.00 cNGN)" },
      { label: "Settlement Currency", value: "cNGN (Solana Token-2022) or USDC Auto-Swap" },
      { label: "Vault Liquidity", value: "100,000,000 gNTB On-Chain" },
    ],
    aboutIssuerTitle: "About BAS Capital",
    aboutIssuerParagraphs: [
      "BAS Capital is an institutional investment management firm focused on capital markets, liquidity funds, and high-yield fixed income products across emerging markets.",
      "In collaboration with GetEquity, BAS Capital structures tokenized vehicles that bridge traditional sovereign money markets to decentralized finance protocols on Solana.",
    ],
    whyConsiderTitle: "Why Consider This Offer",
    whyConsiderCards: [
      {
        title: "15.50% Sovereign Yield",
        iconName: "TrendingUp",
        description:
          "Earn a competitive fixed income yield that outpaces standard bank deposit rates with daily transparency.",
      },
      {
        title: "Sovereign Backing",
        iconName: "Shield",
        description:
          "Backed by Nigerian sovereign treasury bills, representing the benchmark low-risk asset class in the Nigerian monetary system.",
      },
      {
        title: "USDC & cNGN Settlement",
        iconName: "Coins",
        description:
          "Seamlessly buy or sell using either USDC or cNGN with automatic atomic conversions via Jupiter and Orca.",
      },
      {
        title: "Instant Liquidity",
        iconName: "Globe",
        description:
          "Open-ended fund units can be redeemed or traded directly against GetEquity on-chain vaults at transparent fixed pricing.",
      },
    ],
  },

  dpri: {
    headlineBadge: "Early Access Allocation",
    title: "Early Access: Dangote Petroleum Refinery & Petrochemicals IPO",
    summary: [
      "We are excited to present early access to the Dangote Petroleum Refinery and Petrochemicals IPO, now available for indication of interest on Corre.",
      "This is your opportunity to participate in what is widely expected to be the largest initial public offering in African capital market history. Through Corre, you can gain exposure to Dangote Refinery shares via a synthetic equity structure that holds the underlying stock in a dedicated Special Purpose Vehicle (SPV), with custody managed by Anchoria.",
    ],
    whatIsTitle: "What is a Synthetic Equity Position?",
    whatIsParagraphs: [
      "Unlike a commercial paper or bond, this is an equity instrument. There is no fixed interest rate and no maturity date. Your return comes from two sources: any appreciation in the share price over time, and dividends declared by the company (Dangote has proposed paying dividends in US Dollars, backed by the refinery's export earnings).",
      "Because the Dangote Refinery IPO is listed on the Nigerian Exchange (NGX) and subscriptions run through CSCS accounts and licensed brokers, Corre gives you access through a structured holding rather than a direct allocation. Here is how it works:",
    ],
    whatIsCards: [
      {
        title: "Ring-Fenced SPV Structure",
        iconName: "Lock",
        description:
          "GetEquity (through its issuing partner) subscribes to and holds the underlying Dangote Refinery shares in a ring-fenced Special Purpose Vehicle (SPV). The SPV exists solely to hold these shares on behalf of investors. When you invest, you receive a digital representation of your proportional economic interest in the shares held by that SPV. You do not hold the shares directly in your own CSCS account; instead, your beneficial ownership is recorded and held in trust.",
      },
      {
        title: "Regulated Custody by Anchoria",
        iconName: "Shield",
        description:
          "The actual shares are held in custody by Anchoria, a licensed and SEC-regulated custodian. The custodian's role is to safekeep the underlying assets, independent of Corre, so that the shares backing your position are held by a regulated third party rather than by the platform itself. This separation protects investors: your economic interest is tied to real, custodied shares.",
      },
    ],
    summaryNote:
      "In short: You get the upside of holding Dangote Refinery equity (price appreciation plus dividends) through a fractional, accessible structure, while the underlying shares sit safely with a regulated custodian inside a dedicated SPV.",
    termSheetBadge: "Indicative Term Sheet",
    terms: [
      { label: "Issuer of Underlying Shares", value: "Dangote Petroleum Refinery and Petrochemicals FZE" },
      { label: "Instrument", value: "Synthetic Equity (Digital representation of shares in SPV)" },
      { label: "Structure", value: "Shares held in a dedicated Special Purpose Vehicle (SPV)" },
      { label: "Custodian", value: "Anchoria (Licensed & SEC-Regulated Custodian)" },
      { label: "Listing Venue", value: "Nigerian Exchange (NGX) • Potential dual listing under review" },
      { label: "Per-Share Indicative Price", value: "$0.35 ≈ ₦525" },
      { label: "Estimated Valuation", value: "$40B – $50B (Valuation: $39.1B ≈ ₦59.8 Trillion)" },
      { label: "Offer Size", value: "Approximately 10% of company equity (~$5B raise)" },
      { label: "Minimum Order", value: "1 Share (₦525 cNGN)" },
      { label: "Settlement Currency", value: "cNGN (Solana Token-2022) or USDC Auto-Swap" },
      { label: "Indicative Dividend Policy", value: "USD-denominated dividends proposed" },
    ],
    aboutIssuerTitle: "About Dangote Petroleum Refinery",
    aboutIssuerParagraphs: [
      "The Dangote Petroleum Refinery is a 650,000 barrel-per-day integrated refinery and petrochemical facility located in the Lekki Free Zone near Lagos, Nigeria. It is the largest single-train refinery in the world and represents one of the most significant industrial infrastructure investments on the African continent.",
      "With full commercial operations commenced, the refinery is positioned to meet 100% of Nigeria's domestic demand for refined petroleum products and export substantial surplus volumes across West Africa and global markets, fundamentally altering regional trade flows and foreign exchange dynamics.",
    ],
    whyConsiderTitle: "Why Consider This Offer",
    whyConsiderCards: [
      {
        title: "Africa's Landmark IPO",
        iconName: "TrendingUp",
        description:
          "A rare opportunity to participate in what is expected to be the most significant capital market event in Nigeria's history at an early stage.",
      },
      {
        title: "USD Dividend Potential",
        iconName: "Coins",
        description:
          "The refinery's substantial export operations generate foreign currency revenues, supporting proposed dividend distributions in US Dollars.",
      },
      {
        title: "Global Scale Asset",
        iconName: "Flame",
        description:
          "Exposure to a 650,000 bpd refinery with significant cost advantages, domestic feedstock access, and captive market demand across Africa.",
      },
      {
        title: "Regulated Custody",
        iconName: "Shield",
        description:
          "Underlying shares held in trust by Anchoria, a licensed and SEC-regulated custodian, inside a dedicated Special Purpose Vehicle.",
      },
    ],
  },
};

export function getRwaDetailContent(id: string): RwaDetailContent | undefined {
  if (!id) return undefined;
  return RWA_TOKEN_CONTENTS[id.toLowerCase()];
}
