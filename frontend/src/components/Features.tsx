import { Wallet, LineChart, Shield } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "DeFi Yields",
    description: "Earn competitive yields through battle-tested DeFi protocols. Your USDC works harder for you.",
  },
  {
    icon: LineChart,
    title: "Capital Markets Access",
    description: "Invest in traditional stocks and bonds directly with your crypto. Diversify with ease.",
  },
  {
    icon: Shield,
    title: "Secure & Audited",
    description: "Smart contracts audited by leading security firms. Your assets are protected 24/7.",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Why Choose <span className="gradient-text">Corre</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The bridge between decentralized finance and traditional markets
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="glass-card p-8 rounded-2xl hover:border-primary/50 transition-all duration-300 group hover:glow-effect"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
