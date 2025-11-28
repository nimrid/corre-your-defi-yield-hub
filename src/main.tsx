import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cm9jlcquu02arle0mt3abqs5e"
    config={{
      embeddedWallets: {
        ethereum: {
          createOnLogin: 'users-without-wallets'
        },
        solana: {
          createOnLogin: 'users-without-wallets'
        }
      },
      externalWallets: {
        solana: {
          connectors: toSolanaWalletConnectors()
        }
      }
    }}
  >
    <App />
  </PrivyProvider>
);
