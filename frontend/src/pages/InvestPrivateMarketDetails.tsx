import Navigation from "@/components/Navigation";
import {
  ArrowLeft,
  MapPin,
  Shield,
  CheckCircle2,
  UploadCloud,
  Building2,
  ExternalLink,
  Wallet,
  RefreshCw,
  TrendingUp,
  Coins,
  Flame,
  Globe,
  FileText,
  Layers,
  Lock,
  Sparkles,
  Info,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { findRwaToken } from "@/config/rwaTokens";
import {
  fetchRwaMarketOverview,
  fetchUserRwaHolding,
  getGetEquityConnection,
  KNOWN_PAYOUT_MINTS,
  type RwaMarketOverview,
} from "@/services/getEquityService";
import RwaTradeDialog, { type SolanaWalletLike } from "@/components/RwaTradeDialog";
import { PublicKey } from "@solana/web3.js";

interface InvestmentHistoryItem {
  id: string;
  investmentId: string;
  amount: number | string;
  status: string;
  createdAt: string;
  expectedShares?: number | string;
}

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

const InvestPrivateMarketDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();

  // ── On-Chain RWA State ──────────────────────────────────────────────────────
  const rwaConfig = useMemo(() => (id ? findRwaToken(id) : undefined), [id]);
  const [rwaOverview, setRwaOverview] = useState<RwaMarketOverview | null>(null);
  const [rwaLoading, setRwaLoading] = useState(false);
  const [userRwaShares, setUserRwaShares] = useState<number | null>(null);
  const [userUsdcBalance, setUserUsdcBalance] = useState<number | null>(null);
  const [userCngnBalance, setUserCngnBalance] = useState<number | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");

  // Resolve primary Solana wallet
  const solWallet = useMemo(() => {
    const list = wallets as WalletItem[];
    return (
      list.find(
        (w) =>
          w.walletClientType === "solana" ||
          w.chainType === "solana" ||
          w.chain === "solana"
      ) || list[0]
    );
  }, [wallets]);

  // Fetch on-chain RWA asset details and user holdings
  const loadRwaData = useCallback(async () => {
    if (!rwaConfig) return;
    try {
      setRwaLoading(true);
      const connection = getGetEquityConnection(rwaConfig.cluster);
      const overview = await fetchRwaMarketOverview(connection, rwaConfig.mint);
      setRwaOverview(overview);

      // If user has a connected wallet, fetch their DPRI, USDC, and payout (cNGN) balances
      if (solWallet) {
        let walletAddress: string | undefined = solWallet.address;
        if (!walletAddress && typeof solWallet.getAddress === "function") {
          walletAddress = await solWallet.getAddress();
        }

        if (walletAddress) {
          const userHolding = await fetchUserRwaHolding(
            connection,
            walletAddress,
            rwaConfig.mint
          );
          setUserRwaShares(userHolding.uiAmount);

          const ownerPk = new PublicKey(walletAddress);

          // 1. Fetch real USDC balance
          try {
            const usdcMintPk = new PublicKey(
              rwaConfig.cluster === "devnet"
                ? KNOWN_PAYOUT_MINTS.devnet.USDC
                : KNOWN_PAYOUT_MINTS.mainnet.USDC
            );
            const usdcAccounts = await connection.getParsedTokenAccountsByOwner(
              ownerPk,
              { mint: usdcMintPk }
            );
            const totalUsdc = (usdcAccounts.value as ParsedTokenAccount[]).reduce((sum, acc) => {
              const amt = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return sum + Number(amt || 0);
            }, 0);
            setUserUsdcBalance(totalUsdc);
          } catch (err) {
            console.error("Failed to query USDC balance:", err);
          }

          // 2. Fetch payout token (e.g. cNGN) balance
          try {
            const payoutMintPk = overview?.asset?.payoutMint || new PublicKey(rwaConfig.payoutMint);
            const payoutAccounts = await connection.getParsedTokenAccountsByOwner(
              ownerPk,
              { mint: payoutMintPk }
            );
            const totalPayout = (payoutAccounts.value as ParsedTokenAccount[]).reduce((sum, acc) => {
              const amt = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return sum + Number(amt || 0);
            }, 0);
            setUserCngnBalance(totalPayout);
          } catch (err) {
            console.error("Failed to query payout balance:", err);
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
    if (rwaConfig) {
      void loadRwaData();
    }
  }, [rwaConfig, loadRwaData]);

  // ── Legacy / Off-Chain State ────────────────────────────────────────────────
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calcAmount, setCalcAmount] = useState("5000");
  const calcAmountNum = Number(calcAmount) || 0;
  const roiRate = 0.15;
  const expectedProfit = calcAmountNum * roiRate;
  const expectedTotal = calcAmountNum + expectedProfit;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<InvestmentHistoryItem[]>([]);
  const [totalInvested, setTotalInvested] = useState<number>(0);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search || window.location.search);
    const paramAmount = searchParams.get("amount");
    if (paramAmount) {
      setAmount(paramAmount);
      if (rwaConfig) {
        setTradeDirection("buy");
        setTradeModalOpen(true);
      } else {
        setBuyDialogOpen(true);
      }
    }
  }, [location.search, rwaConfig]);

  useEffect(() => {
    if (id === "nilep-palm-oil") {
      fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/investments/private-market/${id}/stats`)
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.totalInvested === "number") {
            setTotalInvested(data.totalInvested);
          }
        })
        .catch((err) => console.error("Error fetching stats:", err));
    }
  }, [id]);

  useEffect(() => {
    if (user?.id && id === "nilep-palm-oil") {
      fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/investments/private-market/history/${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setHistory(data.filter((item: InvestmentHistoryItem) => item.investmentId === id));
          }
        })
        .catch((err) => console.error("Error fetching history:", err));
    }
  }, [user?.id, id, submitting]);

  const handleImageUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "File size must be less than 2MB", variant: "destructive" });
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "Corre_image");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "Corre"}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to upload image");
      }

      setUploadedImageUrl(data.secure_url);
      toast({ title: "Success", description: "Image uploaded successfully." });
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      handleImageUpload(file);
    }
  };

  const handleSubmitInvestment = async () => {
    if (!amount || Number(amount) < 5000) {
      toast({ title: "Error", description: "Minimum amount is 5000 NGN.", variant: "destructive" });
      return;
    }
    if (!uploadedImageUrl) {
      toast({ title: "Error", description: "Please upload your receipt first.", variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/investments/private-market`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyUserId: user.id,
          investmentId: id,
          amount,
          receiptImageUrl: uploadedImageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit investment");

      toast({ title: "Success", description: "Investment submitted successfully! We will verify and allocate your share." });
      setUploadedImageUrl(null);
      setSelectedFile(null);
      setAmount("");
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Failed to submit investment";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render On-Chain RWA View ───────────────────────────────────────────────
  if (rwaConfig) {
    const unitPrice = rwaOverview?.asset?.priceUSD ?? 525.0;
    const feePct = rwaOverview?.asset?.feePercent ?? 1.0;
    const isActive = rwaOverview?.asset?.isActive ?? true;
    const vaultBal = rwaOverview?.vaultRwaBalance ?? "—";
    const holdingsValueUSD = (userRwaShares ?? 0) * unitPrice;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/invest/private-market")}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Private Market</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 text-xs"
              onClick={loadRwaData}
              disabled={rwaLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rwaLoading ? "animate-spin" : ""}`} />
              <span>Refresh On-Chain</span>
            </Button>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 rounded-2xl border border-primary/20 bg-primary/10">
                  <AvatarImage src={rwaConfig.icon} alt={rwaConfig.name} className="object-cover" />
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-xl font-bold">
                    {rwaConfig.symbol.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight">{rwaConfig.name}</h1>
                    <Badge variant="outline" className="text-xs">
                      {rwaConfig.symbol}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {rwaConfig.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                      Solana Mainnet
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{rwaConfig.issuer}</span>
                    {rwaConfig.location && <span>&bull; {rwaConfig.location}</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Unit Price</span>
                <p className="text-lg font-bold text-foreground">
                  {rwaConfig.payoutSymbol === "cNGN" ? "₦" : "$"}
                  {unitPrice.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">{rwaConfig.payoutSymbol}</span>
                </p>
              </div>

              <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Min. Order</span>
                <p className="text-lg font-bold text-foreground">
                  {rwaConfig.minBuyCostPayout
                    ? `₦${rwaConfig.minBuyCostPayout.toLocaleString()}`
                    : "—"}
                  <span className="text-xs font-normal text-muted-foreground block">
                    {rwaConfig.minBuyShares ? `(${rwaConfig.minBuyShares} ${rwaConfig.symbol})` : ""}
                  </span>
                </p>
              </div>

              <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Trading Fee</span>
                <p className="text-lg font-bold text-foreground">{feePct}%</p>
              </div>

              <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Vault Liquidity</span>
                <p className="text-lg font-bold text-foreground truncate">{vaultBal}</p>
              </div>

              <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-destructive"}`} />
                  <span className="text-sm font-semibold">{isActive ? "Active" : "Paused"}</span>
                </div>
              </div>
            </div>

            {/* User Holdings Card */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/30 to-secondary/10 border border-primary/20 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Your Position</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Wallet:{" "}
                  {rwaConfig.payoutSymbol === "cNGN"
                    ? `${userUsdcBalance !== null ? `${userUsdcBalance.toFixed(2)} USDC` : "—"} · ${userCngnBalance !== null ? `${userCngnBalance.toFixed(2)} cNGN` : "—"}`
                    : userUsdcBalance !== null
                    ? `${userUsdcBalance.toFixed(2)} ${rwaConfig.payoutSymbol}`
                    : "—"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Holding</span>
                  <p className="text-2xl font-bold">
                    {userRwaShares !== null ? `${userRwaShares.toFixed(4)} ${rwaConfig.symbol}` : "0.0000"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. Value: {rwaConfig.payoutSymbol === "cNGN" ? "₦" : "$"}{holdingsValueUSD.toFixed(2)} {rwaConfig.payoutSymbol}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    className="flex-1 sm:flex-none rounded-full px-6 font-semibold"
                    onClick={() => {
                      setTradeDirection("buy");
                      setTradeModalOpen(true);
                    }}
                  >
                    Buy {rwaConfig.symbol}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none rounded-full px-6 font-semibold"
                    disabled={!userRwaShares || userRwaShares <= 0}
                    onClick={() => {
                      setTradeDirection("sell");
                      setTradeModalOpen(true);
                    }}
                  >
                    Sell
                  </Button>
                </div>
              </div>
            </div>

            {/* Early Access Overview Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-secondary/30 border border-primary/20 p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 bg-primary/20 text-primary border-primary/30 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Early Access Allocation</span>
                </Badge>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Early Access: Dangote Petroleum Refinery &amp; Petrochemicals IPO
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We are excited to present early access to the Dangote Petroleum Refinery and Petrochemicals IPO, now available for indication of interest on Corre.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This is your opportunity to participate in what is widely expected to be the largest initial public offering in African capital market history. Through Corre, you can gain exposure to Dangote Refinery shares via a synthetic equity structure that holds the underlying stock in a dedicated Special Purpose Vehicle (SPV), with custody managed by Anchoria.
              </p>
            </div>

            {/* Section: What is a Synthetic Equity Position? */}
            <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">What is a Synthetic Equity Position?</h3>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Unlike a commercial paper or bond, this is an equity instrument. There is no fixed interest rate and no maturity date. Your return comes from two sources: any appreciation in the share price over time, and dividends declared by the company (Dangote has proposed paying dividends in US Dollars, backed by the refinery&apos;s export earnings).
                </p>
                <p>
                  Because the Dangote Refinery IPO is listed on the Nigerian Exchange (NGX) and subscriptions run through CSCS accounts and licensed brokers, Corre gives you access through a structured holding rather than a direct allocation. Here is how it works:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wide">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>Ring-Fenced SPV Structure</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      GetEquity (through its issuing partner) subscribes to and holds the underlying Dangote Refinery shares in a ring-fenced Special Purpose Vehicle (SPV). The SPV exists solely to hold these shares on behalf of investors. When you invest, you receive a digital representation of your proportional economic interest in the shares held by that SPV. You do not hold the shares directly in your own CSCS account; instead, your beneficial ownership is recorded and held in trust.
                    </p>
                  </div>

                  <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wide">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span>Regulated Custody by Anchoria</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The actual shares are held in custody by Anchoria, a licensed and SEC-regulated custodian. The custodian&apos;s role is to safekeep the underlying assets, independent of Corre, so that the shares backing your position are held by a regulated third party rather than by the platform itself. This separation protects investors: your economic interest is tied to real, custodied shares.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3.5 flex items-start gap-2.5 text-xs text-foreground/90">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-foreground">In short:</span> You get the upside of holding Dangote Refinery equity (price appreciation plus dividends) through a fractional, accessible structure, while the underlying shares sit safely with a regulated custodian inside a dedicated SPV.
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Key Terms of the Offer */}
            <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Key Terms of the Offer</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  Indicative Term Sheet
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Issuer of Underlying Shares</span>
                  <p className="font-semibold text-foreground">Dangote Petroleum Refinery and Petrochemicals FZE</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Instrument</span>
                  <p className="font-semibold text-foreground">Synthetic Equity (Digital representation of shares in SPV)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Structure</span>
                  <p className="font-semibold text-foreground">Shares held in a dedicated Special Purpose Vehicle (SPV)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Custodian</span>
                  <p className="font-semibold text-foreground">Anchoria (Licensed &amp; SEC-Regulated Custodian)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Listing Venue</span>
                  <p className="font-semibold text-foreground">Nigerian Exchange (NGX) &bull; Potential dual listing under review</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Per-Share Indicative Price</span>
                  <p className="font-semibold text-primary">$0.35 &asymp; &#8358;525</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Estimated Valuation</span>
                  <p className="font-semibold text-foreground">$40B – $50B (Valuation: $39.1B &asymp; &#8358;59.8 Trillion)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Offer Size</span>
                  <p className="font-semibold text-foreground">Approximately 10% of company equity (~$5B raise)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Interest Rate &amp; Maturity</span>
                  <p className="font-semibold text-foreground">None (Open-ended equity; returns via price appreciation and dividends)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Dividends</span>
                  <p className="font-semibold text-foreground">Proposed in US Dollars, subject to company declaration</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Expected IPO Subscription Window</span>
                  <p className="font-semibold text-foreground">Targeted H2 2026 (September 2026 targeted; confirmed in SEC prospectus)</p>
                </div>

                <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <span className="text-muted-foreground">Regulatory Status</span>
                  <p className="font-semibold text-foreground">IPO subject to SEC Nigeria prospectus approval</p>
                </div>
              </div>
            </div>

            {/* Section: About Dangote Petroleum Refinery */}
            <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">About Dangote Petroleum Refinery</h3>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  The Dangote Petroleum Refinery and Petrochemicals FZE, located in the Lekki Free Trade Zone in Lagos, is the world&apos;s largest single-train crude oil refinery. Commissioned in May 2023 after nearly a decade of construction and an investment of approximately $20 billion, the facility moved into full commercial operations in early 2024.
                </p>
                <p>
                  By February 2026, the refinery had reached its full processing capacity of 650,000 barrels of crude oil per day, refining crude into petrol, diesel, and aviation fuel. In an official test run, the plant exceeded its rated capacity, running at roughly 700,000 barrels per day for the first time.
                </p>
                <p>
                  The refinery is not a speculative venture. It is already operating at scale, generating foreign currency income, supplying the domestic Nigerian market, and exporting refined products to Ghana, Cameroon, Togo, Tanzania, and international markets including Europe. Jet fuel exports alone grew significantly between 2024 and 2026.
                </p>
                <p>
                  The business benefits from structural advantages unavailable to competitors, including the <span className="text-foreground font-medium">Naira-for-Crude programme</span>, under which NNPC supplies domestic crude in naira rather than dollars, reducing the refinery&apos;s foreign exchange exposure.
                </p>
              </div>
            </div>

            {/* Section: The Investment Case */}
            <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">The Investment Case</h3>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  The IPO involves the listing of approximately 10% of the refinery&apos;s equity, with the company targeting a valuation of between $40 billion and $50 billion and a raise of up to roughly $5 billion. For context, this is several times larger than the previous record Nigerian listing, MTN Nigeria in 2019, which raised approximately $876 million. Analysts have drawn comparisons to the Saudi Aramco listing of 2019, a national-scale energy asset opening to public ownership for the first time.
                </p>
                <p>
                  Proceeds from the IPO are earmarked for an expansion phase, with the Dangote Group planning to invest up to $40 billion over five years to more than double refining capacity from 650,000 bpd toward 1.5 million bpd.
                </p>
              </div>
            </div>

            {/* Section: Why Consider This Offer */}
            <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Why Consider This Offer</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">Generational Asset</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Direct economic exposure to the largest single-train refinery in the world, already operating at full capacity.
                  </p>
                </div>

                <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">Real, Operating Business</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Unlike a typical IPO, the refinery is already generating revenue, foreign exchange earnings, and domestic supply, which changes the risk profile considerably.
                  </p>
                </div>

                <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-500" />
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">Dollar Dividend Potential</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A proposed USD dividend structure backed by export earnings offers a potential hard-currency income stream.
                  </p>
                </div>

                <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">Accessible Structure</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Corre&apos;s SPV model lets you gain fractional exposure without navigating direct CSCS subscription, while the underlying shares are safeguarded by a regulated custodian.
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">Structural Protection</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Underlying shares are held by Anchoria, an SEC-regulated custodian, independent of the platform.
                  </p>
                </div>
              </div>
            </div>

            {/* On-Chain Verification Reference */}
            <div className="rounded-xl bg-secondary/30 border border-border/40 p-4 space-y-2 text-xs">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>On-Chain Verification Details</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <span className="block text-[11px]">RWA Mint:</span>
                  <span className="font-mono text-foreground break-all">{rwaConfig.mint}</span>
                </div>
                <div>
                  <span className="block text-[11px]">Payout Mint ({rwaConfig.payoutSymbol}):</span>
                  <span className="font-mono text-foreground break-all">{rwaConfig.payoutMint}</span>
                </div>
                <div>
                  <span className="block text-[11px]">Protocol Architecture:</span>
                  <span className="text-foreground">GetEquity Fixed-Price Vault (Token-2022)</span>
                </div>
                <div>
                  <span className="block text-[11px]">Network Cluster:</span>
                  <span className="text-foreground uppercase">{rwaConfig.cluster}</span>
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
          onTradeSuccess={loadRwaData}
          initialAmount={amount}
        />
      </div>
    );
  }

  // ── Render Legacy / Off-Chain Private Venture View ─────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/invest/private-market")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Private Market</span>
          </button>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Palm Oil Mill Operations
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Cross River State, Nigeria &bull; Provider: Nilep
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-border/60">
            <div>
              <div className="text-xs text-muted-foreground">Expected ROI</div>
              <div className="text-lg font-semibold text-primary">10% - 15%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cycle</div>
              <div className="text-lg font-semibold">Q{Math.floor(new Date().getMonth() / 3) + 1}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Target Amount</div>
              <div className="text-lg font-semibold">₦2,000,000</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Invested</div>
              <div className="text-lg font-semibold text-primary">₦{totalInvested.toLocaleString()}</div>
            </div>
          </div>

          {/* Calculator */}
          <div className="bg-secondary/30 rounded-xl p-5 border border-border/50 space-y-4">
            <h3 className="text-base font-semibold">Returns Calculator</h3>
            <div className="space-y-2">
              <Label htmlFor="calc-amount">Investment Amount (NGN)</Label>
              <Input
                id="calc-amount"
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                min="5000"
                step="1000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <div className="text-xs text-muted-foreground">Est. Profit (up to 15%)</div>
                <div className="text-base font-semibold text-emerald-500">+₦{expectedProfit.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Payout</div>
                <div className="text-base font-semibold text-foreground">₦{expectedTotal.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button className="w-full rounded-full" onClick={() => setBuyDialogOpen(true)}>
              Invest in this Project
            </Button>
          </div>

          {/* Upload Documentation Section */}
          <div className="space-y-4 pt-6 border-t border-border/60">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              Upload Transfer Receipt
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invest-amount">Investment Amount (NGN)</Label>
                <Input
                  id="invest-amount"
                  type="number"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="5000"
                />
              </div>

              <div>
                <Label>Upload Payment Receipt</Label>
                <Input type="file" accept="image/*" onChange={handleFileChange} />
                {uploadedImageUrl && (
                  <div className="mt-2">
                    <img
                      src={uploadedImageUrl}
                      alt="Uploaded Document"
                      className="w-full max-w-md rounded-xl border border-border/60 shadow-sm"
                    />
                    <Button
                      className="w-full mt-4"
                      onClick={handleSubmitInvestment}
                      disabled={submitting || !amount}
                    >
                      {submitting ? "Submitting..." : "Submit Investment"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-border/60">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Your Investments
              </h3>
              <div className="space-y-3">
                {history.map((tx) => (
                  <div key={tx.id} className="bg-secondary/30 rounded-xl p-4 border border-border/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="font-semibold text-lg">₦{Number(tx.amount).toLocaleString()} NGN</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {tx.status === "CONFIRMED" ? (
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 mb-1">
                          Confirmed
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-500">
                          Pending Verification
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please make a Naira transfer to the following account:
            </p>
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Account Name:</span>
                <span className="font-semibold text-sm text-right">MAGNIFY MARKETING</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Minimum Transfer Amount:</span>
                <span className="font-semibold text-sm text-right">5000 NGN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Account Number:</span>
                <span className="font-semibold text-sm">8885765485</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Bank:</span>
                <span className="font-semibold text-sm">PalmPay</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setBuyDialogOpen(false)} className="w-full">
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestPrivateMarketDetails;
