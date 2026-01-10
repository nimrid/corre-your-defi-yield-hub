import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const Invest = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invest</h1>
            <p className="text-sm text-muted-foreground">
              Choose what you want to invest in. Start with US stocks.
            </p>
          </div>

          <Tabs defaultValue="us-stocks" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto rounded-full bg-muted/80 p-1">
              <TabsTrigger
                value="us-stocks"
                className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                onClick={() => navigate("/invest/us-stocks")}
              >
                US stocks
              </TabsTrigger>
            </TabsList>
            <TabsContent value="us-stocks" className="mt-6">
              <div className="glass-card p-5 sm:p-6 rounded-xl border border-border/60 flex flex-col gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">US stocks</h2>
                  <p className="text-sm text-muted-foreground">
                    View the list of supported US tokenized stocks.
                  </p>
                </div>
                <Button
                  type="button"
                  className="self-start rounded-full px-5 py-2 text-sm font-semibold"
                  onClick={() => navigate("/invest/us-stocks")}
                >
                  Browse US stocks
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Invest;
