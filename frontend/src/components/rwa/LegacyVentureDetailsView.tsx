import React, { useState, useEffect } from "react";
import { ArrowLeft, MapPin, UploadCloud, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface InvestmentHistoryItem {
  id: string;
  investmentId: string;
  amount: number | string;
  status: string;
  createdAt: string;
  expectedShares?: number | string;
}

interface LegacyVentureDetailsViewProps {
  ventureId?: string;
  initialAmount?: string;
}

export const LegacyVentureDetailsView: React.FC<LegacyVentureDetailsViewProps> = ({
  ventureId = "nilep-palm-oil",
  initialAmount = "",
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = usePrivy();

  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [amount, setAmount] = useState(initialAmount);
  const [submitting, setSubmitting] = useState(false);
  const [calcAmount, setCalcAmount] = useState("5000");
  const calcAmountNum = Number(calcAmount) || 0;
  const roiRate = 0.15;
  const expectedProfit = calcAmountNum * roiRate;
  const expectedTotal = calcAmountNum + expectedProfit;

  const [, setSelectedFile] = useState<File | null>(null);
  const [, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<InvestmentHistoryItem[]>([]);
  const [totalInvested, setTotalInvested] = useState<number>(0);

  useEffect(() => {
    if (initialAmount) {
      setAmount(initialAmount);
      setBuyDialogOpen(true);
    }
  }, [initialAmount]);

  useEffect(() => {
    if (ventureId === "nilep-palm-oil") {
      fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
        }/investments/private-market/${ventureId}/stats`
      )
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.totalInvested === "number") {
            setTotalInvested(data.totalInvested);
          }
        })
        .catch((err) => console.error("Error fetching stats:", err));
    }
  }, [ventureId]);

  useEffect(() => {
    if (user?.id && ventureId === "nilep-palm-oil") {
      fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
        }/investments/private-market/history/${user.id}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setHistory(
              data.filter(
                (item: InvestmentHistoryItem) => item.investmentId === ventureId
              )
            );
          }
        })
        .catch((err) => console.error("Error fetching history:", err));
    }
  }, [user?.id, ventureId, submitting]);

  const handleImageUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "Corre_image"
      );

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "Corre"
        }/image/upload`,
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
      toast({
        title: "Error",
        description: "Minimum amount is 5000 NGN.",
        variant: "destructive",
      });
      return;
    }
    if (!uploadedImageUrl) {
      toast({
        title: "Error",
        description: "Please upload your receipt first.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
        }/investments/private-market`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId: user.id,
            investmentId: ventureId,
            amount,
            receiptImageUrl: uploadedImageUrl,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit investment");

      toast({
        title: "Success",
        description:
          "Investment submitted successfully! We will verify and allocate your share.",
      });
      setUploadedImageUrl(null);
      setSelectedFile(null);
      setAmount("");
    } catch (error: unknown) {
      console.error(error);
      const msg =
        error instanceof Error ? error.message : "Failed to submit investment";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
            <span>Back to African stocks</span>
          </button>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Palm Oil Mill Operations
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Cross River State, Nigeria &bull; Provider:
              Nilep
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-border/60">
            <div>
              <div className="text-xs text-muted-foreground">Expected ROI</div>
              <div className="text-lg font-semibold text-primary">10% - 15%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cycle</div>
              <div className="text-lg font-semibold">
                Q{Math.floor(new Date().getMonth() / 3) + 1}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Target Amount</div>
              <div className="text-lg font-semibold">₦2,000,000</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Invested</div>
              <div className="text-lg font-semibold text-primary">
                ₦{totalInvested.toLocaleString()}
              </div>
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
                <div className="text-xs text-muted-foreground">
                  Est. Profit (up to 15%)
                </div>
                <div className="text-base font-semibold text-emerald-500">
                  +₦{expectedProfit.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Payout</div>
                <div className="text-base font-semibold text-foreground">
                  ₦{expectedTotal.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              className="w-full rounded-full"
              onClick={() => setBuyDialogOpen(true)}
            >
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
                  <div
                    key={tx.id}
                    className="bg-secondary/30 rounded-xl p-4 border border-border/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4"
                  >
                    <div>
                      <div className="font-semibold text-lg">
                        ₦{Number(tx.amount).toLocaleString()} NGN
                      </div>
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
                <span className="text-sm text-muted-foreground">
                  Account Name:
                </span>
                <span className="font-semibold text-sm text-right">
                  MAGNIFY MARKETING
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Minimum Transfer Amount:
                </span>
                <span className="font-semibold text-sm text-right">
                  5000 NGN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Account Number:
                </span>
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
