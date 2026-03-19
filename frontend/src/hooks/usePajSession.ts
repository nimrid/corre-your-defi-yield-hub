/**
 * usePajSession Hook
 * 
 * Custom hook for managing PAJ Ramp sessions.
 * Automatically checks for existing sessions and provides methods to set up new ones.
 */

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getEnvSessionToken, getOtpPending, getRemoteSession, getSessionToken, needsSessionSetup } from '@/services/pajSessionManager';

export function usePajSession() {
    const { user } = usePrivy();
    const privyUserId = user?.id;
    const userEmail = user?.email?.address;

    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [needsSetup, setNeedsSetup] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Check for existing session on mount and when email changes
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!userEmail) {
                setSessionToken(null);
                setNeedsSetup(true);
                return;
            }

            const envToken = getEnvSessionToken();
            if (envToken) {
                if (!cancelled) {
                    setSessionToken(envToken);
                    setNeedsSetup(false);
                }
                return;
            }

            const localToken = getSessionToken(userEmail);
            const localOtpPending = getOtpPending(userEmail);

            const remote = await getRemoteSession(privyUserId);
            const remoteToken = remote?.sessionToken ?? null;
            const remoteOtpPending = Boolean(remote?.otpPending);

            const token = remoteToken || localToken;
            if (!cancelled) {
                setSessionToken(token);
                setNeedsSetup(!token && needsSessionSetup(userEmail) && !remoteOtpPending && !localOtpPending);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [userEmail, privyUserId]);

    /**
     * Request session token - opens modal if setup needed
     */
    const requestSession = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!userEmail) {
                reject(new Error("User email not available. Please log in."));
                return;
            }

            const envToken = getEnvSessionToken();
            if (envToken) {
                setSessionToken(envToken);
                resolve(envToken);
                return;
            }

            // If we already have a token, return it
            if (sessionToken) {
                resolve(sessionToken);
                return;
            }

            (async () => {
                const remote = await getRemoteSession(privyUserId);
                const remoteToken = remote?.sessionToken ?? null;
                if (remoteToken) {
                    setSessionToken(remoteToken);
                    setNeedsSetup(false);
                    resolve(remoteToken);
                    return;
                }

                const localOtpPending = getOtpPending(userEmail);
                const remoteOtpPending = Boolean(remote?.otpPending);
                if (!localOtpPending && !remoteOtpPending) {
                    setNeedsSetup(true);
                }

                // Otherwise, open the setup modal
                setIsModalOpen(true);

                // Store the resolve/reject for later use
                (window as any).__pajSessionPromise = { resolve, reject };
            })().catch((err) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });
        });
    };

    /**
     * Handle successful session setup
     */
    const handleSessionSuccess = (token: string) => {
        setSessionToken(token);
        setNeedsSetup(false);
        setIsModalOpen(false);

        // Resolve the promise if it exists
        if ((window as any).__pajSessionPromise) {
            (window as any).__pajSessionPromise.resolve(token);
            delete (window as any).__pajSessionPromise;
        }
    };

    /**
     * Handle modal close without completion
     */
    const handleModalClose = () => {
        setIsModalOpen(false);

        // Reject the promise if it exists
        if ((window as any).__pajSessionPromise) {
            (window as any).__pajSessionPromise.reject(new Error("Session setup cancelled"));
            delete (window as any).__pajSessionPromise;
        }
    };

    return {
        sessionToken,
        needsSetup,
        userEmail,
        isModalOpen,
        requestSession,
        handleSessionSuccess,
        handleModalClose,
    };
}
