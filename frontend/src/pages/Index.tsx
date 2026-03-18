import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import LandingYieldEstimator from "@/components/LandingYieldEstimator";
import LandingStocksShowcase from "@/components/LandingStocksShowcase";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const { ready, authenticated } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && authenticated) {
      navigate("/home");
    }
  }, [ready, authenticated, navigate]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <Hero />
        <LandingYieldEstimator />
        <LandingStocksShowcase />
        <Features />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
