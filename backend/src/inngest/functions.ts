import { type GetFunctionInput } from "inngest";
import { inngest } from "./client.js";
import { resend } from "../lib/resend.js";
import { pool } from "../db.js";

export const sendWeeklyYieldEmails = inngest.createFunction(
  {
    id: "send-weekly-yield-emails",
    triggers: [{ cron: "0 9 * * 1" }], // Every Monday at 9:00 AM UTC
  },
  async ({ step }: GetFunctionInput<typeof inngest>) => {
    // 1. Fetch current APY from Lulo
    const apy = await step.run("fetch-lulo-apy", async (): Promise<number> => {
      try {
        const apiKey = process.env.LULO_API_KEY ?? "";
        const res = await fetch("https://api.lulo.fi/v1/pool.getPools", {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });
        const data = (await res.json()) as { regular?: { apy?: number } };
        return data?.regular?.apy ?? 5;
      } catch (err) {
        console.error("Failed to fetch APY from Lulo", err);
        return 5; // Fallback APY
      }
    });

    // 2. Query users and grab their Solana Wallet address
    const users = await step.run(
      "fetch-yielding-users",
      async (): Promise<{ id: number; email: string; name: string | null; solana_address: string }[]> => {
        const query = `
          SELECT u.id, u.email, u.name,
            MAX(w.address) AS solana_address
          FROM users u
          JOIN wallets w ON u.id = w.user_id AND w.chain_type = 'solana'
          WHERE u.email IS NOT NULL AND w.address IS NOT NULL
          GROUP BY u.id, u.email, u.name
        `;
        const { rows } = await pool.query<{
          id: number;
          email: string;
          name: string | null;
          solana_address: string;
        }>(query);
        return rows;
      }
    );

    if (users.length === 0) {
      return { message: "No users with Solana wallets found." };
    }

    // 3. Send emails in batches to respect Resend's 100-email/day free tier limit
    const BATCH_SIZE = 80;
    let totalEmailsSent = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      
      const batchSentCount = await step.run(`send-email-batch-${i}`, async (): Promise<number> => {
        let count = 0;
        const apiKey = process.env.LULO_API_KEY ?? "";
        const apyFormatted = (apy * 100).toFixed(2);

        for (const user of batch) {
          try {
            const res = await fetch(`https://api.lulo.fi/v1/account.getAccount?owner=${user.solana_address}`, {
              headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
              },
            });
            
            if (!res.ok) continue;
            
            const data = await res.json() as { totalUsdValue?: number, totalInterestEarned?: number };
            const balance = data.totalUsdValue || 0;
            const totalInterestEarned = data.totalInterestEarned || 0;

            let subject = "";
            let html = "";

            if (balance > 0) {
              subject = "Your Weekly Yield Earnings 🚀";
              html = `
                <!DOCTYPE html>
                <html>
                <body style="background-color: #f4f4f5; margin: 0; padding: 0;">
                  <div style="background-color: #f4f4f5; padding: 40px 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      <div style="background-color: #000000; padding: 32px 40px; text-align: center;">
                        <img src="https://hefafnsdx7xk1nzg.public.blob.vercel-storage.com/corre_logo_preview.png" alt="Corre" style="width: 48px; height: 48px; margin-bottom: 16px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Your Weekly Yield Is Here 🚀</h1>
                      </div>
                      <div style="padding: 40px; color: #3f3f46; line-height: 1.6;">
                        <p style="margin: 0 0 16px; font-size: 16px;">Hello ${user.name ?? "Investor"},</p>
                        <p style="margin: 0 0 24px; font-size: 16px;">Another week, another step closer to your financial goals! Your savings on <strong>Corre</strong> are actively working for you.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 15px;">Total Savings Balance</td>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a; font-size: 16px; text-align: right;">$${balance.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 15px;">Current APY</td>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a; font-size: 16px; text-align: right;">${apyFormatted}%</td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0 0; color: #64748b; font-size: 15px;">Total Interest Earned</td>
                              <td style="padding: 16px 0 0; font-weight: 700; color: #16a34a; font-size: 18px; text-align: right;">+$${totalInterestEarned.toFixed(4)}</td>
                            </tr>
                          </table>
                        </div>
                        


                        <p style="margin: 24px 0 0; font-size: 16px;">Keep building your future with <strong>Corre</strong>.</p>
                      </div>
                      <div style="text-align: center; padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #eaeaea; color: #a1a1aa; font-size: 13px;">
                        <div style="margin-bottom: 16px;">
                          <a href="https://corre.bond" style="color: #000000; text-decoration: none; margin: 0 12px;">Web App</a>
                          <a href="https://x.com/Corre_hq" style="color: #000000; text-decoration: none; margin: 0 12px;">X (Twitter)</a>
                        </div>
                        <p style="margin: 0;">© 2026 Corre. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
              `;
            } else {
              subject = "Start Earning Yield Today 🚀";
              const potentialYield1000 = (1000 * apy).toFixed(2);
              html = `
                <!DOCTYPE html>
                <html>
                <body style="background-color: #f4f4f5; margin: 0; padding: 0;">
                  <div style="background-color: #f4f4f5; padding: 40px 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      <div style="background-color: #000000; padding: 32px 40px; text-align: center;">
                        <img src="https://hefafnsdx7xk1nzg.public.blob.vercel-storage.com/corre_logo_preview.png" alt="Corre" style="width: 48px; height: 48px; margin-bottom: 16px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Don't Miss Out on Yield! 💰</h1>
                      </div>
                      <div style="padding: 40px; color: #3f3f46; line-height: 1.6;">
                        <p style="margin: 0 0 16px; font-size: 16px;">Hello ${user.name ?? "Investor"},</p>
                        <p style="margin: 0 0 24px; font-size: 16px;">Your savings could be working harder for you. <strong>Corre</strong> is currently offering an impressive <strong>${apyFormatted}% APY</strong> on deposits.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                          <p style="margin: 0 0 16px; color: #0f172a; font-size: 16px; font-weight: 600; text-align: center;">Potential Earnings Example</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 15px;">If you deposit</td>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a; font-size: 16px; text-align: right;">$1,000.00</td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 15px;">Target APY</td>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a; font-size: 16px; text-align: right;">${apyFormatted}%</td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0 0; color: #64748b; font-size: 15px;">You could earn in 1 year</td>
                              <td style="padding: 16px 0 0; font-weight: 700; color: #16a34a; font-size: 18px; text-align: right;">+$${potentialYield1000}</td>
                            </tr>
                          </table>
                        </div>
                        


                        <p style="margin: 0 0 24px; font-size: 16px;">Start earning today. Simply deposit funds into your Corre Vault to watch your balance compound automatically over time!</p>
                        
                        <div style="text-align: center;">
                          <a href="https://corre.bond/" style="display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">Deposit Now</a>
                        </div>
                      </div>
                      <div style="text-align: center; padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #eaeaea; color: #a1a1aa; font-size: 13px;">
                        <div style="margin-bottom: 16px;">
                          <a href="https://corre.bond" style="color: #000000; text-decoration: none; margin: 0 12px;">Web App</a>
                          <a href="https://x.com/Corre_hq" style="color: #000000; text-decoration: none; margin: 0 12px;">X (Twitter)</a>
                        </div>
                        <p style="margin: 0;">© 2026 Corre. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
              `;
            }

            await resend.emails.send({
              from: "Corre <noreply@notification.corre.bond>",
              to: user.email,
              subject,
              html,
            });
            count++;
          } catch (error) {
            console.error(`Failed during email send logic for ${user.email}:`, error);
          }
        }
        return count;
      });

      totalEmailsSent += batchSentCount;

      // If we have more users to process, wait 24 hours to reset Resend's daily quota
      if (i + BATCH_SIZE < users.length) {
        await step.sleep(`wait-for-quota-reset-${i}`, "24h");
      }
    }

    return {
      message: `Processed ${users.length} users. Sent ${totalEmailsSent} emails across batches.`,
    };
  }
);
