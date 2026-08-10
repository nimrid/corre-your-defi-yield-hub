/**
 * Fetches real-time Solana balances (USDC & SOL) directly from Solana RPC for a given wallet address.
 */
export async function fetchLiveSolanaBalances(walletAddress: string): Promise<{ usdcBalance: number; solBalance: number }> {
  let usdcBalance = 0;
  let solBalance = 0;

  if (!walletAddress) return { usdcBalance, solBalance };

  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const rawRpc = process.env.VITE_SOLANA_RPC || process.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
    const rpcUrl = rawRpc.replace(/^['"]|['"]$/g, "").trim();
    const connection = new Connection(rpcUrl, "confirmed");
    const ownerPk = new PublicKey(walletAddress);

    // Fetch SOL balance
    const solLamports = await connection.getBalance(ownerPk).catch(() => 0);
    solBalance = Number((solLamports / 1_000_000_000).toFixed(4));

    // Fetch USDC balance (Solana mainnet USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const usdcMintPk = new PublicKey(USDC_MINT);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPk, { mint: usdcMintPk }).catch(() => ({ value: [] }));

    usdcBalance = tokenAccounts.value.reduce((sum: number, acc: any) => {
      const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
      return sum + Number(amt || 0);
    }, 0);
    usdcBalance = Number(usdcBalance.toFixed(2));
  } catch (err) {
    console.warn("[MCP Balance] Error fetching live Solana balances:", err);
  }

  return { usdcBalance, solBalance };
}
