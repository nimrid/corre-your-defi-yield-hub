/**
 * PAJ Ramp Session Manager
 * 
 * Manages user-specific PAJ Ramp sessions with automatic initialization and verification.
 * Each user gets their own session token stored in localStorage.
 */

import { initializeSDK, Environment, initiate, verify, DeviceSignature } from 'paj_ramp';
import { apiFetch } from '@/services/apiClient';

// Initialize SDK once globally
try {
    initializeSDK(Environment.Production);
} catch (e) {
    console.error("PAJ SDK initialization error:", e);
}

const BUSINESS_API_KEY = import.meta.env.VITE_BUSINESS_API_KEY;

if (!BUSINESS_API_KEY) {
    console.error("⚠️ VITE_BUSINESS_API_KEY is not configured in .env");
}

// Storage keys
const STORAGE_PREFIX = 'paj_session_';
const OTP_PREFIX = 'paj_otp_';
const OTP_PENDING_PREFIX = 'paj_otp_pending_';

interface StoredSession {
    email: string;
    token: string;
    expiresAt: string;
    isActive: string;
}

export interface PajRemoteSession {
    privyUserId: string;
    email: string | null;
    sessionToken: string | null;
    expiresAt: string | null;
    isActive: boolean | null;
    otp: string | null;
    otpPending: boolean;
    updatedAt: string;
}

/**
 * Get storage key for a specific user email
 */
function getStorageKey(email: string): string {
    return `${STORAGE_PREFIX}${email}`;
}

function getOtpStorageKey(email: string): string {
    return `${OTP_PREFIX}${email}`;
}

function getOtpPendingStorageKey(email: string): string {
    return `${OTP_PENDING_PREFIX}${email}`;
}

export function getEnvSessionToken(): string | null {
    return import.meta.env.VITE_PAJ_RAMP_SESSION_TOKEN || null;
}

export async function getRemoteSession(privyUserId: string | undefined): Promise<PajRemoteSession | null> {
    if (!privyUserId) return null;

    try {
        const res = await apiFetch(`/paj-session/${encodeURIComponent(privyUserId)}`);
        if (!res.ok) {
            return null;
        }

        const data = (await res.json()) as PajRemoteSession | null;
        return data;
    } catch (error) {
        console.error('Error fetching remote PAJ session:', error);
        return null;
    }
}

export async function upsertRemoteSession(
    privyUserId: string,
    payload: {
        email?: string | null;
        sessionToken?: string | null;
        expiresAt?: string | null;
        isActive?: boolean | null;
        otp?: string | null;
        otpPending?: boolean;
        clearOtp?: boolean;
    },
): Promise<PajRemoteSession | null> {
    try {
        const res = await apiFetch(`/paj-session/${encodeURIComponent(privyUserId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            return null;
        }

        const data = (await res.json()) as PajRemoteSession;
        return data;
    } catch (error) {
        console.error('Error upserting remote PAJ session:', error);
        return null;
    }
}

export function getStoredOtp(email: string | undefined): string | null {
    if (!email) return null;
    try {
        return localStorage.getItem(getOtpStorageKey(email));
    } catch (error) {
        console.error('Error reading stored OTP:', error);
        return null;
    }
}

export function storeOtp(email: string, otp: string): void {
    try {
        localStorage.setItem(getOtpStorageKey(email), otp);
    } catch (error) {
        console.error('Error storing OTP:', error);
    }
}

export function clearStoredOtp(email: string): void {
    try {
        localStorage.removeItem(getOtpStorageKey(email));
    } catch (error) {
        console.error('Error clearing stored OTP:', error);
    }
}

export function getOtpPending(email: string | undefined): boolean {
    if (!email) return false;
    try {
        return localStorage.getItem(getOtpPendingStorageKey(email)) === 'true';
    } catch (error) {
        console.error('Error reading OTP pending flag:', error);
        return false;
    }
}

export function setOtpPending(email: string, pending: boolean): void {
    try {
        localStorage.setItem(getOtpPendingStorageKey(email), pending ? 'true' : 'false');
    } catch (error) {
        console.error('Error storing OTP pending flag:', error);
    }
}

export function clearOtpPending(email: string): void {
    try {
        localStorage.removeItem(getOtpPendingStorageKey(email));
    } catch (error) {
        console.error('Error clearing OTP pending flag:', error);
    }
}

/**
 * Get stored session for a user
 */
export function getStoredSession(email: string): StoredSession | null {
    try {
        const stored = localStorage.getItem(getStorageKey(email));
        if (!stored) return null;
        
        const session: StoredSession = JSON.parse(stored);
        
        // Check if session is expired
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
            console.log("Session expired for", email);
            clearSession(email);
            return null;
        }
        
        return session;
    } catch (error) {
        console.error("Error reading stored session:", error);
        return null;
    }
}

/**
 * Store session for a user
 */
export function storeSession(email: string, sessionData: Omit<StoredSession, 'email'>): void {
    try {
        const session: StoredSession = {
            email,
            ...sessionData
        };
        localStorage.setItem(getStorageKey(email), JSON.stringify(session));
        console.log("✅ Session stored for", email);
    } catch (error) {
        console.error("Error storing session:", error);
    }
}

/**
 * Clear session for a user
 */
export function clearSession(email: string): void {
    try {
        localStorage.removeItem(getStorageKey(email));
        console.log("Session cleared for", email);
    } catch (error) {
        console.error("Error clearing session:", error);
    }
}

/**
 * Get valid session token for a user, or null if not available
 */
export function getSessionToken(email: string | undefined): string | null {
    if (!email) return null;

    const envToken = getEnvSessionToken();
    if (envToken) return envToken;
    
    const session = getStoredSession(email);
    return session?.token || null;
}

/**
 * Initiate a new PAJ session for a user
 * Sends OTP to user's email
 */
export async function initiateSession(email: string): Promise<void> {
    if (!email) {
        throw new Error("Email is required to initiate PAJ session");
    }
    
    if (!BUSINESS_API_KEY) {
        throw new Error("VITE_BUSINESS_API_KEY is not configured");
    }

    console.log(`📧 Initiating PAJ session for ${email}...`);
    
    try {
        const response = await initiate(email, BUSINESS_API_KEY);
        console.log("✅ OTP sent to:", response.email || email);

        setOtpPending(email, true);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ Failed to initiate PAJ session:", message);
        throw new Error(message || "Failed to send OTP. Please try again.");
    }
}

/**
 * Verify PAJ session with OTP and store the token
 */
export async function verifySession(email: string, otp: string): Promise<string> {
    if (!email) {
        throw new Error("Email is required to verify PAJ session");
    }
    
    if (!otp || otp.trim().length < 4) {
        throw new Error("Please enter a valid OTP code");
    }
    
    if (!BUSINESS_API_KEY) {
        throw new Error("VITE_BUSINESS_API_KEY is not configured");
    }

    // Generate device signature
    const device: DeviceSignature = {
        uuid: crypto.randomUUID(),
        device: 'Web',
        os: navigator.platform || 'Unknown',
        browser: getBrowserName(),
        ip: '0.0.0.0', // Will be detected server-side
    };

    console.log(`🔐 Verifying PAJ session for ${email}...`);
    
    try {
        const response = await verify(email, otp, device, BUSINESS_API_KEY);
        
        // Store the session
        storeSession(email, {
            token: response.token,
            expiresAt: response.expiresAt,
            isActive: response.isActive,
        });
        
        console.log("✅ Session verified and stored for", email);

        clearStoredOtp(email);
        clearOtpPending(email);
        return response.token;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ Failed to verify PAJ session:", message);
        throw new Error(message || "Invalid OTP. Please try again.");
    }
}

/**
 * Check if user needs to complete session setup
 */
export function needsSessionSetup(email: string | undefined): boolean {
    if (!email) return true;
    return getSessionToken(email) === null;
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown';
}
