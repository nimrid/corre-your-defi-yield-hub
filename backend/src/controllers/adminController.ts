import type { Request, Response } from "express";
import { pool } from "../db.js";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const [
      statsResult,
      savingsResult,
      dailyUsersResult,
      monthlyUsersResult,
      dailyTxResult,
      monthlyTxResult,
    ] = await Promise.all([
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM suspicious_activity) as suspicious_flags,
          (SELECT COUNT(*) FROM wallets) as total_wallets,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '60 days') as active_users,
          (SELECT SUM(usdc_amount::numeric) FROM stock_purchases) as total_stock_purchases,
          (SELECT SUM(usdc_amount::numeric) FROM stock_sales) as total_stock_sales,
          (SELECT SUM(amount::numeric) FROM transactions WHERE asset_symbol = 'USDC') as base_transaction_volume,
          (SELECT SUM(amount::numeric) FROM private_market_purchases WHERE status = 'CONFIRMED') as total_private_market_volume
      `),
      pool.query(`
        SELECT 
          vault_type, 
          direction, 
          SUM(usdc_amount::numeric) as total 
        FROM savings_activity 
        GROUP BY vault_type, direction
      `),
      pool.query(`
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as date, COUNT(*) as count 
        FROM users WHERE created_at >= NOW() - INTERVAL '30 days' 
        GROUP BY DATE(created_at) ORDER BY date ASC
      `),
      pool.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as date, COUNT(*) as count 
        FROM users WHERE created_at >= NOW() - INTERVAL '12 months' 
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY date ASC
      `),
      pool.query(`
        WITH all_activity AS (
          SELECT created_at, amount::numeric as volume FROM transactions WHERE asset_symbol = 'USDC'
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM savings_activity
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM stock_purchases
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM stock_sales
        )
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as date, COUNT(*) as count, SUM(volume) as volume 
        FROM all_activity 
        WHERE created_at >= NOW() - INTERVAL '30 days' 
        GROUP BY DATE(created_at) 
        ORDER BY date ASC
      `),
      pool.query(`
        WITH all_activity AS (
          SELECT created_at, amount::numeric as volume FROM transactions WHERE asset_symbol = 'USDC'
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM savings_activity
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM stock_purchases
          UNION ALL
          SELECT created_at, usdc_amount::numeric as volume FROM stock_sales
        )
        SELECT TO_CHAR(created_at, 'YYYY-MM') as date, COUNT(*) as count, SUM(volume) as volume 
        FROM all_activity 
        WHERE created_at >= NOW() - INTERVAL '12 months' 
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') 
        ORDER BY date ASC
      `),
    ]);

    const statsRow = statsResult.rows[0];
    const totalUsers = parseInt(statsRow.total_users || "0", 10);
    const suspiciousFlags = parseInt(statsRow.suspicious_flags || "0", 10);
    const totalWallets = parseInt(statsRow.total_wallets || "0", 10);
    const activeUsers = parseInt(statsRow.active_users || "0", 10);
    const totalStockPurchases = parseFloat(statsRow.total_stock_purchases || "0");
    const totalStockSales = parseFloat(statsRow.total_stock_sales || "0");
    const baseTransactionVolume = parseFloat(statsRow.base_transaction_volume || "0");
    const totalPrivateMarketVolume = parseFloat(statsRow.total_private_market_volume || "0");

    let standardSavings = 0;
    let shieldedSavings = 0;

    for (const row of savingsResult.rows) {
      const type = row.vault_type.toLowerCase();
      const amount = parseFloat(row.total);
      
      if (type === 'standard' || type === 'regular') {
        if (row.direction === 'deposit') standardSavings += amount;
        else if (row.direction === 'withdrawal') standardSavings -= amount;
      } else if (type === 'shielded' || type === 'protected') {
        if (row.direction === 'deposit') shieldedSavings += amount;
        else if (row.direction === 'withdrawal') shieldedSavings -= amount;
      }
    }

    const netStockInvestments = totalStockPurchases + totalStockSales;
    
    // Add savings and stock investments to the total volume
    const transactionVolume = baseTransactionVolume + netStockInvestments + Math.abs(standardSavings) + Math.abs(shieldedSavings);

    return res.json({
      totalUsers,
      activeUsers,
      standardSavings,
      shieldedSavings,
      netStockInvestments,
      suspiciousFlags,
      transactionVolume,
      totalWallets,
      totalPrivateMarketVolume,
      charts: {
        dailyUsers: dailyUsersResult.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) })),
        monthlyUsers: monthlyUsersResult.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) })),
        dailyTransactions: dailyTxResult.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10), volume: parseFloat(r.volume || '0') })),
        monthlyTransactions: monthlyTxResult.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10), volume: parseFloat(r.volume || '0') }))
      }
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUsersList(req: Request, res: Response) {
  try {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.created_at as joined_at,
        w.address as solana_wallet
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id AND w.chain_type = 'solana'
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users list:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
