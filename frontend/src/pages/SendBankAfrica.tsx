import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BanknoteIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

interface FonbnkCurrency {
  currencyType: string;
  currencyCode: string;
  currencyDetails?: {
    countryIsoCode?: string;
  };
  paymentChannels: {
    type: string;
    transferTypes: string[];
    isDepositAllowed: boolean;
    isPayoutAllowed: boolean;
    carriers?: { code: string; name: string }[];
  }[];
}

interface FonbnkOrderLimits {
  deposit: { min: number; max: number; minUsd: number; maxUsd: number };
  payout: { min: number; max: number; minUsd: number; maxUsd: number };
}

interface FonbnkQuoteSide {
  paymentChannel: string;
  currencyType: string;
  currencyCode: string;
  cashout?: {
    amountBeforeFees: number;
    amountAfterFees: number;
    amountBeforeFeesUsd: number;
    amountAfterFeesUsd: number;
    totalChargedFees: number;
    totalChargedFeesUsd: number;
    exchangeRate: number;
    exchangeRateAfterFees: number;
  };
}

interface FonbnkQuoteResponse {
  quoteId: string;
  quoteExpiresAt: string;
  deposit: FonbnkQuoteSide;
  payout: FonbnkQuoteSide;
}

interface WidgetSignatureResponse {
  source: string;
  signature: string;
}

const SendBankAfrica = () => {
  const { user } = usePrivy();
  const navigate = useNavigate();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState<string | undefined>(undefined);
  const [payoutChannelType, setPayoutChannelType] = useState<string | undefined>(undefined);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Currencies state
  const [currencies, setCurrencies] = useState<FonbnkCurrency[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);

  // Order limits state
  const [orderLimits, setOrderLimits] = useState<FonbnkOrderLimits | null>(null);
  const [orderLimitsLoading, setOrderLimitsLoading] = useState(false);
  const [orderLimitsError, setOrderLimitsError] = useState<string | null>(null);

  // Quote state
  const [quote, setQuote] = useState<FonbnkQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Widget state
  const [widgetConfig, setWidgetConfig] = useState<WidgetSignatureResponse | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [loadingWidget, setLoadingWidget] = useState(false);

  const handleOpenDialog = () => {
    setPayoutCurrency(undefined);
    setAmount("");
    setPayoutChannelType(undefined);
    setError(null);
    setOrderLimits(null);
    setOrderLimitsError(null);
    setQuote(null);
    setQuoteError(null);
    setDialogOpen(true);
  };

  // Fetch currencies on dialog open
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        setCurrenciesLoading(true);
        setCurrenciesError(null);

        const res = await fetch(`${API_BASE_URL}/fonbnk/africa/currencies`);
        if (!res.ok) {
          throw new Error("Failed to load payout currencies");
        }

        const data: FonbnkCurrency[] = await res.json();
        setCurrencies(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setCurrenciesError(err?.message ?? "Unable to load currencies");
      } finally {
        setCurrenciesLoading(false);
      }
    };

    if (dialogOpen && !currencies.length && !currenciesLoading) {
      void fetchCurrencies();
    }
  }, [dialogOpen, currencies.length, currenciesLoading]);

  // Fetch order limits when currency and channel are selected
  useEffect(() => {
    const fetchOrderLimits = async () => {
      if (!payoutCurrency || !payoutChannelType) return;

      const currency = currencies.find(
        (c) => c.currencyType === "fiat" && c.currencyCode === payoutCurrency,
      );
      if (!currency) return;

      try {
        setOrderLimitsLoading(true);
        setOrderLimitsError(null);

        const countryIso = currency.currencyDetails?.countryIsoCode;

        const params = new URLSearchParams({
          depositPaymentChannel: "crypto",
          depositCurrencyType: "crypto",
          depositCurrencyCode: "SOLANA_USDC",
          payoutPaymentChannel: payoutChannelType,
          payoutCurrencyType: "fiat",
          payoutCurrencyCode: currency.currencyCode,
        });

        if (countryIso) {
          params.append("payoutCountryIsoCode", countryIso);
        }

        const res = await fetch(
          `${API_BASE_URL}/fonbnk/africa/order-limits?${params.toString()}`
        );
        if (!res.ok) {
          throw new Error("Failed to load order limits");
        }

        const data: FonbnkOrderLimits = await res.json();
        setOrderLimits(data);
      } catch (err: any) {
        setOrderLimits(null);
        setOrderLimitsError(err?.message ?? "Unable to load order limits");
      } finally {
        setOrderLimitsLoading(false);
      }
    };

    if (dialogOpen && payoutCurrency && payoutChannelType) {
      void fetchOrderLimits();
    }
  }, [dialogOpen, payoutCurrency, payoutChannelType, currencies]);

  // Fetch quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!payoutCurrency || !payoutChannelType) return;
      const numericAmount = Number(amount);
      if (!numericAmount || numericAmount <= 0) return;

      const currency = currencies.find(
        (c) => c.currencyType === "fiat" && c.currencyCode === payoutCurrency,
      );
      if (!currency) return;

      try {
        setQuoteLoading(true);
        setQuoteError(null);

        const countryIso = currency.currencyDetails?.countryIsoCode;

        const body = {
          deposit: {
            paymentChannel: "crypto",
            currencyType: "crypto",
            currencyCode: "SOLANA_USDC",
            amount: numericAmount,
          },
          payout: {
            paymentChannel: payoutChannelType,
            currencyType: "fiat",
            currencyCode: currency.currencyCode,
            countryIsoCode: countryIso,
          },
        };

        const res = await fetch(`${API_BASE_URL}/fonbnk/africa/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch quote");
        }

        const data: FonbnkQuoteResponse = await res.json();
        setQuote(data);
      } catch (err: any) {
        setQuote(null);
        setQuoteError(err?.message ?? "Unable to load quote");
      } finally {
        setQuoteLoading(false);
      }
    };

    if (dialogOpen && payoutCurrency && payoutChannelType) {
      void fetchQuote();
    }
  }, [dialogOpen, payoutCurrency, payoutChannelType, amount, currencies]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount in USDC.");
      return;
    }
    if (!payoutCurrency) {
      setError("Select a payout currency.");
      return;
    }
    if (!payoutChannelType) {
      setError("Select a payout method.");
      return;
    }

    const currency = currencies.find(
      (c) => c.currencyType === "fiat" && c.currencyCode === payoutCurrency,
    );
    const countryIso = currency?.currencyDetails?.countryIsoCode;

    const email = (user as any)?.email?.address as string | undefined;
    if (!email) {
      setError("We need your email from Privy to check KYC status.");
      return;
    }
    if (!countryIso) {
      setError("Unable to determine country for KYC. Please try a different payout currency.");
      return;
    }

    try {
      setSubmitting(true);

      const params = new URLSearchParams({
        userEmail: email,
        countryIsoCode: countryIso,
      });

      const res = await fetch(`${API_BASE_URL}/fonbnk/africa/user-kyc?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to check KYC status");
      }

      const data = (await res.json()) as {
        reachedKycLimit: boolean;
        currentKycStatus?: string;
      };

      if (data.reachedKycLimit) {
        setError(
          "You have reached your KYC limit for this operation. Please upgrade your KYC with the provider."
        );
        setSubmitting(false);
        return;
      }

      if (data.currentKycStatus && data.currentKycStatus !== "approved") {
        setError(
          "Your KYC is not approved yet. Please complete verification with the provider before off-ramping."
        );
        setSubmitting(false);
        return;
      }

      setDialogOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Unable to verify KYC status. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrepareWidget = async () => {
    setWidgetError(null);

    if (!amount || Number(amount) <= 0) {
      setWidgetError("Enter a valid USDC amount.");
      return;
    }
    if (!payoutCurrency) {
      setWidgetError("Select a payout currency.");
      return;
    }

    const selectedCurrency = currencies.find(
      (c) => c.currencyType === "fiat" && c.currencyCode === payoutCurrency,
    );
    const countryIso = selectedCurrency?.currencyDetails?.countryIsoCode;
    if (!countryIso) {
      setWidgetError("Unable to determine country for the selected currency.");
      return;
    }

    const solAddress = (user as any)?.wallet?.address as string | undefined;
    if (!solAddress) {
      setWidgetError("We couldn't find your Solana wallet address.");
      return;
    }

    try {
      setLoadingWidget(true);
      const res = await fetch(`${API_BASE_URL}/fonbnk/africa/widget-signature`);
      if (!res.ok) {
        throw new Error("Failed to get widget signature");
      }
      const data = (await res.json()) as WidgetSignatureResponse;
      setWidgetConfig(data);

      const url = new URL("https://sandbox-pay.fonbnk.com/offramp");
      url.searchParams.set("source", data.source);
      url.searchParams.set("signature", data.signature);
      url.searchParams.set("network", "SOLANA");
      url.searchParams.set("asset", "USDC");
      url.searchParams.set("address", solAddress);
      url.searchParams.set("amount", amount);
      url.searchParams.set("currency", "local");
      url.searchParams.set("countryIsoCode", countryIso);

      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setWidgetError(err?.message ?? "Unable to prepare widget configuration.");
    } finally {
      setLoadingWidget(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate("/send/bank")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to send to bank</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              African bank off-ramp
            </h1>
            <p className="text-sm text-muted-foreground">
              Cash out your USDC to bank accounts across African countries.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Choose your preferred method to off-ramp:
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                onClick={handleOpenDialog}
              >
                <BanknoteIcon className="w-4 h-4" />
                Direct bank transfer
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                onClick={handlePrepareWidget}
              >
                Fonbnk widget
              </Button>
            </div>
          </div>
        </div>

        {/* Direct Bank Transfer Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg w-full">
            <DialogHeader>
              <DialogTitle>
                Send crypto to fiat
                <span className="block text-xs font-normal text-muted-foreground mt-1">
                  African bank payout
                </span>
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount to send (USDC SOL)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-secondary/50 border-border/50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  You&apos;re sending SOLANA_USDC. We&apos;ll convert it to your selected
                  fiat currency via an off-ramp provider.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Payout currency</Label>
                  <Select
                    value={payoutCurrency}
                    onValueChange={(val) => {
                      setPayoutCurrency(val);
                      setPayoutChannelType(undefined);
                      setQuote(null);
                      setQuoteError(null);
                    }}
                  >
                    <SelectTrigger id="currency" className="bg-secondary/50 border-border/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {currenciesLoading && (
                        <SelectItem value="loading" disabled>
                          Loading...
                        </SelectItem>
                      )}
                      {!currenciesLoading && currenciesError && (
                        <SelectItem value="error" disabled>
                          Unable to load currencies
                        </SelectItem>
                      )}
                      {!currenciesLoading &&
                        !currenciesError &&
                        currencies
                          .filter((c) => c.currencyType === "fiat")
                          .map((c) => (
                            <SelectItem key={c.currencyCode} value={c.currencyCode}>
                              {c.currencyCode}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {payoutCurrency && (
                <div className="space-y-3 rounded-xl bg-secondary/40 border border-border/60 p-3 text-xs sm:text-sm">
                  {(() => {
                    const currency = currencies.find(
                      (c) => c.currencyType === "fiat" && c.currencyCode === payoutCurrency,
                    );
                    if (!currency) return null;
                    const payoutChannels = currency.paymentChannels.filter(
                      (ch) => ch.isPayoutAllowed,
                    );

                    return (
                      <>
                        <div className="space-y-2">
                          <p className="font-medium">Payout methods</p>
                          {payoutChannels.length ? (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {payoutChannels.map((ch) => (
                                <button
                                  key={ch.type}
                                  type="button"
                                  onClick={() => setPayoutChannelType(ch.type)}
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                                    payoutChannelType === ch.type
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background/60 text-muted-foreground border-border/60 hover:border-primary/60"
                                  }`}
                                >
                                  {ch.type.replace("_", " ")}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              No payout methods are available for this currency.
                            </p>
                          )}
                        </div>

                        {payoutChannelType === "mobile_money" && (
                          <div className="space-y-1">
                            <p className="font-medium">Supported mobile money carriers</p>
                            {payoutChannels
                              .find((ch) => ch.type === "mobile_money")
                              ?.carriers?.length ? (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {payoutChannels
                                  .find((ch) => ch.type === "mobile_money")
                                  ?.carriers?.map((carrier) => (
                                    <span
                                      key={carrier.code}
                                      className="inline-flex items-center rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground border border-border/60"
                                    >
                                      {carrier.name}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                Mobile money available for this currency.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="pt-2 border-t border-border/40 mt-2">
                          <p className="font-medium mb-1">Payout limits</p>
                          {orderLimitsLoading ? (
                            <p className="text-[11px] text-muted-foreground">
                              Fetching limits...
                            </p>
                          ) : orderLimitsError ? (
                            <p className="text-[11px] text-red-500">{orderLimitsError}</p>
                          ) : orderLimits ? (
                            <div className="space-y-1 text-[11px] text-muted-foreground">
                              <p>
                                Min payout: <span className="font-semibold">{orderLimits.payout.min}</span>{" "}
                                {currency.currencyCode} (~{orderLimits.payout.minUsd} USD)
                              </p>
                              <p>
                                Max payout: <span className="font-semibold">{orderLimits.payout.max}</span>{" "}
                                {currency.currencyCode} (~{orderLimits.payout.maxUsd} USD)
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Limits will appear here once available.
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border/40 mt-2">
                          <p className="font-medium mb-1">Quote</p>
                          {!payoutChannelType ? (
                            <p className="text-[11px] text-muted-foreground">
                              Select a payout method to see an estimated quote.
                            </p>
                          ) : quoteLoading ? (
                            <p className="text-[11px] text-muted-foreground">Fetching quote...</p>
                          ) : quoteError ? (
                            <p className="text-[11px] text-red-500">{quoteError}</p>
                          ) : quote ? (
                            <div className="space-y-1 text-[11px] text-muted-foreground">
                              {quote.payout.cashout && (
                                <p>
                                  You&apos;ll receive approximately{' '}
                                  <span className="font-semibold">
                                    {quote.payout.cashout.amountAfterFees.toFixed(2)}{' '}
                                    {currency.currencyCode}
                                  </span>{' '}
                                  after local fees.
                                </p>
                              )}
                              {quote.payout.cashout && (
                                <p>
                                  Fees: ~
                                  <span className="font-semibold">
                                    {quote.payout.cashout.totalChargedFees.toFixed(2)}{' '}
                                    {currency.currencyCode}
                                  </span>
                                </p>
                              )}
                              {quote.payout.cashout && (
                                <p>
                                  Implied rate: ~
                                  <span className="font-semibold">
                                    {quote.payout.cashout.exchangeRate.toFixed(2)}{' '}
                                    {currency.currencyCode}
                                  </span>{' '}
                                  per 1 USDC.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Enter an amount and select a payout method to see an estimated
                              quote.
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <div className="pt-2 flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  <BanknoteIcon className="w-4 h-4" />
                  {submitting ? "Preparing off-ramp..." : "Continue to off-ramp"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  This is a preview flow. Actual settlement will be handled via a
                  regulated off-ramp provider.
                </p>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Widget Configuration Section */}
        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Fonbnk widget setup
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure the USDC amount and payout currency for the Fonbnk Pay Widget.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="widget-amount">Amount to send (USDC)</Label>
              <Input
                id="widget-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="bg-secondary/50 border-border/50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="widget-currency">Payout currency</Label>
              <Select
                value={payoutCurrency}
                onValueChange={(val) => setPayoutCurrency(val)}
              >
                <SelectTrigger
                  id="widget-currency"
                  className="bg-secondary/50 border-border/50"
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {currenciesLoading && (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  )}
                  {!currenciesLoading && currenciesError && (
                    <SelectItem value="error" disabled>
                      Unable to load currencies
                    </SelectItem>
                  )}
                  {!currenciesLoading &&
                    !currenciesError &&
                    currencies
                      .filter((c) => c.currencyType === "fiat")
                      .map((c) => (
                        <SelectItem key={c.currencyCode} value={c.currencyCode}>
                          {c.currencyCode}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            {widgetError && (
              <p className="text-sm text-red-500">{widgetError}</p>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <Button
                type="button"
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-60"
                disabled={loadingWidget}
                onClick={handlePrepareWidget}
              >
                {loadingWidget ? "Preparing widget..." : "Open Fonbnk widget"}
              </Button>

              {widgetConfig && (
                <div className="text-xs sm:text-sm rounded-xl border border-border/60 bg-secondary/40 p-3 space-y-1 text-left break-all">
                  <p>
                    <span className="font-medium">source:</span>{" "}
                    {widgetConfig.source}
                  </p>
                  <p>
                    <span className="font-medium">signature:</span>{" "}
                    {widgetConfig.signature}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SendBankAfrica;
