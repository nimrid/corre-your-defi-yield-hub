import React from "react";
import {
  Shield,
  Lock,
  Layers,
  TrendingUp,
  Coins,
  Globe,
  Flame,
  Sparkles,
  Info,
  FileText,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RwaDetailContent, RwaFeatureCard } from "@/config/rwaTokenContent";

interface RwaContentRendererProps {
  content: RwaDetailContent;
  feePct: number;
}

const renderIcon = (name: RwaFeatureCard["iconName"]) => {
  switch (name) {
    case "Shield":
      return <Shield className="w-4 h-4 text-emerald-500" />;
    case "Lock":
      return <Lock className="w-4 h-4 text-primary" />;
    case "TrendingUp":
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    case "Coins":
      return <Coins className="w-4 h-4 text-blue-500" />;
    case "Globe":
      return <Globe className="w-4 h-4 text-amber-500" />;
    case "Flame":
      return <Flame className="w-4 h-4 text-orange-500" />;
    case "Sparkles":
      return <Sparkles className="w-4 h-4 text-primary" />;
    case "Layers":
    default:
      return <Layers className="w-4 h-4 text-primary" />;
  }
};

export const RwaContentRenderer: React.FC<RwaContentRendererProps> = ({
  content,
  feePct,
}) => {
  return (
    <>
      {/* Overview Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-primary/5 to-secondary/30 border border-emerald-500/20 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{content.headlineBadge}</span>
          </Badge>
          {content.yieldBadge && (
            <Badge variant="outline" className="text-xs">
              {content.yieldBadge}
            </Badge>
          )}
          {content.tenorBadge && (
            <Badge variant="outline" className="text-xs">
              {content.tenorBadge}
            </Badge>
          )}
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          {content.title}
        </h2>
        {content.summary.map((paragraph, idx) => (
          <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Section: What is this Asset? */}
      <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {content.whatIsTitle}
          </h3>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          {content.whatIsParagraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}

          {content.whatIsCards && content.whatIsCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {content.whatIsCards.map((card, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wide">
                    {renderIcon(card.iconName)}
                    <span>{card.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {content.summaryNote && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3.5 flex items-start gap-2.5 text-xs text-foreground/90">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-foreground">Summary: </span>
                {content.summaryNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section: Key Terms of the Offer */}
      <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Key Terms of the Offer
            </h3>
          </div>
          {content.termSheetBadge && (
            <Badge variant="outline" className="text-xs">
              {content.termSheetBadge}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {content.terms.map((term, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1"
            >
              <span className="text-muted-foreground">{term.label}</span>
              <p
                className={`font-semibold ${
                  term.isHighlight
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                }`}
              >
                {term.value}
              </p>
            </div>
          ))}

          {/* Dynamic Trading Fee */}
          <div className="rounded-xl bg-secondary/30 border border-border/50 p-3 space-y-1">
            <span className="text-muted-foreground">Trading Fee</span>
            <p className="font-semibold text-foreground">{feePct}% Protocol Fee</p>
          </div>
        </div>
      </div>

      {/* Section: About Issuer */}
      <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {content.aboutIssuerTitle}
          </h3>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          {content.aboutIssuerParagraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </div>

      {/* Section: Why Consider This Offer */}
      <div className="rounded-2xl bg-secondary/20 border border-border/60 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {content.whyConsiderTitle}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {content.whyConsiderCards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                {renderIcon(card.iconName)}
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">
                  {card.title}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
