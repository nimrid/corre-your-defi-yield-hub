import Navigation from "@/components/Navigation";
import { ArrowLeft, MapPin, TrendingUp, Calendar, Shield, CheckCircle2, UploadCloud } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const InvestPrivateMarketDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = usePrivy();

  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const [totalInvested, setTotalInvested] = useState<number>(0);
  const targetAmount = 50000000; // 50,000,000 NGN

  useEffect(() => {
    if (id === "nilep-palm-oil") {
      fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/investments/private-market/${id}/stats`)
        .then(res => res.json())
        .then(data => {
          if (typeof data.totalInvested === "number") {
            setTotalInvested(data.totalInvested);
          }
        })
        .catch(err => console.error("Error fetching stats:", err));
    }
  }, [id]);

  const currentMonth = new Date().getMonth();
  const currentCycle = Math.floor(currentMonth / 3) + 1;

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
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
          receiptImageUrl: uploadedImageUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit investment");

      toast({ title: "Success", description: "Investment submitted successfully! We will verify and allocate your share." });
      setAmount("");
      setUploadedImageUrl(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
              Agriculture • Private Investment
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

          {/* Milestone Tracker */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <h3 className="font-semibold text-sm">Funding Progress</h3>
              <span className="text-xs text-muted-foreground">Target: ₦50,000,000</span>
            </div>
            <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-in-out" 
                style={{ width: `${Math.min(100, (totalInvested / targetAmount) * 100)}%` }}
              />
            </div>
            <p className="text-xs font-medium text-right text-primary">
              ₦{totalInvested.toLocaleString()} Raised
            </p>
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
                    3 months.
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
          </div>

          <div className="space-y-3 pt-6 border-t border-border/60">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              Upload Documentation
            </h3>
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/50">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amount">Amount Sent (NGN) <span className="text-xs text-muted-foreground font-normal ml-1">(Min. 5000)</span></Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="Enter the amount you transferred"
                    value={amount}
                    min="5000"
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="document-upload">Image Upload (Max 2MB)</Label>
                  <Input 
                    id="document-upload" 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={uploadingImage}
                    className="cursor-pointer file:text-primary file:font-semibold file:bg-primary/10 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-4 hover:file:bg-primary/20 transition-colors"
                  />
                  {uploadingImage && <p className="text-sm text-muted-foreground animate-pulse">Uploading to Cloudinary...</p>}
                </div>
                {uploadedImageUrl && (
                  <div className="mt-4 space-y-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-green-500 bg-green-500/10 px-3 py-1.5 rounded-md">
                      <CheckCircle2 className="w-4 h-4" />
                      Upload Successful!
                    </div>
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
                <span className="font-semibold text-sm text-right">Edidiong Emmanuel Uwemedimo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Minimum Transfer Amount:</span>
                <span className="font-semibold text-sm text-right">5000 NGN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Account Number:</span>
                <span className="font-semibold text-sm">8168616904</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Bank:</span>
                <span className="font-semibold text-sm">Moniepoint MFB</span>
              </div>
            </div>
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
              <p className="text-sm font-medium text-primary">
                When done, please upload your transfer receipt using the "Upload Documentation" section on this page. Once confirmed, a share of the investment will be allocated to you and displayed.
              </p>
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
