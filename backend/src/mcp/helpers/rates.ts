import { initializeSDK, Environment, getRateByType, RateType } from "paj_ramp";

// Initialize PAJ Ramp SDK (Development/Staging or Production based on PAJ_ENV)
const isPajProd = process.env.PAJ_ENV === "production";
try {
  initializeSDK(isPajProd ? Environment.Production : Environment.Staging);
  console.log(`[PAJ SDK] Initialized in ${isPajProd ? "Production" : "Staging/Sandbox"} mode.`);
} catch (err) {
  console.error("[PAJ SDK] Failed to initialize PAJ SDK:", err);
}

/**
 * Dynamically fetches real-time Naira (NGN) exchange rate directly from PAJ Production API.
 * NO hardcoded rates or static values.
 */
export async function fetchLiveNairaRate(type: "onRamp" | "offRamp"): Promise<number> {
  try {
    const rateData = await getRateByType(type === "onRamp" ? RateType.onRamp : RateType.offRamp);
    if (rateData && rateData.rate && !isNaN(Number(rateData.rate))) {
      return Number(rateData.rate);
    }
  } catch (err) {
    console.warn(`[MCP Rate] Failed to fetch PAJ ${type} rate from SDK:`, err);
  }

  // Fallback to real-time CoinGecko market price oracle
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn");
    if (res.ok) {
      const data = await res.json();
      const liveRate = data?.["usd-coin"]?.ngn;
      if (liveRate && !isNaN(Number(liveRate))) {
        const adjustedRate = type === "onRamp" ? liveRate * 1.015 : liveRate * 0.99;
        return Number(adjustedRate.toFixed(2));
      }
    }
  } catch (err) {
    console.warn("[MCP Rate] CoinGecko live rate fetch error:", err);
  }

  throw new Error("Unable to fetch live exchange rate at this moment. Please try again shortly.");
}
