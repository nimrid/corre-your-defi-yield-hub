import type { Request, Response } from "express";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ARC_USDC_MINT = "0x3600000000000000000000000000000000000000".toLowerCase();

function getArcRpcUrl(): string {
  const rpc = process.env.VITE_ARC_RPC || process.env.ARC_RPC || "";
  return rpc.replace(/^['"]|['"]$/g, "").trim() || "https://arc-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";
}

interface AlchemyTransfer {
  blockNum?: string;
  uniqueId?: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset?: string;
  category: string;
  rawContract?: {
    value?: string;
    address?: string | null;
    decimal?: string;
  };
  metadata?: {
    blockTimestamp?: string;
  };
}

/**
 * Fetch on-chain USDC transfers on Arc (both native external transfers and ERC-20 transfers)
 * using Alchemy asset transfers API.
 */
export async function getArcOnchainTransactions(walletAddress: string, res: Response) {
  try {
    const rpc = getArcRpcUrl();

    // Query both incoming and outgoing transfers via Alchemy asset transfers
    const [incomingRes, outgoingRes] = await Promise.all([
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: walletAddress,
              category: ["external", "erc20"],
              withMetadata: true,
              maxCount: "0x32",
            },
          ],
        }),
      }),
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: walletAddress,
              category: ["external", "erc20"],
              withMetadata: true,
              maxCount: "0x32",
            },
          ],
        }),
      }),
    ]);

    const inData = incomingRes.ok ? await incomingRes.json() : null;
    const outData = outgoingRes.ok ? await outgoingRes.json() : null;

    const inTransfers: AlchemyTransfer[] = inData?.result?.transfers ?? [];
    const outTransfers: AlchemyTransfer[] = outData?.result?.transfers ?? [];

    const formatted = [];
    const seen = new Set<string>();

    for (const t of inTransfers) {
      const isUsdc =
        t.asset === "USDC" ||
        t.rawContract?.address?.toLowerCase() === ARC_USDC_MINT;
      if (!isUsdc) continue;

      const key = `${t.hash}-${t.from}-${t.to}-incoming`;
      if (seen.has(key)) continue;
      seen.add(key);

      formatted.push({
        id: `onchain-arc-${t.uniqueId || t.hash}-in`,
        chainType: "arc",
        assetSymbol: "USDC",
        amount: (t.value ?? 0).toString(),
        direction: "incoming",
        txSignature: t.hash,
        fromAddress: t.from,
        toAddress: t.to,
        source: "onchain",
        createdAt: t.metadata?.blockTimestamp || new Date().toISOString(),
      });
    }

    for (const t of outTransfers) {
      const isUsdc =
        t.asset === "USDC" ||
        t.rawContract?.address?.toLowerCase() === ARC_USDC_MINT;
      if (!isUsdc) continue;

      const key = `${t.hash}-${t.from}-${t.to}-outgoing`;
      if (seen.has(key)) continue;
      seen.add(key);

      formatted.push({
        id: `onchain-arc-${t.uniqueId || t.hash}-out`,
        chainType: "arc",
        assetSymbol: "USDC",
        amount: (t.value ?? 0).toString(),
        direction: "outgoing",
        txSignature: t.hash,
        fromAddress: t.from,
        toAddress: t.to,
        source: "onchain",
        createdAt: t.metadata?.blockTimestamp || new Date().toISOString(),
      });
    }

    formatted.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json(formatted);
  } catch (err) {
    console.error("Error fetching Arc on-chain transactions:", err);
    return res.status(500).json({ error: "Failed to fetch Arc on-chain transactions" });
  }
}

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
 * either Alchemy on Arc or Helius Enhanced Transactions API on Solana,
 * and returns only USDC transfers (both incoming and outgoing) formatted for the frontend.
 */
export async function getOnchainTransactions(req: Request, res: Response) {
  const { walletAddress } = req.params;

  if (!walletAddress) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  // Branch for Arc / EVM addresses (0x...)
  if (walletAddress.startsWith("0x") && walletAddress.length === 42) {
    return getArcOnchainTransactions(walletAddress, res);
  }

  if (walletAddress.length < 32) {
    return res.status(400).json({ error: "Invalid Solana wallet address" });
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
