import Navigation from "@/components/Navigation";
import { ArrowLeft, Copy, CreditCard, Globe, Landmark, QrCode, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useWallets, useFiatOnramp } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

const BuyUSDC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = usePrivy();
    const { wallets } = useWallets();
    const { toast } = useToast();
    const { fund } = useFiatOnramp();

    const [isOnramping, setIsOnramping] = useState(false);
    const [cardModalOpen, setCardModalOpen] = useState(false);

    // Resolve Solana Wallets
    const solanaWallets = wallets.filter((w) => w.walletClientType === "solana");
    const linkedWallets = (user?.linkedAccounts ?? []).filter(
      (a: any) => a.type === "wallet" || a.type === "smart_wallet"
    );
    const linkedSolana = linkedWallets.filter(
      (a: any) => a.chainType === "solana" || a.chain === "solana"
    );
    const primarySolanaAddress: string | undefined =
      (solanaWallets[0] as any)?.address ??
      (linkedSolana[0] as any)?.address;

    const activeAddress = primarySolanaAddress;

    const handleGlobalOnramp = async () => {
      const destinationAddress = activeAddress;
      if (!destinationAddress) {
        toast({
          title: "Solana Wallet Not Found",
          description: "Please log in with a valid Solana wallet to perform fiat onramping.",
          variant: "destructive",
        });
        return;
      }

      setIsOnramping(true);
      setCardModalOpen(false);

      try {
        const result = await fund({
          source: {
            defaultAsset: "usd",
          },
          destination: {
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            chain: "solana:mainnet",
            address: destinationAddress,
          },
          environment: import.meta.env.MODE === "production" ? "production" : "sandbox",
          defaultAmount: "50",
        });

        if (result?.status === "confirmed") {
          toast({
            title: t("buy_usdc.purchase_confirmed"),
            description: t("buy_usdc.purchase_confirmed_desc"),
          });
        } else if (result?.status === "submitted") {
          toast({
            title: t("buy_usdc.purchase_submitted"),
            description: t("buy_usdc.purchase_submitted_desc"),
          });
        }
      } catch (error: any) {
        console.error("Fiat onramp error:", error);
        const message = error?.message || "";
        const isUserClosed = message.toLowerCase().includes("user closed") || message.toLowerCase().includes("closed flow");
        
        if (!isUserClosed) {
          if (message.toLowerCase().includes("timed out") || message.toLowerCase().includes("stripe") || message.toLowerCase().includes("403") || message.toLowerCase().includes("init failed")) {
            toast({
              title: "Onramp Provider Init Error",
              description: "Stripe/Privy onramp failed to load. Please disable ad blockers (uBlock/Brave) or verify card onramp settings in your Privy Dashboard.",
              variant: "destructive",
            });
          } else {
            toast({
              title: t("buy_usdc.onramp_failed"),
              description: message || t("buy_usdc.onramp_failed_desc"),
              variant: "destructive",
            });
          }
        }
      } finally {
        setIsOnramping(false);
      }
    };

    const handleCopy = (addr?: string) => {
        const target = addr || primarySolanaAddress;
        if (!target) return;
        navigator.clipboard.writeText(target);
        toast({
            title: "Address copied",
            description: "Wallet address copied to clipboard",
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navigation />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
                <button
                    type="button"
                    onClick={() => navigate("/home")}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t("buy_usdc.back")}</span>
                </button>

                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Instant USDC Onramp</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("buy_usdc.title")}</h1>
                    <p className="text-muted-foreground max-w-xl">
                        {t("buy_usdc.description")} Select your preferred payment method below to fund your wallet with USDC.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Option 1: Global Card Onramp */}
                    <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
                        <DialogTrigger asChild>
                            <div className="glass-card p-6 text-left rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between border border-border/60 hover:border-primary/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <CreditCard className="w-24 h-24 text-primary" />
                                </div>
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <Globe className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-lg font-bold">{t("buy_usdc.buy_with_card")}</h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t("buy_usdc.buy_with_card_desc")}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/40 space-y-3">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                                        <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Cards</span>
                                        <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Apple Pay</span>
                                        <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Google Pay</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                                        <span>Buy Globally</span>
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <Globe className="w-5 h-5 text-primary" />
                                    {t("buy_usdc.global_onramp_title")}
                                </DialogTitle>
                                <DialogDescription>
                                    {t("buy_usdc.global_onramp_subtitle")}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5 py-4">
                                <div className="bg-secondary/40 p-4 rounded-xl space-y-2 border border-border/60">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                        Destination Wallet (Solana)
                                    </label>
                                    <div className="flex items-center justify-between bg-background/80 p-3 rounded-lg border border-border/60">
                                        <span className="font-mono text-xs truncate max-w-[240px]">
                                            {primarySolanaAddress || "No wallet connected"}
                                        </span>
                                        {primarySolanaAddress && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                                                Solana Network
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-primary/5 p-3 rounded-lg text-xs text-muted-foreground space-y-1.5 border border-primary/10">
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                        <ShieldCheck className="w-4 h-4 text-primary" />
                                        <span>Supported Fiat Currencies</span>
                                    </div>
                                    <p className="text-[11px]">
                                        USD, EUR, GBP, CAD, AUD, JPY, MXN, BRL, ZAR, NGN & 40+ more fiat currencies processed automatically by region.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleGlobalOnramp}
                                    disabled={isOnramping || !activeAddress}
                                    className="w-full py-6 text-base rounded-xl flex items-center justify-center gap-2 font-semibold shadow-md"
                                >
                                    {isOnramping ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>{t("buy_usdc.starting_onramp")}</span>
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            <span>{t("buy_usdc.launch_onramp")}</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Option 2: African Bank Transfer (Naira PAJ Ramp) */}
                    <button
                        type="button"
                        onClick={() => navigate("/buy-usdc/naira")}
                        className="glass-card p-6 text-left rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between border border-border/60 hover:border-primary/50 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Landmark className="w-24 h-24 text-primary" />
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <Landmark className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold mb-1">{t("buy_usdc.buy_with_naira")}</h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t("buy_usdc.buy_with_naira_desc")}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border/40 space-y-3">
                            <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                                <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Bank Transfer</span>
                                <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Naira (NGN)</span>
                                <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">PAJ Ramp</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold text-emerald-500 group-hover:translate-x-1 transition-transform">
                                <span>Transfer NGN</span>
                                <Landmark className="w-4 h-4" />
                            </div>
                        </div>
                    </button>

                    {/* Option 3: Receive Stablecoin (QR Code & Address) */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className="glass-card p-6 text-left rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between border border-border/60 hover:border-primary/50 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <QrCode className="w-24 h-24 text-primary" />
                                </div>
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                        <QrCode className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold mb-1">{t("buy_usdc.receive_stablecoin")}</h2>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t("buy_usdc.receive_stablecoin_desc")}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/40 space-y-3">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                                        <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Solana QR</span>
                                        <span className="px-2 py-0.5 rounded-md bg-secondary/80 font-medium">Deposit Address</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-purple-500 group-hover:translate-x-1 transition-transform">
                                        <span>Show QR & Address</span>
                                        <QrCode className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{t("buy_usdc.receive_stablecoin")}</DialogTitle>
                                <DialogDescription>Scan or copy your Solana wallet address below to receive USDC.</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center space-y-6 py-6">
                                {primarySolanaAddress ? (
                                    <>
                                        <div className="bg-white p-4 rounded-xl shadow-md">
                                            <QRCodeSVG value={primarySolanaAddress} size={200} />
                                        </div>
                                        <div className="text-center space-y-2 w-full">
                                            <p className="text-sm font-medium text-muted-foreground">{t("buy_usdc.solana_wallet_address")}</p>
                                            <div className="flex items-center justify-between gap-2 bg-secondary/50 p-3 rounded-lg w-full border border-border/60">
                                                <code className="text-xs sm:text-sm break-all text-left flex-1 font-mono">{primarySolanaAddress}</code>
                                                <button
                                                    onClick={() => handleCopy(primarySolanaAddress)}
                                                    className="p-2 hover:bg-secondary rounded-md transition-colors shrink-0"
                                                    title="Copy address"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-muted-foreground">
                                        {t("buy_usdc.no_solana_wallet")}
                                    </p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
};

export default BuyUSDC;
