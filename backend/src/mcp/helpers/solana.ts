import { findStockToken, getStockDecimals } from "../../config/usStockTokens.js";

export interface LiveStockHolding {
  symbol: string;
  name: string;
  shares: number;
  stockMint: string;
  currentPriceUsd?: number;
  valueUsd?: number;
  formattedValueUsd?: string;
}

export interface LiveSolanaBalances {
  usdcBalance: number;
  solBalance: number;
  stockHoldings: LiveStockHolding[];
  totalStockValueUsd: number;
}

/**
 * Fetches real-time Solana balances (USDC, SOL, and tokenized US stocks) directly from Solana RPC for a given wallet address.
 */
export async function fetchLiveSolanaBalances(walletAddress: string): Promise<LiveSolanaBalances> {
  let usdcBalance = 0;
  let solBalance = 0;
  let stockHoldings: LiveStockHolding[] = [];
  let totalStockValueUsd = 0;

  if (!walletAddress) return { usdcBalance, solBalance, stockHoldings, totalStockValueUsd };

  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const rawRpc = process.env.VITE_SOLANA_RPC || process.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
    const rpcUrl = rawRpc.replace(/^['"]|['"]$/g, "").trim();
    const connection = new Connection(rpcUrl, "confirmed");
    const ownerPk = new PublicKey(walletAddress);

    // 1. Fetch SOL balance
    const solLamports = await connection.getBalance(ownerPk).catch(() => 0);
    solBalance = Number((solLamports / 1_000_000_000).toFixed(4));

    // 2. Fetch SPL Token and SPL Token-2022 accounts in parallel
    const [tokenAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(ownerPk, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }).catch(() => ({ value: [] })),
      connection.getParsedTokenAccountsByOwner(ownerPk, { programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") }).catch(() => ({ value: [] })),
    ]);

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    const rawStockHoldings: { mint: string; shares: number; symbol: string; name: string }[] = [];

    for (const acc of allAccounts) {
      const info = acc?.account?.data?.parsed?.info;
      const mint = info?.mint;
      const uiAmount = Number(info?.tokenAmount?.uiAmount || 0);

      if (mint === USDC_MINT) {
        usdcBalance += uiAmount;
      } else if (uiAmount > 0.000001) {
        const stockConfig = findStockToken(mint);
        if (stockConfig) {
          rawStockHoldings.push({
            mint,
            shares: uiAmount,
            symbol: stockConfig.symbol,
            name: stockConfig.name,
          });
        }
      }
    }

    usdcBalance = Number(usdcBalance.toFixed(2));

    // 3. Fetch real-time prices for stock holdings from Jupiter in parallel
    const apiKey = (process.env.VITE_JUP_API_KEY || process.env.JUPITER_API_KEY || "7533d7b5-93c3-43ed-942e-08a8142c2dd4").trim();
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-api-key"] = apiKey;

    const enrichedHoldings = await Promise.all(
      rawStockHoldings.map(async (holding) => {
        try {
          const url = `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(holding.mint)}`;
          const res = await fetch(url, { headers });
          if (res.ok) {
            const data: any = await res.json();
            const tokenData = Array.isArray(data) && data.length > 0 ? data[0] : null;
            const usdPrice = typeof tokenData?.usdPrice === "number" ? tokenData.usdPrice : null;
            if (usdPrice && usdPrice > 0) {
              const pricePerShare = Number(usdPrice.toFixed(2));
              const valueUsd = Number((holding.shares * pricePerShare).toFixed(2));
              return {
                symbol: holding.symbol,
                name: holding.name,
                shares: holding.shares,
                stockMint: holding.mint,
                currentPriceUsd: pricePerShare,
                valueUsd,
                formattedValueUsd: `$${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              };
            }
          }
        } catch (err) {
          console.warn(`[MCP Balance] Error fetching price for ${holding.symbol}:`, err);
        }

        return {
          symbol: holding.symbol,
          name: holding.name,
          shares: holding.shares,
          stockMint: holding.mint,
        };
      })
    );

    stockHoldings = enrichedHoldings;
    totalStockValueUsd = Number(
      stockHoldings.reduce((sum, h) => sum + (h.valueUsd || 0), 0).toFixed(2)
    );
  } catch (err) {
    console.warn("[MCP Balance] Error fetching live Solana balances:", err);
  }

  return { usdcBalance, solBalance, stockHoldings, totalStockValueUsd };
}
