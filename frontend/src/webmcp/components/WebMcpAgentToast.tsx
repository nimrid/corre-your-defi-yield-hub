import React, { useEffect, useState } from "react";
import type { WebMcpToast } from "../types";
import { subscribeToWebMcpToasts } from "../toastEmitter";

export const WebMcpAgentToast: React.FC = () => {
  const [toasts, setToasts] = useState<WebMcpToast[]>([]);

  useEffect(() => {
    return subscribeToWebMcpToasts((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
        >
          <span className="text-xl shrink-0 select-none">{toast.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">WebMCP Agent</span>
              <span className="text-muted-foreground text-[10px]">• now</span>
            </div>
            <h4 className="text-xs font-semibold text-foreground truncate mt-0.5">{toast.title}</h4>
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{toast.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
