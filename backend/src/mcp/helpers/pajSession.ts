import { getBanks, resolveBankAccount, addBankAccount, getBankAccounts, createOfframpOrder, Currency, Chain } from "paj_ramp";
import { pool } from "../../db.js";

export async function getPajSessionToken(privyUserId: string, email?: string): Promise<string> {
    const result = await pool.query(
        "SELECT session_token FROM paj_user_sessions WHERE privy_user_id = $1 AND (is_active = true OR is_active IS NULL)",
        [privyUserId]
    );

    if (result.rows.length > 0 && result.rows[0].session_token) {
        return result.rows[0].session_token;
    }

    if (process.env.PAJ_SESSION_TOKEN) {
        return process.env.PAJ_SESSION_TOKEN;
    }

    throw new Error("PAJ session setup required. Please authenticate your PAJ session.");
}

export async function fetchSupportedBanks(privyUserId: string): Promise<any[]> {
    const token = await getPajSessionToken(privyUserId);
    return getBanks(token);
}

export async function resolveBank(privyUserId: string, bankId: string, accountNumber: string): Promise<any> {
    const token = await getPajSessionToken(privyUserId);
    return resolveBankAccount(token, bankId, accountNumber);
}

export async function saveBank(privyUserId: string, bankId: string, accountNumber: string): Promise<any> {
    const token = await getPajSessionToken(privyUserId);
    return addBankAccount(token, bankId, accountNumber);
}

export async function fetchSavedBankAccounts(privyUserId: string): Promise<any[]> {
    const token = await getPajSessionToken(privyUserId);
    return getBankAccounts(token);
}

export async function createOfframp(privyUserId: string, params: { bank: string; accountNumber: string; currency: any; amount: number; mint: string; chain: any; webhookURL: string; businessUSDCFee: number }, sessionToken?: string): Promise<any> {
    const token = sessionToken || await getPajSessionToken(privyUserId);
    try {
        return await createOfframpOrder(params, token);
    } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes("Session is invalid or expired") || msg.includes("Unauthorized")) {
            throw new Error("Your Corre bank integration session has expired. Please go to the Corre App settings and link your bank account again to get a fresh PAJ session.");
        }
        throw new Error(`PAJ API Error: ${msg}`);
    }
}
