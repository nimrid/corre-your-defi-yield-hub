import { initializeSDK, Environment, initiate, verify } from 'paj_ramp';

const email = process.env.USER_EMAIL;
const apiKey = process.env.BUSINESS_API_KEY;
const otp = process.env.OTP;

if (!email || !apiKey) {
    console.error("Missing USER_EMAIL or BUSINESS_API_KEY in .env");
    process.exit(1);
}

// Ensure email is valid
if (email === "example@gmail.com") {
    console.warn("WARNING: Using example@gmail.com. Please update USER_EMAIL in your .env file with your actual Privy email if you want to receive the OTP.");
}

async function main() {
    initializeSDK(Environment.Production);

    // If OTP is the default one or empty, initiate session. Otherwise verify.
    if (!otp || otp === "1112" || otp.trim() === "") {
        console.log(`Initiating session for ${email}...`);
        try {
            const initiated = await initiate(email, apiKey);
            console.log("✅ Session initiated successfully!");
            console.log("Response:", initiated);
            console.log("\n==================== Next Steps ====================");
            console.log("1. Check your email for the OTP.");
            console.log("2. Open frontend/.env and update the OTP value.");
            console.log("3. Reply here letting me know you've updated it, and I will verify the session.");
            console.log("====================================================\n");
        } catch (e: any) {
            console.error("Failed to initiate:", e?.message || e);
        }
    } else {
        console.log(`Verifying session for ${email} with OTP: ${otp}...`);
        try {
            const verified = await verify(
                email,
                otp,
                {
                    uuid: 'device-uuid',
                    device: 'Desktop',
                    os: 'MacOS',
                    browser: 'Chrome',
                    ip: '127.0.0.1',
                },
                apiKey
            );
            console.log("✅ Session verified successfully!");
            console.log("Response Token:");
            console.log(verified);
        } catch (e: any) {
            console.error("Failed to verify:", e?.message || e);
        }
    }
}

main();
