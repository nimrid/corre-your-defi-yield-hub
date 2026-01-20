export interface USStockTokenConfig {
  mint: string;
  name: string;
  symbol: string;
}

// Central list of US tokenized stock mints used across the app
export const US_STOCK_TOKENS: USStockTokenConfig[] = [
  { mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", name: "CRCLx", symbol: "CRCLX" },
  { mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", name: "Tesla", symbol: "TSLA" },
  { mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", name: "MSTRx", symbol: "MSTRX" },
  { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", name: "S&P 500", symbol: "SP500" },
  { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", name: "Nvidia", symbol: "NVDA" },
  { mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", name: "Google", symbol: "GOOGL" },
  { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", name: "Apple", symbol: "AAPL" },
  { mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", name: "Nasdaq", symbol: "NASDAQ" },
  { mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", name: "Robinhood", symbol: "HOOD" },
  { mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", name: "Amazon", symbol: "AMZN" },
  { mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", name: "Coinbase", symbol: "COIN" },
  { mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", name: "Meta", symbol: "META" },
  { mint: "XsaQTCgebC2KPbf27KUhdv5JFvHhQ4GDAPURwrEhAzb", name: "AMBR", symbol: "AMBR" },
  { mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", name: "McDonald's", symbol: "MCD" },
  { mint: "Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci", name: "WalmartX", symbol: "WMTX" },
  { mint: "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x", name: "Berkshire", symbol: "BRK" },
  { mint: "Xs8drBWy3Sd5QY3aifG9kt9KFs2K3PGZmx7jWrsrk57", name: "Thermo Fisher", symbol: "TMO" },
  { mint: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ", name: "Coca-Cola", symbol: "KO" },
  { mint: "XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV", name: "Procter & Gamble", symbol: "PG" },
  { mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL", name: "Oracle", symbol: "ORCL" },
  { mint: "Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU", name: "Unknown", symbol: "STOCK" },
  { mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", name: "Gold", symbol: "GOLD" },
  { mint: "XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe", name: "UnitedHealth", symbol: "UNH" },
];

export const US_STOCK_MINTS = US_STOCK_TOKENS.map((t) => t.mint);
