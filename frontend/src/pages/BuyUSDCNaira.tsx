import Navigation from "@/components/Navigation";
import { ArrowLeft, Wallet, Loader2, ArrowRight, Share, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getRateByType, RateType, createOnrampOrder, Currency, Chain, OnrampOrder } from 'paj_ramp';
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { API_PREFIX } from "@/services/apiClient";
import { usePajSession } from "@/hooks/usePajSession";
import { PajSessionModal } from "@/components/PajSessionModal";

const BuyUSDCNaira = () => {
    const navigate = useNavigate();
    const { user } = usePrivy();
    const { wallets } = useWallets();
    
    // PAJ Session Management
    const { 
        sessionToken, 
        userEmail, 
        isModalOpen, 
        requestSession, 
        handleSessionSuccess, 
        handleModalClose 
    } = usePajSession();

    // Mirror Home.tsx: filter for Solana wallets, fall back to linked accounts
    const solanaWallets = wallets.filter((w) => w.walletClientType === "solana");
    const linkedSolana = (user?.linkedAccounts ?? []).filter(
        (a: any) => a.chainType === "solana" || a.chain === "solana"
    );
    const primarySolanaAddress: string | undefined =
        (solanaWallets[0] as any)?.address ?? (linkedSolana[0] as any)?.address;

    const [amountNaira, setAmountNaira] = useState("");
    const [baseRate, setBaseRate] = useState<number | null>(null);
    const [rateLoading, setRateLoading] = useState(true);
    const [estimatedUSDC, setEstimatedUSDC] = useState<string>("");

    const [creatingOrder, setCreatingOrder] = useState(false);
    const [order, setOrder] = useState<OnrampOrder | null>(null);
    const [orderError, setOrderError] = useState("");

    useEffect(() => {
        const fetchBaseRate = async () => {
            try {
                const rateData = await getRateByType(RateType.onRamp);
                if (rateData && rateData.rate) {
                    setBaseRate(rateData.rate);
                }
            } catch (err) {
                console.error("Failed to fetch base onramp rate:", err);
            } finally {
                setRateLoading(false);
            }
        };
        fetchBaseRate();
    }, []);

    // Calculate estimated USDC locally from the base rate — no extra API call needed
    useEffect(() => {
        const numAmount = Number(amountNaira);
        if (!numAmount || numAmount < 1000 || !baseRate) {
            setEstimatedUSDC("");
            return;
        }
        setEstimatedUSDC((numAmount / baseRate).toFixed(2));
    }, [amountNaira, baseRate]);

    const handleBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        setOrderError("");

        // Use same address resolution pattern as Home.tsx
        const walletAddress = primarySolanaAddress;

        console.log("Resolved Solana wallet address:", walletAddress);
        console.log("All wallets:", wallets.map((w: any) => ({ address: w.address, type: w.walletClientType })));

        if (!walletAddress) {
            setOrderError("No Solana wallet found. Please connect your wallet.");
            return;
        }

        // Validate it's a valid Base58 Solana address
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!base58Regex.test(walletAddress)) {
            console.error("Invalid Base58 address:", walletAddress);
            setOrderError(`Invalid wallet address format: "${walletAddress}". Please reconnect your wallet.`);
            return;
        }

        const numAmount = Number(amountNaira);
        if (!numAmount || numAmount < 1000) {
            setOrderError("Amount must be at least ₦1000.");
            return;
        }

        const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        console.log("Creating onramp order with:", {
            fiatAmount: numAmount,
            currency: Currency.NGN,
            recipient: walletAddress,
            mint: USDC_MINT,
            chain: Chain.SOLANA,
        });

        setCreatingOrder(true);
        try {
            // Request session token (will open modal if needed)
            let token = sessionToken;
            if (!token) {
                try {
                    token = await requestSession();
                } catch (err: any) {
                    setOrderError(err?.message || "Session setup required. Please try again.");
                    setCreatingOrder(false);
                    return;
                }
            }

            const newOrder = await createOnrampOrder(
                {
                    fiatAmount: numAmount,
                    currency: Currency.NGN,
                    recipient: walletAddress,
                    mint: USDC_MINT,
                    chain: Chain.SOLANA,
                    webhookURL: `${window.location.origin}${API_PREFIX}/webhooks/paj-onramp`,
                },
                token
            );
            console.log("Order created:", newOrder);
            setOrder(newOrder);
        } catch (err: any) {
            console.error("Order creation failed:", err);
            setOrderError(err?.message || "Failed to create order. Please try again.");
        } finally {
            setCreatingOrder(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navigation />
            
            {/* PAJ Session Modal */}
            {userEmail && (
                <PajSessionModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    onSuccess={handleSessionSuccess}
                    userEmail={userEmail}
                />
            )}
            
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
                <button
                    type="button"
                    onClick={() => navigate("/buy-usdc")}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Buy USDC</h1>
                    <p className="text-muted-foreground">
                        Purchase USDC directly using your local Naira bank account.
                    </p>
                </div>

                <div className="glass-card p-6 md:p-8 rounded-2xl max-w-md">
                    {!order ? (
                        <form onSubmit={handleBuy} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="amount" className="block text-sm font-medium">
                                    Amount (NGN)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                    <input
                                        id="amount"
                                        type="number"
                                        min="1000"
                                        step="100"
                                        required
                                        placeholder="e.g. 50000"
                                        className="w-full bg-secondary/50 border border-border/80 rounded-xl py-3 pl-8 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                        value={amountNaira}
                                        onChange={(e) => setAmountNaira(e.target.value)}
                                        disabled={creatingOrder}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="text-xs text-muted-foreground">
                                        {rateLoading ? (
                                            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching rate...</span>
                                        ) : baseRate ? (
                                            <span>Rate: $1 = ₦{baseRate.toLocaleString()}</span>
                                        ) : (
                                            <span>Rate unavailable</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground text-right font-medium">
                                        {estimatedUSDC ? (
                                            <span className="text-primary">Estimated: ~{estimatedUSDC} USDC</span>
                                        ) : (
                                            <span>Estimated: ~0.00 USDC</span>
                                        )}
                                    </div>
                                </div>
                                {orderError && (
                                    <p className="text-sm text-red-500 mt-2">{orderError}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full py-6 text-lg rounded-xl flex items-center gap-2" disabled={!amountNaira || Number(amountNaira) < 1000 || creatingOrder}>
                                {creatingOrder ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Creating Order...</>
                                ) : (
                                    <><Wallet className="w-5 h-5" /> Generate Transfer Link</>
                                )}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground mt-4">
                                Powered by PAJ Ramp
                            </p>
                        </form>
                    ) : (
                        <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-primary" />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold mb-1">Order Created!</h3>
                                <p className="text-sm text-muted-foreground">
                                    Transfer exactly <span className="font-bold text-foreground">₦{order.fiatAmount.toLocaleString()}</span> to the account below.
                                </p>
                            </div>

                            <div className="bg-secondary/30 border border-border/60 rounded-xl p-5 space-y-4 text-left">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                                    <p className="font-semibold">{order.bank}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Account Name</p>
                                    <p className="font-semibold">{order.accountName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                                    <div className="flex items-center justify-between">
                                        <p className="font-mono text-lg">{order.accountNumber}</p>
                                        <button
                                            className="text-primary hover:text-primary/80 transition-colors p-2"
                                            onClick={() => navigator.clipboard.writeText(order.accountNumber)}
                                        >
                                            <Share className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground text-left">
                                <p><strong>Note:</strong> You will receive ~{order.amount} USDC at {order.recipient} once the transfer is confirmed.</p>
                            </div>

                            <Button
                                className="w-full py-6 text-lg rounded-xl"
                                onClick={() => navigate("/")}
                            >
                                <ArrowRight className="w-5 h-5 mr-2" /> Done
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default BuyUSDCNaira;
