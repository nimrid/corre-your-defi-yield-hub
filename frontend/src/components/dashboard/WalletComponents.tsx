import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Balance } from "./BalanceComponents";

export const WalletQRDialog = ({ address, label }: { address: string; label: string }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          title="Show QR Code"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex flex-col items-center">
        <DialogHeader className="w-full">
          <DialogTitle className="text-center">{label} QR Code</DialogTitle>
        </DialogHeader>
        <div className="bg-white p-4 rounded-xl mt-4">
          <QRCodeSVG value={address} size={256} level="H" />
        </div>
        <p className="mt-4 font-mono text-xs text-center break-all text-muted-foreground max-w-xs">
          {address}
        </p>
        <Button
          className="mt-4 w-full"
          onClick={() => navigator.clipboard.writeText(address)}
        >
          Copy Address
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export const WalletRow = ({
  wallet,
  chainLabel = "Solana",
  chain,
}: {
  wallet: any;
  chainLabel?: string;
  chain?: "solana" | "arc";
}) => {
  const { toast } = useToast();
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(wallet.address);

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      try {
        if (typeof wallet.getAddress === 'function') {
          const addr = await wallet.getAddress();
          if (mounted && addr) {
            setResolvedAddress(addr);
            return;
          }
        }
      } catch {
        // Ignore resolution error
      }
      try {
        if (mounted && wallet.address) setResolvedAddress(wallet.address);
      } catch {
        // Fallback error
      }
    };
    resolve();
    return () => { mounted = false; };
  }, [wallet]);

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
        duration: 2000,
      });
    }).catch(() => { });
  };

  const clientType =
    wallet.walletClientType === "privy"
      ? "Embedded"
      : wallet.walletClientType || "Embedded";

  return (
    <div className="flex justify-between items-center p-5 rounded-2xl bg-background/40 hover:bg-background/60 border border-primary/5 hover:border-primary/20 transition-all duration-200 group shadow-sm">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
          {clientType} · {chainLabel}
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium truncate max-w-[200px]">
            {resolvedAddress ? truncateAddress(resolvedAddress) : 'Resolving...'}
          </p>
          {resolvedAddress && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleCopy(resolvedAddress)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-all focus:outline-none"
                title="Copy Address"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <WalletQRDialog address={resolvedAddress} label={`${chainLabel} (${clientType})`} />
            </div>
          )}
        </div>
      </div>
      <div className="text-right text-primary">
        <Balance
          wallet={wallet}
          address={resolvedAddress}
          chain={chain || (chainLabel.toLowerCase() === "arc" ? "arc" : "solana")}
        />
      </div>
    </div>
  );
};

export const LinkedWalletRow = ({
  account,
  chainLabel,
  chain,
}: {
  account: any;
  chainLabel?: string;
  chain?: "solana" | "arc";
}) => {
  const { toast } = useToast();
  const address = account.address as string | undefined;

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
        duration: 2000,
      });
    }).catch(() => { });
  };

  return (
    <div className="flex justify-between items-center p-5 rounded-2xl bg-background/40 hover:bg-background/60 border border-border/40 hover:border-primary/20 transition-all duration-200 group shadow-sm">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
          Linked · {chainLabel ?? account.chainType ?? account.chain ?? "Solana"}
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium">
            {address ? truncateAddress(address) : "Unknown address"}
          </p>
          {address && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleCopy(address)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-all focus:outline-none"
                title="Copy Address"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <WalletQRDialog address={address} label={`${chainLabel ?? "Linked"} Wallet`} />
            </div>
          )}
        </div>
      </div>
      <div className="text-right text-primary">
        <Balance
          wallet={account}
          address={address}
          chain={chain || (chainLabel?.toLowerCase() === "arc" ? "arc" : "solana")}
        />
      </div>
    </div>
  );
};
