import type { Request, Response } from "express";
import { pool } from "../db.js";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const usersResult = await pool.query(`SELECT COUNT(*) as count FROM users`);
    const totalUsers = parseInt(usersResult.rows[0].count, 10);

    const savingsResult = await pool.query(`
      SELECT 
        vault_type, 
        direction, 
        SUM(usdc_amount::numeric) as total 
      FROM savings_activity 
      GROUP BY vault_type, direction
    `);

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

    // Stock investments
    const stockPurchasesResult = await pool.query(`SELECT SUM(usdc_amount::numeric) as total FROM stock_purchases`);
    const stockSalesResult = await pool.query(`SELECT SUM(usdc_amount::numeric) as total FROM stock_sales`);
    
    const totalStockPurchases = parseFloat(stockPurchasesResult.rows[0].total || '0');
    const totalStockSales = parseFloat(stockSalesResult.rows[0].total || '0');
    const netStockInvestments = totalStockPurchases + totalStockSales;

    // Suspicious Activity
    const suspiciousResult = await pool.query(`SELECT COUNT(*) as count FROM suspicious_activity`);
    const suspiciousFlags = parseInt(suspiciousResult.rows[0].count, 10);

    // Transactions Volume (USDC)
    const txVolumeResult = await pool.query(`SELECT SUM(amount::numeric) as total FROM transactions WHERE asset_symbol = 'USDC'`);
    const baseTransactionVolume = parseFloat(txVolumeResult.rows[0].total || '0');
    
    // Add savings and stock investments to the total volume
    const transactionVolume = baseTransactionVolume + netStockInvestments + Math.abs(standardSavings) + Math.abs(shieldedSavings);

    // Total Linked Wallets
    const walletsResult = await pool.query(`SELECT COUNT(*) as count FROM wallets`);
    const totalWallets = parseInt(walletsResult.rows[0].count, 10);
    
    // Chart Data: Daily/Monthly Users
    const dailyUsersResult = await pool.query(`
      SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as date, COUNT(*) as count 
      FROM users WHERE created_at >= NOW() - INTERVAL '30 days' 
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);
    
    const monthlyUsersResult = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as date, COUNT(*) as count 
      FROM users WHERE created_at >= NOW() - INTERVAL '12 months' 
      GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY date ASC
    `);

    // Chart Data: Daily/Monthly Transactions (Aggregated across all tables)
    const dailyTxResult = await pool.query(`
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
    `);

    const monthlyTxResult = await pool.query(`
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
    `);

    // Active Users (from users table, updated_at within 60 days)
    const activeUsersResult = await pool.query(`SELECT COUNT(*) as count FROM users WHERE updated_at >= NOW() - INTERVAL '60 days'`);
    const activeUsers = parseInt(activeUsersResult.rows[0].count, 10);

    return res.json({
      totalUsers,
      activeUsers,
      standardSavings,
      shieldedSavings,
      netStockInvestments,
      suspiciousFlags,
      transactionVolume,
      totalWallets,
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
