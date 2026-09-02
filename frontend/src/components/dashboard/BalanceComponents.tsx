import { useState, useEffect, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";

export const Balance = ({ wallet, address }: { wallet: any, address?: string }) => {
  const { user } = usePrivy();
  const [balance, setBalance] = useState<string>("-");

  const walletChain = wallet?.chainType || wallet?.walletClientType || wallet?.chain;

  useEffect(() => {
    let isMounted = true;

    const fetchBalance = async () => {
      try {
        // For Solana wallets, fetch USDC SPL token balance directly via RPC.
        if (
          walletChain === "solana"
        ) {
          if (!address) {
            if (isMounted) setBalance("-");
            return;
          }

          const { Connection, PublicKey } = await import("@solana/web3.js");
          const rpcUrl = (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim();
          const connection = new Connection(rpcUrl, "confirmed");
          const owner = new PublicKey(address);
          const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Solana USDC
          const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
          const ui = resp.value.reduce((sum, acc: any) => {
            const amt =
              acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          if (isMounted) {
            setBalance(
              `${Number(ui).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })} USDC`,
            );
          }
          return;
        }

        // For non-Solana wallets, use Privy's wallet balance API via wallet_id.
        if (!user) {
          if (isMounted) setBalance("-");
          return;
        }

        const linkedWallets = (user.linkedAccounts ?? []).filter(
          (a: any) => a.type === "wallet" || a.type === "smart_wallet",
        );

        const matching = linkedWallets.find((a: any) => {
          const accountAddress = (a.address ?? a.walletAddress) as string | undefined;
          return (
            accountAddress &&
            accountAddress.toLowerCase() === (address ?? "").toLowerCase()
          );
        });

        const walletId = (matching as any)?.walletId ?? (matching as any)?.wallet_id;

        if (!walletId) {
          if (isMounted) setBalance("-");
          return;
        }

        const res = await fetch(
          `https://api.privy.io/v1/wallets/${walletId}/balance`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          if (isMounted) setBalance("-");
          return;
        }

        const data: any = await res.json();

        if (!Array.isArray(data.balances) || !data.balances.length) {
          if (isMounted) setBalance("0");
          return;
        }

        const primary = data.balances[0];
        const symbol = primary.asset?.toUpperCase?.() ?? primary.asset ?? "";
        const raw = primary.raw_value ?? "0";
        const decimals =
          typeof primary.decimals === "number" ? primary.decimals : 18;

        const asNumber = Number(raw) / 10 ** decimals;
        if (isMounted) {
          setBalance(
            `${asNumber.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })} ${symbol}`,
          );
        }
      } catch {
        if (isMounted) setBalance("-");
      }
    };

    fetchBalance();

    return () => {
      isMounted = false;
    };
  }, [user?.id, address, walletChain]);

  return <p className="text-lg font-bold">{balance}</p>;
};

export const TotalBalance = ({ wallets }: { wallets: any[] }) => {
  const [total, setTotal] = useState<string>("-");

  // Create a stable key from the wallets array to avoid re-fetching on reference changes
  const walletsKey = useMemo(() => {
    return wallets
      .map((w) => `${(w as any)?.address || ""}:${(w as any)?.chainType || (w as any)?.walletClientType || (w as any)?.chain || ""}`)
      .join("|");
  }, [wallets]);

  useEffect(() => {
    let isMounted = true;

    const fetchTotal = async () => {
      try {
        if (!wallets.length) {
          if (isMounted) setTotal("-");
          return;
        }

        let sum = 0;

        for (const wallet of wallets) {
          const address = (wallet as any).address as string | undefined;
          if (!address) continue;

          if (
            wallet.chainType === 'solana' ||
            (wallet as any).walletClientType === 'solana' ||
            (wallet as any).chain === 'solana'
          ) {
            const { Connection, PublicKey } = await import('@solana/web3.js');
            const rpcUrl = (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim();
            const connection = new Connection(rpcUrl, 'confirmed');
            const owner = new PublicKey(address);
            const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
            const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
            const ui = resp.value.reduce((innerSum, acc: any) => {
              const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return innerSum + Number(amt || 0);
            }, 0);
            sum += ui || 0;
          } else if (wallet.chainType === 'ethereum') {
            const { ethers } = await import('ethers');
            const provider = new ethers.JsonRpcProvider((wallet as any).rpcUrl ?? undefined);
            const chainId: number | undefined = wallet.chainId;
            const USDC_BY_CHAIN: Record<number, string> = {
              8453: '0x833589fCD6edb6E08f4c7C32D4f71b54bDA02913',
            };
            const usdcAddress = chainId ? USDC_BY_CHAIN[chainId] : undefined;
            if (!usdcAddress) continue;
            const abi = [
              'function balanceOf(address) view returns (uint256)',
              'function decimals() view returns (uint8)'
            ];
            const usdc = new ethers.Contract(usdcAddress, abi, provider);
            const [raw, decimals] = await Promise.all([
              usdc.balanceOf(address),
              usdc.decimals(),
            ]);
            const formatted = ethers.formatUnits(raw, decimals);
            sum += Number(formatted) || 0;
          }
        }

        if (isMounted) {
          setTotal(`${sum.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`);
        }
      } catch {
        if (isMounted) setTotal("-");
      }
    };

    fetchTotal();

    return () => {
      isMounted = false;
    };
  }, [walletsKey]);

  return (
    <div className="flex items-center gap-3">
      <p className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/50">{total}</p>
    </div>
  );
};
