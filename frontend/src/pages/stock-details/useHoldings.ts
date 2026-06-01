import { useEffect, useState } from "react";
import type { TokenDetails } from "./stockDetailsUtils";

/**
 * Fetches the user's exact on-chain token balance (shares) and their
 * USDC balance from Solana mainnet via Alchemy RPC.
 * This guarantees we display their real wallet balances, regardless
 * of backend trade history synchronization.
 */
export function useHoldings(
  token: TokenDetails | null,
  user: { id: string; linkedAccounts?: any[] } | null,
  wallets: any[],
  mint: string | undefined,
) {
  const [userShares, setUserShares] = useState<string | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [usdcBalanceRaw, setUsdcBalanceRaw] = useState<number | null>(null);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        if (!token || !user?.id) return;

        setSharesLoading(true);

        // 1) Resolve owner address from connected wallets
        let ownerAddress: string | undefined;

        const solWallet = wallets.find(
          (w: any) =>
            w.walletClientType === "solana" ||
            w.chainType === "solana" ||
            w.chain === "solana"
        ) as any;

        if (solWallet) {
          ownerAddress = solWallet.address;
          if (!ownerAddress && typeof solWallet.getAddress === "function") {
            try {
              ownerAddress = await solWallet.getAddress();
            } catch {
              ownerAddress = undefined;
            }
          }
        }

        if (!ownerAddress && user) {
          const linkedWallets = (user.linkedAccounts ?? []).filter(
            (a: any) => a.type === "wallet" || a.type === "smart_wallet"
          );
          const linkedSolana = linkedWallets.filter(
            (a: any) => a.chainType === "solana" || a.chain === "solana"
          );
          ownerAddress = (linkedSolana[0] as any)?.address;
        }

        if (!ownerAddress) {
          setUserShares(null);
          setUsdcBalance(null);
          setUsdcBalanceRaw(null);
          setSharesLoading(false);
          return;
        }

        // 2) Fetch on-chain balances from Solana RPC concurrently
        try {
          const { Connection, PublicKey } = await import("@solana/web3.js");
          const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", "confirmed");
          
          const owner = new PublicKey(ownerAddress);
          const USDC_MINT_PK = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
          const TOKEN_MINT_PK = new PublicKey(token.address);

          const [usdcResp, tokenResp] = await Promise.all([
            connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT_PK }),
            connection.getParsedTokenAccountsByOwner(owner, { mint: TOKEN_MINT_PK })
          ]);

          // Aggregate USDC balance
          const usdcUi = usdcResp.value.reduce((sum, acc: any) => {
            const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          
          setUsdcBalance(Number(usdcUi).toLocaleString(undefined, { maximumFractionDigits: 4 }));
          setUsdcBalanceRaw(usdcUi);

          // Aggregate Token balance (shares)
          const tokenUi = tokenResp.value.reduce((sum, acc: any) => {
            const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          
          setUserShares(String(tokenUi));
        } catch (err) {
          console.error("Failed to fetch balances via RPC", err);
          setUserShares(null);
          setUsdcBalance(null);
          setUsdcBalanceRaw(null);
        }
      } catch {
        setUserShares(null);
      } finally {
        setSharesLoading(false);
      }
    };

    void fetchHoldings();
  }, [token, wallets, user, mint]);

  return {
    userShares,
    setUserShares,
    sharesLoading,
    usdcBalance,
    usdcBalanceRaw,
  };
}
