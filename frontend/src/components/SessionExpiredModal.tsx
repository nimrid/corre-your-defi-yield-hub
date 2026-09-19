import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect?: () => void;
}

export function SessionExpiredModal({
  open,
  onOpenChange,
  onReconnect,
}: SessionExpiredModalProps) {
  const { login, authenticated } = usePrivy();

  const handleReconnect = () => {
    // Dismiss the dialog first so Radix releases its focus trap and body locks,
    // allowing the Privy login modal to receive pointer and keyboard events.
    onOpenChange(false);

    setTimeout(() => {
      try {
        login();
        onReconnect?.();
      } catch (error) {
        console.error("[SessionExpiredModal] Reconnect failed:", error);
      }
    }, 50);
  };

  // Auto-close when authenticated
  useEffect(() => {
    if (authenticated && open) {
      onOpenChange(false);
    }
  }, [authenticated, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <span className="text-2xl font-bold">C</span>
          </div>
          <DialogTitle className="text-center">Session Timed Out</DialogTitle>
          <DialogDescription className="text-center">
            For your security, you were automatically logged out after 1 hour of inactivity. Log back in to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleReconnect}
          >
            Reconnect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
