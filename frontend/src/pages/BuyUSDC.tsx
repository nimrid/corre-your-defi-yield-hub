import Navigation from "@/components/Navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

const BuyUSDC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = usePrivy();
    const { wallets } = useWallets();
    const { toast } = useToast();

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

    const handleCopy = () => {
        if (!primarySolanaAddress) return;
        navigator.clipboard.writeText(primarySolanaAddress);
        toast({
            title: "Address copied",
            description: "Wallet address copied to clipboard",
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navigation />
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
                <button
                    type="button"
                    onClick={() => navigate("/home")}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t("buy_usdc.back")}</span>
                </button>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight mb-4">{t("buy_usdc.title")}</h1>
                    <p className="text-muted-foreground mb-6">
                        {t("buy_usdc.description")}
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => navigate("/buy-usdc/naira")}
                        className="glass-card p-6 text-left rounded-2xl hover:shadow-lg transition-shadow"
                    >
                        <h2 className="text-xl font-semibold mb-2">{t("buy_usdc.buy_with_naira")}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t("buy_usdc.buy_with_naira_desc")}
                        </p>
                    </button>

                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className="glass-card p-6 text-left rounded-2xl hover:shadow-lg transition-shadow flex flex-col justify-between"
                            >
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">{t("buy_usdc.receive_stablecoin")}</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {t("buy_usdc.receive_stablecoin_desc")}
                                    </p>
                                </div>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{t("buy_usdc.receive_stablecoin")}</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center space-y-6 py-6">
                                {primarySolanaAddress ? (
                                    <>
                                        <div className="bg-white p-4 rounded-xl">
                                            <QRCodeSVG value={primarySolanaAddress} size={200} />
                                        </div>
                                        <div className="text-center space-y-2 w-full">
                                            <p className="text-sm font-medium text-muted-foreground">{t("buy_usdc.solana_wallet_address")}</p>
                                            <div className="flex items-center justify-between gap-2 bg-secondary/50 p-3 rounded-lg w-full">
                                                <code className="text-xs sm:text-sm break-all text-left flex-1">{primarySolanaAddress}</code>
                                                <button
                                                    onClick={handleCopy}
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
