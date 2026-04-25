import type { Request, Response } from "express";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * Extract the Helius API key from the RPC URL stored in env vars.
 */
function getHeliusApiKey(): string | null {
  const rpcUrl =
    process.env.VITE_HELIUS_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    "";
  const match = rpcUrl.match(/api-key=([a-zA-Z0-9-]+)/);
  return match?.[1] ?? null;
}

interface HeliusTokenTransfer {
  fromTokenAccount: string;
  toTokenAccount: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

interface HeliusEnhancedTx {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  tokenTransfers: HeliusTokenTransfer[];
  description: string;
}

/**
 * GET /transactions/onchain/:walletAddress
 *
 * Fetches on-chain USDC transfer history for a given wallet using
 * the Helius Enhanced Transactions API, and returns only USDC transfers
 * (both incoming and outgoing) formatted for the frontend.
 */
export async function getOnchainTransactions(req: Request, res: Response) {
  const { walletAddress } = req.params;

  if (!walletAddress || walletAddress.length < 32) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  const apiKey = getHeliusApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Helius API key not configured" });
  }

  try {
    // Helius Enhanced Transactions API — fetches parsed transaction history
    const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&type=TRANSFER&limit=50`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error(`Helius API error (${response.status}):`, text);
      return res.status(502).json({ error: "Failed to fetch on-chain transactions" });
    }

    const txList: HeliusEnhancedTx[] = await response.json();

    // Filter to only USDC transfers involving this wallet
    const usdcTransfers = [];

    for (const tx of txList) {
      if (!tx.tokenTransfers?.length) continue;

      for (const transfer of tx.tokenTransfers) {
        if (transfer.mint !== USDC_MINT) continue;

        const isIncoming = transfer.toUserAccount === walletAddress;
        const isOutgoing = transfer.fromUserAccount === walletAddress;

        if (!isIncoming && !isOutgoing) continue;

        usdcTransfers.push({
          id: `onchain-${tx.signature}-${transfer.fromUserAccount}-${transfer.toUserAccount}`,
          chainType: "solana",
          assetSymbol: "USDC",
          amount: transfer.tokenAmount.toString(),
          direction: isIncoming ? "incoming" : "outgoing",
          txSignature: tx.signature,
          fromAddress: transfer.fromUserAccount,
          toAddress: transfer.toUserAccount,
          source: "onchain",
          createdAt: new Date(tx.timestamp * 1000).toISOString(),
        });
      }
    }

    return res.json(usdcTransfers);
  } catch (err) {
    console.error("Error fetching on-chain transactions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
