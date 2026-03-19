/**
 * PAJ Session Setup Modal
 * 
 * Modal component that handles PAJ Ramp session initialization and OTP verification.
 * Automatically shown when a user needs to set up their session.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, KeyRound, CheckCircle2 } from "lucide-react";
import { initiateSession, verifySession } from "@/services/pajSessionManager";
import { usePrivy } from "@privy-io/react-auth";
import { getOtpPending, getRemoteSession, getStoredOtp, storeOtp, clearStoredOtp, upsertRemoteSession } from "@/services/pajSessionManager";

interface PajSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (token: string) => void;
    userEmail: string;
}

export function PajSessionModal({ isOpen, onClose, onSuccess, userEmail }: PajSessionModalProps) {
    const { user } = usePrivy();
    const privyUserId = user?.id;

    const [step, setStep] = useState<"initiate" | "verify" | "success">("initiate");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(0);

    // Reset state when modal opens
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!isOpen) return;

            const localOtpPending = getOtpPending(userEmail);
            const localStoredOtp = getStoredOtp(userEmail);

            let remoteOtpPending = false;
            let remoteOtp: string | null = null;

            if (privyUserId) {
                const remote = await getRemoteSession(privyUserId);
                remoteOtpPending = Boolean(remote?.otpPending);
                remoteOtp = remote?.otp ?? null;
            }

            if (cancelled) return;

            setStep(remoteOtpPending || localOtpPending ? "verify" : "initiate");
            setOtp(remoteOtp || localStoredOtp || "");
            setError("");
            setCountdown(0);
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (!userEmail) return;
        if (otp) {
            storeOtp(userEmail, otp);
        } else {
            clearStoredOtp(userEmail);
        }
    }, [otp, userEmail, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (!privyUserId) return;

        const handle = setTimeout(() => {
            upsertRemoteSession(privyUserId, {
                email: userEmail,
                otp: otp || null,
            });
        }, 300);

        return () => clearTimeout(handle);
    }, [otp, isOpen, privyUserId, userEmail]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleInitiate = async () => {
        setLoading(true);
        setError("");

        try {
            await initiateSession(userEmail);
            setStep("verify");
            setCountdown(60); // 60 second cooldown before resend

            if (privyUserId) {
                await upsertRemoteSession(privyUserId, {
                    email: userEmail,
                    otpPending: true,
                });
            }
        } catch (err: any) {
            setError(err?.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!otp || otp.trim().length < 4) {
            setError("Please enter a valid OTP code");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const token = await verifySession(userEmail, otp);
            setStep("success");

            if (privyUserId) {
                await upsertRemoteSession(privyUserId, {
                    email: userEmail,
                    sessionToken: token,
                    otpPending: false,
                    clearOtp: true,
                });
            }
            
            // Auto-close and trigger success after a brief delay
            setTimeout(() => {
                onSuccess(token);
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err?.message || "Invalid OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = () => {
        setOtp("");
        setError("");
        handleInitiate();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {step === "initiate" && "Setup PAJ Ramp Session"}
                        {step === "verify" && "Enter Verification Code"}
                        {step === "success" && "Session Verified!"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "initiate" && `We'll send a verification code to ${userEmail}`}
                        {step === "verify" && "Check your email for the verification code"}
                        {step === "success" && "You can now use PAJ Ramp features"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === "initiate" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                                <Mail className="w-5 h-5 text-primary" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Email Address</p>
                                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                                </div>
                            </div>

                            <Button 
                                onClick={handleInitiate} 
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4 mr-2" />
                                        Send Verification Code
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {step === "verify" && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="otp" className="text-sm font-medium flex items-center gap-2">
                                    <KeyRound className="w-4 h-4" />
                                    Verification Code
                                </label>
                                <input
                                    id="otp"
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter 4-6 digit code"
                                    className="w-full px-4 py-3 border border-border rounded-lg text-center text-lg tracking-widest font-mono text-black focus:outline-none focus:ring-2 focus:ring-primary"
                                    maxLength={6}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && otp.length >= 4) {
                                            handleVerify();
                                        }
                                    }}
                                />
                            </div>

                            <Button 
                                onClick={handleVerify} 
                                disabled={loading || otp.length < 4}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify Code"
                                )}
                            </Button>

                            <Button 
                                onClick={handleResend}
                                disabled={countdown > 0 || loading}
                                variant="outline"
                                className="w-full"
                            >
                                {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                            </Button>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold">Verification Successful!</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your session is now active
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
