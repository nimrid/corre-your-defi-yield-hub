import Navigation from "@/components/Navigation";
import { ArrowLeft, Wallet, Loader2, ArrowRight, Share, CheckCircle2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getRateByType, RateType, createOnrampOrder, Currency, Chain, OnrampOrder } from 'paj_ramp';
import { usePrivy, useWallets as useEvmWallets } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { webhookUrl, apiFetch } from "@/services/apiClient";
import { usePajSession } from "@/hooks/usePajSession";
import { PajSessionModal } from "@/components/PajSessionModal";
import { calculatePlatformFee, MARKUP_PERCENT, MIN_PLATFORM_FEE_USDC } from "@/utils/feeCalculator";
import { ARC_USDC_MINT } from "@/config/arcChain";
import { useInvalidateTransactionHistory } from "@/hooks/useTransactionHistory";

const BuyUSDCNaira = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = usePrivy();
    const { wallets: evmWallets } = useEvmWallets();
    const { wallets: solanaWalletsList } = useSolanaWallets();

    const [network, setNetwork] = useState<"solana" | "arc">("solana");
    const invalidateTxHistory = useInvalidateTransactionHistory();
    
    // PAJ Session Management
    const { 
        sessionToken, 
        userEmail, 
        isModalOpen, 
        requestSession, 
        handleSessionSuccess, 
        handleModalClose 
    } = usePajSession();

    // Support URL param pre-selection (e.g. ?network=arc&amount=50000)
    useEffect(() => {
        const params = new URLSearchParams(location.search || window.location.search || "");
        const netParam = params.get("network");
        if (netParam === "arc") setNetwork("arc");
        else if (netParam === "solana") setNetwork("solana");

        const amountParam = params.get("amount");
        if (amountParam && Number(amountParam) > 0) {
            setAmountNaira(amountParam);
        }
    }, [location.search]);

    // Mirror Home.tsx & SendWallet.tsx: resolve Solana and Arc (EVM) wallets
    const linkedWallets = (user?.linkedAccounts ?? []).filter(
        (a): a is typeof a & { address?: string; chainType?: string; chain?: string } =>
            (a as { type?: string }).type === "wallet" || (a as { type?: string }).type === "smart_wallet"
    );

    const linkedSolana = linkedWallets.filter(
        (a) => a.chainType === "solana" || a.chain === "solana"
    );
    const linkedEthereum = linkedWallets.filter(
        (a) =>
            a.chainType === "ethereum" ||
            a.chain === "ethereum" ||
            (typeof a.address === "string" && a.address.startsWith("0x"))
    );

    const solanaWallets = solanaWalletsList.length
        ? solanaWalletsList
        : evmWallets.filter((w) => (w as { walletClientType?: string }).walletClientType === "solana");

    const primarySolanaAddress: string | undefined =
        solanaWallets[0]?.address ??
        linkedSolana[0]?.address ??
        (!user?.wallet?.address?.startsWith("0x") ? user?.wallet?.address : undefined);

    const arcWallets = evmWallets.filter(
        (w) =>
            (w as { type?: string }).type === "ethereum" ||
            w.walletClientType === "ethereum" ||
            w.walletClientType === "privy" ||
            (typeof w.address === "string" && w.address.startsWith("0x"))
    );

    const primaryArcAddress: string | undefined =
        arcWallets[0]?.address ??
        linkedEthereum[0]?.address ??
        (user?.wallet?.address?.startsWith("0x") ? user.wallet.address : undefined);

    const activeRecipientAddress = network === "arc" ? primaryArcAddress : primarySolanaAddress;

    const [amountNaira, setAmountNaira] = useState("");
    const [baseRate, setBaseRate] = useState<number | null>(null);
    const [rateLoading, setRateLoading] = useState(true);
    const [estimatedUSDC, setEstimatedUSDC] = useState<string>("");

    const [creatingOrder, setCreatingOrder] = useState(false);
    const [order, setOrder] = useState<OnrampOrder | null>(null);
    const [orderError, setOrderError] = useState("");
    // Store calculated values at order-creation time for the success screen
    const [orderPlatformFee, setOrderPlatformFee] = useState<number>(0);
    const [orderNetUSDC, setOrderNetUSDC] = useState<number>(0);

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

    // Calculate estimated USDC locally from the base rate — deducting the dynamic hybrid platform fee
    useEffect(() => {
        const numAmount = Number(amountNaira);
        if (!numAmount || numAmount < 1000 || !baseRate) {
            setEstimatedUSDC("");
            return;
        }
        const grossUSDC = numAmount / baseRate;
        const fee = calculatePlatformFee(grossUSDC);
        const netUSDC = Math.max(0, grossUSDC - fee);
        setEstimatedUSDC(netUSDC.toFixed(2));
    }, [amountNaira, baseRate]);

    const handleBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        setOrderError("");

        const walletAddress = network === "arc" ? primaryArcAddress : primarySolanaAddress;

        console.log(`Resolved ${network} wallet address:`, walletAddress);

        if (!walletAddress) {
            setOrderError(
                network === "arc"
                    ? "No Arc wallet found. Please ensure your Arc wallet is connected."
                    : "No Solana wallet found. Please connect your wallet."
            );
            return;
        }

        // Validate address format based on chosen network
        if (network === "solana") {
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
            if (!base58Regex.test(walletAddress)) {
                console.error("Invalid Solana Base58 address:", walletAddress);
                setOrderError(`Invalid Solana wallet address format: "${walletAddress}". Please reconnect your wallet.`);
                return;
            }
        } else {
            const evmRegex = /^0x[a-fA-F0-9]{40}$/;
            if (!evmRegex.test(walletAddress)) {
                console.error("Invalid Arc EVM address:", walletAddress);
                setOrderError(`Invalid Arc wallet address format: "${walletAddress}". Please reconnect your wallet.`);
                return;
            }
        }

        const numAmount = Number(amountNaira);
        if (!numAmount || numAmount < 1000) {
            setOrderError("Amount must be at least ₦1000.");
            return;
        }

        const USDC_SOLANA_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        const orderChain = network === "arc" ? "ARC" : Chain.SOLANA;
        const orderMint = network === "arc" ? ARC_USDC_MINT : USDC_SOLANA_MINT;

        console.log("Creating onramp order with:", {
            fiatAmount: numAmount,
            currency: Currency.NGN,
            recipient: walletAddress,
            mint: orderMint,
            chain: orderChain,
        });

        setCreatingOrder(true);
        try {
            // Request session token (will open modal if needed)
            let token = sessionToken;
            if (!token) {
                try {
                    token = await requestSession();
                } catch (sessionErr: unknown) {
                    const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
                    setOrderError(msg || "Session setup required. Please try again.");
                    setCreatingOrder(false);
                    return;
                }
            }

            const grossUSDC = baseRate ? numAmount / baseRate : 0;
            const fee = calculatePlatformFee(grossUSDC);
            const netUSDC = Math.max(0, grossUSDC - fee);

            const newOrder = await createOnrampOrder(
                {
                    fiatAmount: numAmount,
                    currency: Currency.NGN,
                    recipient: walletAddress,
                    mint: orderMint,
                    chain: orderChain as unknown as Chain,
                    webhookURL: webhookUrl("/webhook/paj-ramp"),
                    fee,
                },
                token
            );
            console.log("Order created:", newOrder);
            // Persist local calculations for the success screen
            setOrderPlatformFee(fee);
            setOrderNetUSDC(
                // Prefer the API-returned amount minus fee; fall back to local calc
                newOrder?.amount && newOrder.amount > 0
                    ? Math.max(0, newOrder.amount - fee)
                    : netUSDC
            );
            setOrder(newOrder);

            // Record in backend transaction history for immediate dashboard visibility
            if (user?.id) {
                const finalAmount = newOrder?.amount && newOrder.amount > 0 ? Math.max(0, newOrder.amount - fee) : netUSDC;
                void apiFetch("/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        privyUserId: user.id,
                        chainType: network === "arc" ? "arc" : "solana",
                        assetSymbol: "USDC",
                        amount: finalAmount.toString(),
                        direction: "incoming",
                        txSignature: newOrder.id || null,
                        fromAddress: "PAJ Virtual Bank",
                        toAddress: walletAddress,
                        source: "onramp",
                    }),
                }).finally(() => {
                    void invalidateTxHistory();
                });
            } else {
                void invalidateTxHistory();
            }
        } catch (err: unknown) {
            console.error("Order creation failed:", err);
            let msg = "Failed to create order. Please try again.";
            if (typeof err === "string") {
                msg = err;
            } else if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === "object" && err !== null) {
                const obj = err as Record<string, unknown>;
                if (typeof obj.message === "string") {
                    msg = obj.message;
                } else if (Array.isArray(obj.message)) {
                    msg = obj.message.join(", ");
                } else if (typeof obj.error === "string") {
                    msg = obj.error;
                }
            }
            setOrderError(msg);
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
                            {/* Destination Network Selector */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium">
                                    Destination Network
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/30 rounded-xl border border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNetwork("solana");
                                            setOrderError("");
                                        }}
                                        className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                                            network === "solana"
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${network === "solana" ? "bg-white" : "bg-purple-400"}`} />
                                            <span>Solana</span>
                                        </div>
                                        <span className="text-[10px] opacity-80 mt-0.5">SPL USDC</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNetwork("arc");
                                            setOrderError("");
                                        }}
                                        className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                                            network === "arc"
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${network === "arc" ? "bg-white" : "bg-emerald-400"}`} />
                                            <span>Arc</span>
                                        </div>
                                        <span className="text-[10px] opacity-80 mt-0.5">Native USDC</span>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                    <span>Recipient:</span>
                                    <span className="font-mono text-foreground font-medium truncate max-w-[200px]">
                                        {activeRecipientAddress
                                            ? `${activeRecipientAddress.slice(0, 6)}...${activeRecipientAddress.slice(-4)}`
                                            : "No wallet found"}
                                    </span>
                                </div>
                            </div>

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
                                {baseRate && Number(amountNaira) >= 1000 && (
                                    <div className="bg-secondary/40 rounded-lg p-2.5 mt-3 text-xs flex justify-between items-center text-muted-foreground border border-border/40">
                                        <span>Platform Fee:</span>
                                        <span className="font-semibold text-foreground">
                                            {calculatePlatformFee(Number(amountNaira) / baseRate).toFixed(2)} USDC
                                            <span className="text-[10px] text-muted-foreground ml-1">
                                                ({(MARKUP_PERCENT * 100).toFixed(0)}%, min {MIN_PLATFORM_FEE_USDC.toFixed(2)})
                                            </span>
                                        </span>
                                    </div>
                                )}
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

                            {/* Receipt-style breakdown */}
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3 text-left">
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✅ Order successful — transfer details below</p>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>
                                        <p className="font-medium text-foreground">₦{order.fiatAmount.toLocaleString()}</p>
                                        <p>You send</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary text-sm">
                                            ~{orderNetUSDC.toFixed(2)} USDC
                                        </p>
                                        <p>You receive</p>
                                    </div>
                                    {baseRate && (
                                        <div>
                                            <p className="font-medium text-foreground">₦{baseRate.toLocaleString()}</p>
                                            <p>Rate per USDC</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-foreground">{orderPlatformFee.toFixed(2)} USDC</p>
                                        <p>Fee</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">
                                            {network === "arc" ? "Arc (Layer-1)" : "Solana"}
                                        </p>
                                        <p>Network</p>
                                    </div>
                                    <div>
                                        <p className="font-mono text-foreground truncate max-w-[140px]">
                                            {order.recipient ? `${order.recipient.slice(0, 6)}...${order.recipient.slice(-4)}` : ""}
                                        </p>
                                        <p>Destination</p>
                                    </div>
                                </div>
                                {order.id && (
                                    <p className="text-xs text-muted-foreground font-mono">Order ID: {order.id}</p>
                                )}
                            </div>

                            {/* Bank transfer details */}
                            <div className="bg-secondary/30 border border-border/60 rounded-xl p-5 space-y-4 text-left">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transfer To</p>
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
                                <p><strong>Note:</strong> You will receive ~<strong>{orderNetUSDC.toFixed(2)} USDC</strong> on <strong>{network === "arc" ? "Arc Network" : "Solana Network"}</strong> at <span className="font-mono break-all">{order.recipient}</span> once the transfer is confirmed.</p>
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
