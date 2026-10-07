import React from "react";
import { RunOutcome, FailureType } from "@/types/telemetry";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface RunStatusBadgeProps {
  outcome: RunOutcome | "warning" | "diagnosed";
  className?: string;
  size?: "sm" | "md";
}

export const RunStatusBadge: React.FC<RunStatusBadgeProps> = ({
  outcome,
  className,
  size = "sm",
}) => {
  const isSmall = size === "sm";

  if (outcome === "success") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded border border-emerald-900/60 bg-emerald-950/40 text-emerald-400 font-medium tracking-tight",
          isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <CheckCircle2 className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>SUCCESS</span>
      </span>
    );
  }

  if (outcome === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded border border-rose-900/60 bg-rose-950/40 text-rose-400 font-medium tracking-tight",
          isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <XCircle className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>FAILED</span>
      </span>
    );
  }

  if (outcome === "warning" || outcome === "diagnosed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded border border-amber-900/60 bg-amber-950/40 text-amber-400 font-medium tracking-tight",
          isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <AlertTriangle className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>DIAGNOSED</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-sky-900/60 bg-sky-950/40 text-sky-400 font-medium tracking-tight",
        isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <Loader2 className={cn("animate-spin", isSmall ? "w-3 h-3" : "w-3.5 h-3.5")} />
      <span>RUNNING</span>
    </span>
  );
};

export const FailureTypeBadge: React.FC<{ type: FailureType; className?: string }> = ({
  type,
  className,
}) => {
  const formatted = type.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono tracking-tight bg-zinc-900 text-zinc-300 border border-zinc-800",
        className
      )}
    >
      {formatted}
    </span>
  );
};
