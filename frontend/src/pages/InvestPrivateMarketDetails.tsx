import Navigation from "@/components/Navigation";
import { ArrowLeft, MapPin, TrendingUp, Calendar, Shield, CheckCircle2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const InvestPrivateMarketDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const { wallets } = useWallets();
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const currentMonth = new Date().getMonth();
  const currentCycle = Math.floor(currentMonth / 3) + 1;

  const handleBuyIn = async () => {
    if (Number(amount) < 10) {
      toast({ title: "Error", description: "Minimum amount is $10", variant: "destructive" });
      return;
    }
    const wallet = wallets[0];
    if (!wallet) {
      toast({ title: "Error", description: "Please connect your wallet first." });
      return;
    }
    try {
      setLoading(true);
      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");

      // The address from .env
      const destinationAddress = import.meta.env.VITE_WALLET_ADDRESS || "GjG2o2KXikkfEDBz1a8NAtgXrzXuYvK5GAMxnGXvFHzU";
      const usdcMintAddress = import.meta.env.VITE_TOKEN_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      const connection = new Connection(import.meta.env.VITE_SOLANA_RPC || "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", "confirmed");
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(destinationAddress);
      const usdcMint = new PublicKey(usdcMintAddress);

      const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

      const rawAmount = Math.floor(Number(amount) * 1_000_000);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey });

      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      if (!toAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(fromPubkey, toTokenAccount, toPubkey, usdcMint)
        );
      }

      transaction.add(
        createTransferInstruction(fromTokenAccount, toTokenAccount, fromPubkey, rawAmount)
      );

      const signedTx = await wallet.signTransaction({ transaction: transaction.serialize({ requireAllSignatures: false }) });
      const signature = await connection.sendRawTransaction(signedTx.signedTransaction);
      
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      toast({ title: "Success", description: `Successfully deposited $${amount}.` });
      setBuyDialogOpen(false);
      setAmount("");
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (id !== "nilep-palm-oil") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Investment not found.</p>
          <Button variant="outline" onClick={() => navigate("/invest/private-market")}>
            Back to Private Market
          </Button>
        </div>
      </div>
    );
  }

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
            <span>Back to listings</span>
          </button>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-8">
          <div className="space-y-4 border-b border-border/60 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3" />
              Agriculture • Private Equity
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Palm Oil Mill Operations
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                Cross River State, Nigeria
              </span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary">
                  N
                </div>
                Managed by Nilep
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* ROI Structure */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                ROI Structure
              </h3>
              <ul className="space-y-3">
                <li className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                  <div className="font-medium">Tier 1: 10% Fixed ROI</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    For capital injections below ₦1,500,000
                  </div>
                </li>
                <li className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                  <div className="font-medium">Tier 2: 15% Fixed ROI</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    For capital injections of ₦1,500,000 and above
                  </div>
                </li>
              </ul>
            </div>

            {/* Cycles and Tenors */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Cycles & Tenors
              </h3>
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Quarterly Cycles:</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className={currentCycle === 1 ? "text-primary font-semibold" : ""}>• Q1: Jan 1 – Mar 31 {currentCycle === 1 && "(Current Cycle)"}</li>
                    <li className={currentCycle === 2 ? "text-primary font-semibold" : ""}>• Q2: Apr 1 – Jun 30 {currentCycle === 2 && "(Current Cycle)"}</li>
                    <li className={currentCycle === 3 ? "text-primary font-semibold" : ""}>• Q3: Jul 1 – Sep 30 {currentCycle === 3 && "(Current Cycle)"}</li>
                    <li className={currentCycle === 4 ? "text-primary font-semibold" : ""}>• Q4: Oct 1 – Dec 31 {currentCycle === 4 && "(Current Cycle)"}</li>
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Available Tenors:</div>
                  <div className="text-sm text-muted-foreground">
                    3 months, 6 months, 9 months, or 12 months.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Guarantees */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Guarantees & Security
            </h3>
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-primary">Capital Guarantee</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    Nilep guarantees the full return of principal at the close of each agreed investment cycle, irrespective of operational performance.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-primary">ROI Guarantee</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    The ROI rates are fixed obligations. Nilep guarantees payment of the applicable ROI at cycle close.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full font-semibold px-8"
              onClick={() => setBuyDialogOpen(true)}
            >
              Buy In
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto rounded-full font-semibold px-8"
              onClick={() => {
                 window.open('https://corre.com/docs/nilep-agreement', '_blank');
                 toast({
                    description: "Link to full agreement coming soon."
                 });
              }}
            >
              Read Full Agreement
            </Button>
          </div>

        </div>
      </main>

      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy In</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Deposit Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
              />
              <p className="text-xs text-muted-foreground">Minimum deposit is $10 USDC</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBuyDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleBuyIn} disabled={loading || !amount}>
              {loading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestPrivateMarketDetails;
