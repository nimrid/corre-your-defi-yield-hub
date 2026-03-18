import { US_STOCK_TOKENS } from "@/config/usStockTokens";
import { TrendingUp, Activity } from "lucide-react";

const LandingStocksShowcase = () => {
    // We duplicate the array 3 times to ensure a seamless infinite scroll width
    const duplicationArray = [...US_STOCK_TOKENS, ...US_STOCK_TOKENS, ...US_STOCK_TOKENS];

    return (
        <section className="py-16 md:py-24 relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground font-medium">Tokenized Traditional Assets</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
                    Trade Global <span className="gradient-text">Powerhouses</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Why stop at crypto? Securely invest in tokenized U.S. stocks with fractional shares directly from your DeFi wallet.
                </p>
            </div>

            {/* Top Carousel (Scrolling Left) */}
            <div className="relative flex overflow-x-hidden group">
                <div className="absolute top-0 left-0 bottom-0 w-24 md:w-48 bg-gradient-to-r from-background to-transparent z-10" />
                <div className="absolute top-0 right-0 bottom-0 w-24 md:w-48 bg-gradient-to-l from-background to-transparent z-10" />

                <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap min-w-full">
                    {duplicationArray.map((stock, i) => (
                        <div
                            key={i}
                            className="bg-secondary/30 border border-border/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 mx-3 flex flex-col items-start gap-4 transition-all duration-300 hover:-translate-y-2 hover:bg-secondary/60 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 min-w-[200px] md:min-w-[240px]"
                        >
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shrink-0">
                                <span className="font-bold text-primary text-sm md:text-base">{stock.symbol.slice(0, 2)}</span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-lg md:text-xl text-foreground">{stock.symbol}</h3>
                                <p className="text-sm text-muted-foreground truncate w-full max-w-[150px] md:max-w-[180px]">{stock.name}</p>
                            </div>
                            <div className="mt-auto w-full pt-4 flex items-center justify-between border-t border-border/50">
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/10 text-green-500 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> Tokenized
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default LandingStocksShowcase;
