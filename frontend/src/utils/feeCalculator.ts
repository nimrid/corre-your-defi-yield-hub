/**
 * Platform Fee Configuration & Calculator for PAJ Ramp operations.
 *
 * Hybrid Model:
 * Fee = min(MAX_CAP, max(MIN_FEE, grossUSDC * MARKUP_PERCENT))
 */

export const MIN_PLATFORM_FEE_USDC = 0.50;
export const MARKUP_PERCENT = 0.01; // 1.0%
export const MAX_PLATFORM_FEE_USDC = 25.00;

/**
 * Calculates the platform fee in USDC based on gross USDC transaction volume.
 *
 * @param grossUSDC - The transaction volume in USDC
 * @returns The platform fee rounded to 2 decimal places
 */
export function calculatePlatformFee(grossUSDC: number): number {
  if (!grossUSDC || isNaN(grossUSDC) || grossUSDC <= 0) {
    return MIN_PLATFORM_FEE_USDC;
  }
  const variableFee = grossUSDC * MARKUP_PERCENT;
  const withFloor = Math.max(MIN_PLATFORM_FEE_USDC, variableFee);
  const capped = Math.min(withFloor, MAX_PLATFORM_FEE_USDC);
  return Number(capped.toFixed(2));
}
