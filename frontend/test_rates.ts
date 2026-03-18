import { initializeSDK, Environment, getRateByType, RateType, getRateByAmount } from 'paj_ramp';

async function test() {
    initializeSDK(Environment.Production);

    try {
        console.log("Fetching exact onramp rate...");
        const rate = await getRateByType(RateType.onRamp);
        console.log("Rate Response:", JSON.stringify(rate, null, 2));
    } catch (e: any) {
        console.log("Rate Error:", e.message || e);
    }

    try {
        console.log("Fetching rate by amount (50000)...");
        const amountRate = await getRateByAmount(50000);
        console.log("Amount Rate Response:", JSON.stringify(amountRate, null, 2));
    } catch (e: any) {
        console.log("Amount Rate Error:", e.message || e);
    }
}
test();
