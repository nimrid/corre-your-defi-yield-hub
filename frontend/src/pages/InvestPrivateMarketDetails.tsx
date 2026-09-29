import React, { useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { findRwaToken } from "@/config/rwaTokens";
import { RwaTokenDetailsView } from "@/components/rwa/RwaTokenDetailsView";
import { LegacyVentureDetailsView } from "@/components/rwa/LegacyVentureDetailsView";

/**
 * InvestPrivateMarketDetails
 *
 * Top-level route controller for private market asset details.
 * Delegates to:
 * - `RwaTokenDetailsView` for on-chain Solana Token-2022 RWAs (GetEquity)
 * - `LegacyVentureDetailsView` for off-chain private ventures (e.g. Palm Oil Mill)
 */
const InvestPrivateMarketDetails: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search || window.location.search),
    [location.search]
  );
  const initialAmount = searchParams.get("amount") || "";

  const rwaConfig = useMemo(() => (id ? findRwaToken(id) : undefined), [id]);

  if (rwaConfig) {
    return (
      <RwaTokenDetailsView
        rwaConfig={rwaConfig}
        initialAmount={initialAmount}
      />
    );
  }

  return (
    <LegacyVentureDetailsView
      ventureId={id}
      initialAmount={initialAmount}
    />
  );
};

export default InvestPrivateMarketDetails;
