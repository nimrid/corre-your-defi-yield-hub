import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Hero = () => {
  const { ready, authenticated, login } = usePrivy();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && authenticated) {
      navigate("/home");
    }
  }, [ready, authenticated, navigate]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="relative z-10 max-w-6xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border animate-fade-in">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Bridge DeFi and Traditional Finance</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
          Earn <span className="gradient-text">DeFi Yields</span><br />
          Invest in <span className="gradient-text">Capital Markets</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Seamlessly invest your USDC into high-yield DeFi protocols and traditional stocks & bonds.
          The future of diversified investing is here.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Button
            onClick={() => login()}
            size="lg"
            className="group bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all glow-effect"
          >
            Sign Up
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button size="lg" variant="outline" className="border-border/50 hover:bg-secondary/50">
            Learn More
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-bold gradient-text">$1.5M+</div>
            <div className="text-sm text-muted-foreground">Total Value Locked</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-bold gradient-text">15%</div>
            <div className="text-sm text-muted-foreground">Average APY</div>
          </div>
          <div className="space-y-1 col-span-2 md:col-span-1">
            <div className="text-3xl md:text-4xl font-bold gradient-text">200+</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

