/**
 * Fetches real-time Lulo Savings Vault balances (Shielded pusdUsdBalance & Standard Vault) for a given wallet address.
 */
export async function fetchLiveLuloBalance(walletAddress: string): Promise<{ shieldedBalance: number; standardBalance: number; totalInterestEarned: number }> {
  let shieldedBalance = 0;
  let standardBalance = 0;
  let totalInterestEarned = 0;

  if (!walletAddress) return { shieldedBalance, standardBalance, totalInterestEarned };

  const apiKey = (process.env.LULO_API_KEY || "").trim();
  if (!apiKey) return { shieldedBalance, standardBalance, totalInterestEarned };

  try {
    const url = new URL("https://api.lulo.fi/v1/account.getAccount");
    url.searchParams.set("owner", walletAddress);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const pUsdVal = Number((data as any)?.pusdUsdBalance || 0);
      const totalVal = Number((data as any)?.totalValue || (data as any)?.depositValue || 0);
      const interestVal = Number((data as any)?.protectedInterestEarned || (data as any)?.interestEarned || 0);

      shieldedBalance = isNaN(pUsdVal) ? 0 : Number(pUsdVal.toFixed(2));
      const rawStandard = isNaN(totalVal) ? 0 : Math.max(0, totalVal - shieldedBalance);
      standardBalance = Number(rawStandard.toFixed(2));
      totalInterestEarned = isNaN(interestVal) ? 0 : Number(interestVal.toFixed(2));
    }
  } catch (err) {
    console.warn("[MCP Rate] Failed to fetch live Lulo balances:", err);
  }

  return { shieldedBalance, standardBalance, totalInterestEarned };
}

/**
 * Fetches real-time Lulo Savings Vault APY rates directly from Lulo protocol API.
 */
export async function fetchLiveLuloYields(): Promise<{ standardVaultAPY: string; shieldedVaultAPY: string; rawStandardAPY: number; rawShieldedAPY: number }> {
  let standardVaultAPY = "8.5%";
  let shieldedVaultAPY = "6.2%";
  let rawStandardAPY = 8.5;
  let rawShieldedAPY = 6.2;

  try {
    const apiKey = (process.env.LULO_API_KEY || "").trim();
    const res = await fetch("https://api.lulo.fi/v1/pool.getPools", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const regularPool = (data as any)?.regular || (data as any)?.pools?.regular;
      const protectedPool = (data as any)?.protected || (data as any)?.pools?.protected;

      const regVal = regularPool?.apy ?? regularPool?.depositApy ?? regularPool?.totalApy ?? regularPool?.interestRate;
      const protVal = protectedPool?.apy ?? protectedPool?.depositApy ?? protectedPool?.totalApy ?? protectedPool?.interestRate;

      if (typeof regVal === "number" && !isNaN(regVal) && regVal > 0) {
        rawStandardAPY = regVal > 1 ? regVal : regVal * 100;
        standardVaultAPY = `${rawStandardAPY.toFixed(2)}%`;
      }
      if (typeof protVal === "number" && !isNaN(protVal) && protVal > 0) {
        rawShieldedAPY = protVal > 1 ? protVal : protVal * 100;
        shieldedVaultAPY = `${rawShieldedAPY.toFixed(2)}%`;
      }
    }
  } catch (err) {
    console.warn("[MCP Rate] Failed to fetch live Lulo yields:", err);
  }

  return { standardVaultAPY, shieldedVaultAPY, rawStandardAPY, rawShieldedAPY };
}
