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
  { mint: "GZ8v4NdSG7CTRZqHMgNsTPRULeVi8CpdWd9wZY8ondo", name: "Procter & Gamble", symbol: "PGon" },
  { mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL", name: "Oracle", symbol: "ORCL" },
  { mint: "Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU", name: "Unknown", symbol: "STOCK" },
  { mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", name: "Gold", symbol: "GOLD" },
  { mint: "XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe", name: "UnitedHealth", symbol: "UNH" },

  { mint: "cJpUMp5R7rZ6fGeLHbHhrRuJzK9mkyKDjZqNpT3ondo", name: "Intel Stock", symbol: "INTCon" },
  { mint: "Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf", name: "Cisco", symbol: "CSCOx" },
  { mint: "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH", name: "Eli Lilly", symbol: "LLYx" },

  { mint: "g646pcdG2Rt5DH9WZzL7VVnVDWCCMTTrnktwE74ondo", name: "NIKE", symbol: "NKEon" },
  { mint: "XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p", name: "Visa", symbol: "VONVUSD" },
  { mint: "XsHtf5RpxsQ7jeJ9ivNewouZKJHbPxhPoEy6yYvULr7", name: "Abbott", symbol: "ABTx" },
  { mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo", name: "Broadcom", symbol: "AVGOx" },
  { mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", name: "KALSHI", symbol: "KALSHI" },
  { mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", name: "POLYMARKET", symbol: "POLYMARKET" },
  { mint: "keybg184d4vyXeQdFqs4o99YsMg7xBthxTJ6Ky3ondo", name: "Taiwan Semiconductor Manufacturing", symbol: "TSMon" },
  { mint: "aLDdFsr3VTUQaHFK6yNvQxztvxQ8nxW4AMuSGC7ondo", name: "Figma", symbol: "FIGon" },
  { mint: "XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts", name: "Chevron", symbol: "CVXx" },

  { mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", name: "Gamestop", symbol: "GMEx" },
  { mint: "Xs5UJzmCRQ8DWZjskExdSQDnbE6iLkRu2jjrRAB1JSU", name: "Accenture", symbol: "ACNx" },
  { mint: "a2cXfonVgQ6cKB4Lm8YZsPry39VZSA562bwmRSiondo", name: "Snap", symbol: "SNAPon" },

  { mint: "jzCvs2Pk8tDcfsFRqnEMjurgaQW4iQfEkandUR8ondo", name: "Spotify", symbol: "SPOTon" },
  { mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", name: "Anduril PreStocks", symbol: "Anduril" },
  { mint: "7C56WnJ94iEP7YeH2iKiYpvsS5zkcpP9rJBBEBoUGdzj", name: "Silver rStock", symbol: "Silver" },

  { mint: "ivdDracs2s7jCP698dJXKSEQdVrNj9hasJL1Uq1ondo", name: "Shopify", symbol: "SHOPon" },
  { mint: "KUXt7LzHWSQXp5eyqMZRxWjAP6yM8BUh4LRHwiwondo", name: "Johnson & Johnson", symbol: "JNJon" },
  { mint: "XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC", name: "Mastercard", symbol: "MA" },

];

export const US_STOCK_MINTS = US_STOCK_TOKENS.map((t) => t.mint);
