export const formatApy = (apy?: number | null): string => {
    if (typeof apy !== "number") return "-";
    return `${(apy * 100).toFixed(2)}%`;
};

export interface YieldCalculationResult {
    earnings: string;
    balance: string;
}

export const calculateYieldAmount = (
    amount: string | number,
    months: string | number,
    apy: number
): YieldCalculationResult => {
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
    const parsedMonths = typeof months === "string" ? parseInt(months) || 0 : months;

    const years = parsedMonths / 12;
    // Compound interest formula: A = P(1 + r)^t
    const totalEarnings = parsedAmount * (Math.pow(1 + apy, years) - 1);
    const totalBalance = parsedAmount + totalEarnings;

    return {
        earnings: totalEarnings.toFixed(2),
        balance: totalBalance.toFixed(2),
    };
};
