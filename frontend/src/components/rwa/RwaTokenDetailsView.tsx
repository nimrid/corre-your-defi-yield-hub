import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Shield } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";
import Navigation from "@/components/Navigation";
import type { RwaTokenConfig } from "@/config/rwaTokens";
import {
  getRwaDetailContent,
  type RwaDetailContent,
} from "@/config/rwaTokenContent";
import {
  fetchRwaMarketOverview,
  fetchUserRwaHolding,
  getGetEquityConnection,
  KNOWN_PAYOUT_MINTS,
  type RwaMarketOverview,
} from "@/services/getEquityService";
import RwaTradeDialog, { type SolanaWalletLike } from "@/components/RwaTradeDialog";
import { RwaHeaderMetrics } from "./RwaHeaderMetrics";
import { RwaContentRenderer } from "./RwaContentRenderer";

interface ParsedTokenAccount {
  account?: {
    data?: {
      parsed?: {
        info?: {
          tokenAmount?: {
            uiAmount?: number | null;
          };
        };
      };
    };
  };
}

interface WalletItem extends SolanaWalletLike {
  walletClientType?: string;
  chainType?: string;
  chain?: string;
}

interface RwaTokenDetailsViewProps {
  rwaConfig: RwaTokenConfig;
  initialAmount?: string;
}

export const RwaTokenDetailsView: React.FC<RwaTokenDetailsViewProps> = ({
  rwaConfig,
  initialAmount = "",
}) => {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();

  const [rwaOverview, setRwaOverview] = useState<RwaMarketOverview | null>(null);
  const [rwaLoading, setRwaLoading] = useState(false);
  const [userRwaShares, setUserRwaShares] = useState<number | null>(null);
  const [userUsdcBalance, setUserUsdcBalance] = useState<number | null>(null);
  const [userCngnBalance, setUserCngnBalance] = useState<number | null>(null);
  const [userSolBalance, setUserSolBalance] = useState<number | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");

  // Automatically open trade modal if an initial amount was passed via query parameter
  useEffect(() => {
    if (initialAmount) {
      setTradeDirection("buy");
      setTradeModalOpen(true);
    }
  }, [initialAmount]);

  // Find active Solana wallet
  const solWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return undefined;
    const sol = (wallets as WalletItem[]).find(
      (w) =>
        w.chainType === "solana" ||
        w.walletClientType?.includes("solana") ||
        w.chain?.includes("solana")
    );
    return sol ?? (wallets[0] as SolanaWalletLike);
  }, [wallets]);

  // Load live on-chain protocol data
  const loadRwaData = useCallback(async () => {
    if (!rwaConfig) return;
    try {
      setRwaLoading(true);
      const connection = getGetEquityConnection(rwaConfig.cluster);

      const overview = await fetchRwaMarketOverview(connection, rwaConfig.mint);
      setRwaOverview(overview);

      if (solWallet?.address) {
        let ownerPk: PublicKey | null = null;
        try {
          ownerPk = new PublicKey(solWallet.address);
        } catch {
          ownerPk = null;
        }

        if (ownerPk) {
          // 1. Fetch user's RWA holding
          try {
            const holding = await fetchUserRwaHolding(
              connection,
              ownerPk,
              rwaConfig.mint
            );
            setUserRwaShares(holding.uiAmount);
          } catch (err) {
            console.error("Failed to query user RWA holding:", err);
          }

          // 2. Fetch USDC balance
          try {
            const usdcMint = new PublicKey(
              rwaConfig.cluster === "devnet"
                ? KNOWN_PAYOUT_MINTS.devnet.USDC
                : KNOWN_PAYOUT_MINTS.mainnet.USDC
            );
            const usdcAccounts = await connection.getParsedTokenAccountsByOwner(
              ownerPk,
              { mint: usdcMint }
            );
            const totalUsdc = (
              usdcAccounts.value as ParsedTokenAccount[]
            ).reduce((sum, acc) => {
              const amt = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return sum + Number(amt || 0);
            }, 0);
            setUserUsdcBalance(totalUsdc);
          } catch (err) {
            console.error("Failed to query USDC balance:", err);
          }

          // 3. Fetch payout token (e.g. cNGN) balance
          try {
            const payoutMintPk =
              overview?.asset?.payoutMint || new PublicKey(rwaConfig.payoutMint);
            const payoutAccounts = await connection.getParsedTokenAccountsByOwner(
              ownerPk,
              { mint: payoutMintPk }
            );
            const totalPayout = (
              payoutAccounts.value as ParsedTokenAccount[]
            ).reduce((sum, acc) => {
              const amt = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return sum + Number(amt || 0);
            }, 0);
            setUserCngnBalance(totalPayout);
          } catch (err) {
            console.error("Failed to query payout balance:", err);
          }

          // 4. Fetch SOL balance for gas
          try {
            const lamports = await connection.getBalance(ownerPk);
            setUserSolBalance(lamports / 1e9);
          } catch (err) {
            console.error("Failed to query SOL balance:", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch on-chain RWA data:", err);
    } finally {
      setRwaLoading(false);
    }
  }, [rwaConfig, solWallet]);

  useEffect(() => {
    void loadRwaData();
  }, [loadRwaData]);

  // Derived on-chain metrics
  const unitPrice =
    rwaOverview?.asset?.priceUSD ??
    (rwaConfig.minBuyCostPayout && rwaConfig.minBuyShares
      ? rwaConfig.minBuyCostPayout / rwaConfig.minBuyShares
      : 525);
  const feePct = rwaOverview?.asset?.feePercent ?? 0.5;
  const vaultBal = rwaOverview?.vaultRwaBalance ?? "—";
  const isActive = rwaOverview?.asset?.isActive ?? true;

  // Retrieve content schema or build a default one
  const content: RwaDetailContent = useMemo(() => {
    const existing = getRwaDetailContent(rwaConfig.id);
    if (existing) return existing;

    return {
      headlineBadge: rwaConfig.category,
      title: rwaConfig.name,
      summary: [rwaConfig.description],
      whatIsTitle: `About ${rwaConfig.name}`,
      whatIsParagraphs: [rwaConfig.description],
      whatIsCards: [],
      summaryNote: `${rwaConfig.name} is settled on Solana with 24/7 liquidity through GetEquity.`,
      terms: [
        { label: "Issuer", value: rwaConfig.issuer },
        { label: "Instrument", value: rwaConfig.symbol },
        { label: "Category", value: rwaConfig.category },
        { label: "Settlement Currency", value: rwaConfig.payoutSymbol },
      ],
      aboutIssuerTitle: `About ${rwaConfig.issuer}`,
      aboutIssuerParagraphs: [
        `${rwaConfig.issuer} is an issuing partner with GetEquity on Solana.`,
      ],
      whyConsiderTitle: "Why Consider This Offer",
      whyConsiderCards: [
        {
          title: "On-Chain Custody",
          iconName: "Shield",
          description: "Issued and held deterministically in GetEquity on-chain vaults on Solana.",
        },
        {
          title: "Instant Liquidity",
          iconName: "Coins",
          description: "Trade directly using USDC or cNGN with instant automated settlement.",
        },
      ],
    };
  }, [rwaConfig]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          {/* Header & Metrics */}
          <RwaHeaderMetrics
            rwaConfig={rwaConfig}
            unitPrice={unitPrice}
            feePct={feePct}
            vaultBal={vaultBal}
            isActive={isActive}
            userRwaShares={userRwaShares}
            userUsdcBalance={userUsdcBalance}
            userCngnBalance={userCngnBalance}
            userSolBalance={userSolBalance}
            loading={rwaLoading}
            onRefresh={loadRwaData}
            onOpenTrade={(dir) => {
              setTradeDirection(dir);
              setTradeModalOpen(true);
            }}
          />

          {/* Structured Detail Content (Banners, What Is, Terms, Issuer, Why Consider) */}
          <RwaContentRenderer content={content} feePct={feePct} />

          {/* Technical Specifications */}
          <div className="rounded-xl bg-secondary/30 border border-border/40 p-4 space-y-2 text-xs">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span>On-Chain Verification Details</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <span className="block text-[11px]">RWA Mint:</span>
                <span className="font-mono text-foreground break-all">
                  {rwaConfig.mint}
                </span>
              </div>
              <div>
                <span className="block text-[11px]">
                  Payout Mint ({rwaConfig.payoutSymbol}):
                </span>
                <span className="font-mono text-foreground break-all">
                  {rwaConfig.payoutMint}
                </span>
              </div>
              <div>
                <span className="block text-[11px]">Protocol Architecture:</span>
                <span className="text-foreground">
                  GetEquity Fixed-Price Vault (Token-2022)
                </span>
              </div>
              <div>
                <span className="block text-[11px]">Network Cluster:</span>
                <span className="text-foreground uppercase">
                  {rwaConfig.cluster}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Trade Dialog Modal */}
      <RwaTradeDialog
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        direction={tradeDirection}
        tokenConfig={rwaConfig}
        marketOverview={rwaOverview}
        usdcBalance={userUsdcBalance}
        cngnBalance={userCngnBalance}
        userShares={userRwaShares}
        solanaWallet={solWallet}
        signTransaction={signTransaction}
        privyUserId={user?.id}
        onTradeSuccess={loadRwaData}
        initialAmount={initialAmount}
        solBalance={userSolBalance}
      />
    </div>
  );
};
