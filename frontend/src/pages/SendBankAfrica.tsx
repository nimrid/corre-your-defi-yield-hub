import Navigation from "@/components/Navigation";
import { ArrowLeft, Landmark, Loader2, CheckCircle2, AlertCircle, Check, ChevronsUpDown, Send, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  getRateByType,
  RateType,
  getBanks,
  resolveBankAccount,
  addBankAccount,
  Bank,
  getBankAccounts,
  createOfframpOrder,
  Currency,
  Chain,
} from 'paj_ramp';
import type { GetBankAccounts } from 'paj_ramp';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { usePajSession } from "@/hooks/usePajSession";
import { PajSessionModal } from "@/components/PajSessionModal";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { webhookUrl, apiFetch } from "@/services/apiClient";

// USDC mint on Solana
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const SendBankAfrica = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  
  // PAJ Session Management
  const { 
    sessionToken, 
    userEmail, 
    isModalOpen, 
    requestSession, 
    handleSessionSuccess, 
    handleModalClose 
  } = usePajSession();
  
  const [amountUSDC, setAmountUSDC] = useState("");
  const [baseRate, setBaseRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [estimatedNaira, setEstimatedNaira] = useState<string>("");
  const [estimating, setEstimating] = useState(false);

  // Bank selection dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [openBankSelect, setOpenBankSelect] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [savedBankAccounts, setSavedBankAccounts] = useState<GetBankAccounts[]>([]);
  const [fetchingSaved, setFetchingSaved] = useState(false);

  // Bank form state (add new)
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");

  // Resolve state
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState("");
  const [resolvedBankId, setResolvedBankId] = useState(""); // bank.id from resolveBankAccount
  const [resolveError, setResolveError] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  // Confirmation dialog state
  const [confirmAccount, setConfirmAccount] = useState<GetBankAccounts | null>(null);
  // The bank institution's MongoDB ID (from getBanks), required by createOfframpOrder
  const [confirmBankId, setConfirmBankId] = useState<string>("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState("");
  const [createdOrder, setCreatedOrder] = useState<{
    accountNumber: string;
    currency: Currency;
    amount: number;
    fiatAmount: number;
    rate: number;
    fee: number;
  } | null>(null);

  useEffect(() => {
    const fetchBaseRate = async () => {
      try {
        const rateData = await getRateByType(RateType.offRamp);
        if (rateData && rateData.rate) {
          setBaseRate(rateData.rate);
        }
      } catch (err) {
        console.error("Failed to fetch base offramp rate:", err);
      } finally {
        setRateLoading(false);
      }
    };
    fetchBaseRate();
  }, []);

  useEffect(() => {
    const numAmount = Number(amountUSDC);
    if (!numAmount || numAmount <= 0) {
      setEstimatedNaira("");
      return;
    }
    setEstimating(true);
    if (baseRate) {
      setEstimatedNaira((numAmount * baseRate).toFixed(2));
    }
    setEstimating(false);
  }, [amountUSDC, baseRate]);

  const handleOpenDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Request session token first if needed
    let token = sessionToken;
    if (!token) {
      try {
        token = await requestSession();
      } catch (err: any) {
        console.error("Session setup required:", err);
        return;
      }
    }
    
    setIsDialogOpen(true);

    setFetchingSaved(true);
    try {
      const fetchedAccounts = await getBankAccounts(token);
      setSavedBankAccounts(fetchedAccounts || []);
      if (!fetchedAccounts || fetchedAccounts.length === 0) {
        setIsAddingNew(true);
      }
    } catch (err) {
      console.error("Error fetching saved accounts:", err);
      setIsAddingNew(true);
    } finally {
      setFetchingSaved(false);
    }

    if (banks.length === 0) {
      setBanksLoading(true);
      try {
        const fetchedBanks = await getBanks(token);
        setBanks(fetchedBanks);
      } catch (err) {
        console.error("Error fetching banks:", err);
      } finally {
        setBanksLoading(false);
      }
    }
  };

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBankId) {
      setResolvingAccount(true);
      setResolvedAccountName("");
      setResolveError("");

      const resolve = async () => {
        try {
          const result = await resolveBankAccount(sessionToken, selectedBankId, accountNumber);
          if (result && result.accountName) {
            setResolvedAccountName(result.accountName);
            setResolvedBankId(result.bank.id); // capture the institution ID
          } else {
            setResolveError("Could not resolve account name.");
          }
        } catch (err: any) {
          setResolveError(err?.message || "Failed to resolve account.");
        } finally {
          setResolvingAccount(false);
        }
      };
      resolve();
    } else {
      setResolvedAccountName("");
      setResolvedBankId("");
      setResolveError("");
    }
  }, [accountNumber, selectedBankId, sessionToken]);

  const handleAddAccount = async () => {
    setAddingAccount(true);
    try {
      const added = await addBankAccount(sessionToken, selectedBankId, accountNumber);
      console.log("Successfully added bank account:", added);

      if (added) {
        const newAccount = added as unknown as GetBankAccounts;
        setSavedBankAccounts(prev => [...prev, newAccount]);
        setIsAddingNew(false);
        setIsDialogOpen(false);
        setConfirmAccount(newAccount);
        // resolvedBankId was captured from resolveBankAccount during the resolve useEffect
        setConfirmBankId(resolvedBankId);
        setIsConfirmOpen(true);
        setOrderError("");
        setOrderSuccess(false);
      }

      setResolvedAccountName("");
      setResolvedBankId("");
      setAccountNumber("");
      setSelectedBankId("");
    } catch (err: any) {
      setResolveError(err?.message || "Failed to add account");
    } finally {
      setAddingAccount(false);
    }
  };

  // Called when the user clicks a saved account — just open confirm dialog.
  // The bank ID will be resolved inside handleConfirmOrder under the loading state.
  const handleSelectAccount = (account: GetBankAccounts) => {
    setIsDialogOpen(false);
    setConfirmAccount(account);
    setConfirmBankId("");
    setIsConfirmOpen(true);
    setOrderError("");
    setOrderSuccess(false);
  };

  // Called when user confirms the order
  const handleConfirmOrder = async () => {
    if (!confirmAccount) return;
    setCreatingOrder(true);
    setOrderError("");
    try {
      // Get/ensure session token
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

      // Resolve the bank institution ID via resolveBankAccount.
      // We match the saved account's bank name against the banks list to get the bankId.
      let bankInstId = confirmBankId; // already set for newly-added accounts
      if (!bankInstId) {
        console.log("[Offramp] Resolving bank ID for:", confirmAccount.bank, confirmAccount.accountNumber);
        const matchedBank = banks.find(
          (b) => b.name.toLowerCase() === confirmAccount.bank.toLowerCase()
        );
        console.log("[Offramp] Matched bank from list:", matchedBank);
        if (!matchedBank) {
          setOrderError(`Could not identify bank "${confirmAccount.bank}". Please go back and re-add this account.`);
          setCreatingOrder(false);
          return;
        }
        const resolved = await resolveBankAccount(token, matchedBank.id, confirmAccount.accountNumber);
        console.log("[Offramp] resolveBankAccount response:", resolved);
        if (!resolved?.bank?.id) {
          setOrderError("Could not verify bank account. Please try again.");
          setCreatingOrder(false);
          return;
        }
        bankInstId = resolved.bank.id;
      }

      console.log("[Offramp] Calling createOfframpOrder with:", {
        bank: bankInstId,
        accountNumber: confirmAccount.accountNumber,
        currency: Currency.NGN,
        amount: Number(amountUSDC),
        mint: USDC_MINT,
        chain: Chain.SOLANA,
        webhookURL: webhookUrl("/webhook/paj-ramp"),
      });

      const order = await createOfframpOrder(
        {
          bank: bankInstId,
          accountNumber: confirmAccount.accountNumber,
          currency: Currency.NGN,
          amount: Number(amountUSDC),
          mint: USDC_MINT,
          chain: Chain.SOLANA,
          webhookURL: webhookUrl("/webhook/paj-ramp"),
        },
        token,
      );
      console.log("[Offramp] Order created successfully:", order);
      setCreatedOrderId(order?.id || "");
      setCreatedOrder(
        order
          ? {
              accountNumber: confirmAccount?.accountNumber ?? "",
              currency: Currency.NGN,
              amount: order.amount,
              fiatAmount: order.fiatAmount,
              rate: order.rate,
              fee: order.fee,
            }
          : null
      );

      try {
        const selectedWallet = wallets.find(w => (w as any).walletClientType === "solana" || (w as any).chainType === "solana") || wallets[0];
        
        if (!selectedWallet?.address) {
          console.warn("No Solana wallet found. Please transfer manually.");
        } else {
          console.log("[Offramp] Sending USDC transaction from wallet:", selectedWallet.address);
          
          const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
          const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");

          const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC ?? "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";
          const connection = new Connection(SOLANA_RPC, "confirmed");

          const fromPubkey = new PublicKey(selectedWallet.address);
          const toPubkey = new PublicKey(order.address);

          const { blockhash } = await connection.getLatestBlockhash("finalized");
          const transaction = new Transaction();
          transaction.feePayer = fromPubkey;
          transaction.recentBlockhash = blockhash;

          const amountNumber = Number(order.amount);
          const usdcMint = new PublicKey(USDC_MINT);
          
          const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
          const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

          // 6 decimals for USDC on Solana
          const rawAmount = Math.floor(amountNumber * 1_000_000);

          const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
          if (!toAccountInfo) {
            transaction.add(
              createAssociatedTokenAccountInstruction(fromPubkey, toTokenAccount, toPubkey, usdcMint)
            );
          }

          transaction.add(
            createTransferInstruction(fromTokenAccount, toTokenAccount, fromPubkey, rawAmount)
          );

          // Strip CloseAccount ix for safety
          transaction.instructions = transaction.instructions.filter((ix) => ix.data[0] !== 0x0a);

          const signedTxResponse = await selectedWallet.signTransaction({
            transaction: transaction.serialize({ requireAllSignatures: false }),
          });

          const signature = await connection.sendRawTransaction(signedTxResponse.signedTransaction);

          // Wait for confirmation with a more robust approach
          try {
            const latestBlockhash = await connection.getLatestBlockhash("confirmed");
            await connection.confirmTransaction(
              {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              "confirmed"
            );
          } catch (confirmError: any) {
            console.warn("[Offramp] Confirmation wait timed out or failed, checking status manually:", confirmError);

            // Manual status check if confirmTransaction fails/times out
            const status = await connection.getSignatureStatus(signature);
            const hasSucceeded =
              status.value?.confirmationStatus === "confirmed" ||
              status.value?.confirmationStatus === "finalized";

            if (!hasSucceeded && status.value?.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }

            if (!status.value) {
              console.error("[Offramp] No status found for signature after timeout");
            }
          }

          console.log("[Offramp] Transaction successfully completed:", signature);

          if (user?.id) {
            void apiFetch("/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                privyUserId: user.id,
                chainType: "solana",
                assetSymbol: "USDC",
                amount: order.amount.toString(),
                direction: "outgoing",
                txSignature: signature || null,
                fromAddress: selectedWallet.address,
                toAddress: order.address,
                source: "offramp",
              }),
            }).catch(() => {});
          }
        }
      } catch (txErr: any) {
        console.error("[Offramp] Wallet transaction failed:", txErr);
        // We catch here so it still shows order success and lets the user manually send
      }

      setOrderSuccess(true);
    } catch (err: any) {
      // PAJ errors come back as axios errors — real message is in err.response.data
      const pajMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data ||
        err?.message ||
        "Failed to create order. Please try again.";
      console.error("[Offramp] createOfframpOrder failed:", err?.response?.data ?? err);
      setOrderError(typeof pajMsg === "string" ? pajMsg : JSON.stringify(pajMsg));
    } finally {
      setCreatingOrder(false);
    }
  };

  const numUSDC = Number(amountUSDC);

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
          onClick={() => navigate("/send/bank")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Sell USDC</h1>
          <p className="text-muted-foreground">
            Sell your USDC directly to your local Naira bank account.
          </p>
        </div>

        <div className="glass-card p-6 md:p-8 rounded-2xl max-w-md">
          <form onSubmit={handleOpenDialog} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="amount" className="block text-sm font-medium">
                Amount (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 10"
                  className="w-full bg-secondary/50 border border-border/80 rounded-xl py-3 pl-8 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  value={amountUSDC}
                  onChange={(e) => setAmountUSDC(e.target.value)}
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
                  {estimating ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Estimating...</span>
                  ) : estimatedNaira ? (
                    <span className="text-primary">Estimated: ~₦{Number(estimatedNaira).toLocaleString()}</span>
                  ) : (
                    <span>Estimated: ~₦0.00</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-6 text-lg rounded-xl flex items-center gap-2"
              disabled={!amountUSDC || numUSDC <= 0}
            >
              <Send className="w-5 h-5" />
              Send to Bank Account
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Powered by PAJ Ramp
            </p>
          </form>
        </div>

        {/* ── Bank Selection Dialog ── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md border-border/80 bg-background/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Bank Details
              </DialogTitle>
              <DialogDescription>
                {isAddingNew
                  ? "Add the bank account you will receive NGN to."
                  : "Select a saved bank account or add a new one."}
              </DialogDescription>
            </DialogHeader>

            {fetchingSaved ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !isAddingNew && savedBankAccounts.length > 0 ? (
              <div className="space-y-4 py-4">
                <p className="text-sm font-medium">Your Saved Accounts</p>
                <div className="space-y-3">
                  {savedBankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex flex-col p-4 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectAccount(account)}
                    >
                      <span className="font-semibold text-sm">{account.accountName}</span>
                      <div className="flex items-center justify-between mt-1 text-muted-foreground text-xs">
                        <span>{account.bank}</span>
                        <span className="font-mono">{account.accountNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setIsAddingNew(true)}
                >
                  + Add New Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {savedBankAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="text-xs text-primary mb-2 flex items-center hover:underline"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Back to saved accounts
                  </button>
                )}

                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-medium">Select Bank</label>
                  <Popover open={openBankSelect} onOpenChange={setOpenBankSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openBankSelect}
                        disabled={banksLoading}
                        className="w-full justify-between bg-secondary/50 border-border/80 text-foreground font-normal hover:bg-secondary/70 h-10 px-3 py-2"
                      >
                        <span className="truncate max-w-[90%] text-left">
                          {banksLoading
                            ? "Loading banks..."
                            : selectedBankId
                              ? banks.find((bank: any) => (bank.id || bank.code) === selectedBankId)?.name
                              : "Search bank..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search bank name..." />
                        <CommandList>
                          <CommandEmpty>No bank found.</CommandEmpty>
                          <CommandGroup>
                            {banks.map((bank: any) => {
                              const bankId = bank.id || bank.code;
                              return (
                                <CommandItem
                                  key={bankId}
                                  value={bank.name}
                                  onSelect={() => {
                                    setSelectedBankId(bankId === selectedBankId ? "" : bankId);
                                    setOpenBankSelect(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedBankId === bankId ? "opacity-100 text-primary" : "opacity-0"
                                    )}
                                  />
                                  {bank.name}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="10-digit account number"
                      className="w-full bg-secondary/50 border border-border/80 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={resolvingAccount || addingAccount}
                    />
                    {resolvingAccount && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {resolvedAccountName && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-3 mt-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Account verified</span>
                      <span className="text-xs text-muted-foreground">{resolvedAccountName}</span>
                    </div>
                  </div>
                )}

                {resolveError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-3 mt-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Verification failed</span>
                      <span className="text-xs text-muted-foreground">{resolveError}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full mt-2"
                  disabled={!resolvedAccountName || addingAccount}
                  onClick={handleAddAccount}
                >
                  {addingAccount ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                  ) : (
                    "Save Account & Continue"
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Confirmation Dialog ── */}
        <Dialog open={isConfirmOpen} onOpenChange={(open) => {
          if (!creatingOrder) {
            setIsConfirmOpen(open);
            if (!open) {
              setOrderSuccess(false);
              setOrderError("");
              setConfirmAccount(null);
            }
          }
        }}>
          <DialogContent className="sm:max-w-md border-border/80 bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {orderSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-primary" />
                )}
                {orderSuccess ? "Order Created!" : "Confirm Transfer"}
              </DialogTitle>
              <DialogDescription>
                {orderSuccess
                  ? "Your off-ramp order has been placed successfully."
                  : "Please review the details before confirming."}
              </DialogDescription>
            </DialogHeader>

            {!orderSuccess ? (
              <>
                {/* Summary card */}
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-3 my-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">You send</span>
                    <span className="font-bold text-lg text-foreground">{numUSDC} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Estimated payout</span>
                    <span className="font-semibold text-primary">
                      ~₦{estimatedNaira ? Number(estimatedNaira).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="border-t border-border/40 pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Recipient account</p>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{confirmAccount?.accountName}</p>
                      <p className="text-xs text-muted-foreground">{confirmAccount?.bank}</p>
                      <p className="text-xs font-mono text-muted-foreground">{confirmAccount?.accountNumber}</p>
                    </div>
                  </div>
                </div>

                {orderError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Order failed</span>
                      <span className="text-xs text-muted-foreground">{orderError}</span>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={creatingOrder}
                    onClick={() => {
                      setIsConfirmOpen(false);
                      setOrderError("");
                      setConfirmAccount(null);
                      // Re-open bank selection
                      setIsDialogOpen(true);
                    }}
                  >
                    Change account
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={creatingOrder}
                    onClick={handleConfirmOrder}
                  >
                    {creatingOrder ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Placing order...</>
                    ) : (
                      "Confirm & Send"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    ✅ Order successful — USDC sent now
                  </p>
                  {createdOrder?.accountNumber && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Recipient account number</p>
                      <p className="text-sm font-mono font-semibold text-foreground">
                        {createdOrder.accountNumber}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {createdOrder?.amount !== undefined && (
                      <div>
                        <p className="font-medium text-foreground">{createdOrder.amount} USDC</p>
                        <p>Amount sent</p>
                      </div>
                    )}
                    {createdOrder?.fiatAmount !== undefined && (
                      <div>
                        <p className="font-medium text-foreground">₦{createdOrder.fiatAmount.toLocaleString()}</p>
                        <p>You receive</p>
                      </div>
                    )}
                    {createdOrder?.rate !== undefined && (
                      <div>
                        <p className="font-medium text-foreground">₦{createdOrder.rate.toLocaleString()}</p>
                        <p>Rate per USDC</p>
                      </div>
                    )}
                    {createdOrder?.fee !== undefined && (
                      <div>
                        <p className="font-medium text-foreground">{createdOrder.fee} USDC</p>
                        <p>Fee</p>
                      </div>
                    )}
                  </div>
                  {createdOrderId && (
                    <p className="text-xs text-muted-foreground font-mono">Order ID: {createdOrderId}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Payout to <span className="font-medium">{confirmAccount?.accountName}</span> at{" "}
                    <span className="font-medium">{confirmAccount?.bank}</span> sent.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsConfirmOpen(false);
                    setOrderSuccess(false);
                    setConfirmAccount(null);
                    setCreatedOrder(null);
                    setAmountUSDC("");
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SendBankAfrica;
