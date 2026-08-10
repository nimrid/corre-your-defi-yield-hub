import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// The translations
// (tip: move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: {
      invest_stock_details: {
        back_to_us_stocks: "Back to US stocks",
        loading: "Loading stock details...",
        your_holdings: "Your holdings",
        buy: "Buy",
        sell: "Sell"
      },
      buy_usdc: {
        back: "Back",
        title: "Buy USDC",
        description: "Choose how you want to purchase USDC.",
        buy_with_naira: "Buy with Naira",
        buy_with_naira_desc: "Purchase USDC directly using your local Naira bank account.",
        receive_stablecoin: "Receive Stablecoin",
        receive_stablecoin_desc: "Send USDC directly to your Solana wallet.",
        solana_wallet_address: "Solana Wallet Address",
        no_solana_wallet: "No Solana wallet connected.",
        buy_with_card: "Buy with Card (Global)",
        buy_with_card_desc: "Buy USDC globally using Card, Apple Pay, or Google Pay in USD, EUR, GBP & 45+ currencies.",
        global_onramp_title: "Global Fiat Onramp",
        global_onramp_subtitle: "Instant purchase via Stripe, MoonPay, Coinbase & Meld",
        select_destination_chain: "Select Destination Wallet",
        solana_network: "Solana Network",
        base_network: "Base (EVM) Network",
        launch_onramp: "Buy USDC via Card",
        starting_onramp: "Launching Onramp...",
        purchase_confirmed: "Purchase Confirmed!",
        purchase_confirmed_desc: "Your USDC purchase has been successfully processed and delivered to your wallet.",
        purchase_submitted: "Purchase Submitted",
        purchase_submitted_desc: "Your transaction has been submitted and is currently being processed by the payment provider.",
        onramp_failed: "Onramp Failed",
        onramp_failed_desc: "Unable to complete fiat onramp. Please try again or choose another payment method."
      }
    }
  }
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: "en", // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
