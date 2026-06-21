import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";

export const Balance = ({ wallet, address }: { wallet: any, address?: string }) => {
  const { user } = usePrivy();
  const [balance, setBalance] = useState<string>("-");

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        // For Solana wallets, fetch USDC SPL token balance directly via RPC.
        if (
          wallet.chainType === "solana" ||
          (wallet as any).walletClientType === "solana" ||
          (wallet as any).chain === "solana"
        ) {
          if (!address) {
            setBalance("-");
            return;
          }

          const { Connection, PublicKey } = await import("@solana/web3.js");
          const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", "confirmed");
          const owner = new PublicKey(address);
          const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Solana USDC
          const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
          console.log("[DEBUG] Solana USDC RPC response for", address.toString(), ":", resp);
          const ui = resp.value.reduce((sum, acc: any) => {
            const amt =
              acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          setBalance(
            `${Number(ui).toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })} USDC`,
          );
          return;
        }

        // For non-Solana wallets, use Privy's wallet balance API via wallet_id.
        if (!user) {
          setBalance("-");
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
          setBalance("-");
          return;
        }

        const res = await fetch(
          `https://api.privy.io/v1/wallets/${walletId}/balance`,
          {
            method: "GET",
            headers: {
              // NOTE: For production, you should proxy this through your backend instead of calling Privy directly from the client.
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          setBalance("-");
          return;
        }

        const data: any = await res.json();

        if (!Array.isArray(data.balances) || !data.balances.length) {
          setBalance("0");
          return;
        }

        const primary = data.balances[0];
        const symbol = primary.asset?.toUpperCase?.() ?? primary.asset ?? "";
        const raw = primary.raw_value ?? "0";
        const decimals =
          typeof primary.decimals === "number" ? primary.decimals : 18;

        const asNumber = Number(raw) / 10 ** decimals;
        setBalance(
          `${asNumber.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })} ${symbol}`,
        );
      } catch {
        setBalance("-");
      }
    };

    fetchBalance();
  }, [user, wallet, address]);

  return <p className="text-lg font-bold">{balance}</p>;
};

export const TotalBalance = ({ wallets }: { wallets: any[] }) => {
  const [total, setTotal] = useState<string>("-");

  useEffect(() => {
    const fetchTotal = async () => {
      try {
        if (!wallets.length) {
          setTotal("-");
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
            const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", 'confirmed');
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

        setTotal(`${sum.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`);
      } catch {
        setTotal("-");
      }
    };

    fetchTotal();
  }, [wallets]);

  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      <p className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/50">{total}</p>
    </div>
  );
};
