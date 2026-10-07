import React from "react";
import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: number; // 0 to 1
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  label,
  showPercent = true,
  className,
}) => {
  const percentage = Math.round(confidence * 100);

  // Semantic color for confidence: > 85% amber/high, > 70% zinc-300
  const colorClass =
    percentage >= 85
      ? "bg-amber-400"
      : percentage >= 70
      ? "bg-amber-500/70"
      : "bg-zinc-400";

  return (
    <div className={cn("flex items-center gap-2 font-mono text-xs", className)}>
      {label && <span className="text-zinc-400 font-sans text-xs">{label}</span>}
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
        <div
          className={cn("h-full transition-all duration-300", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercent && (
        <span className="text-zinc-200 font-medium tnum">{percentage}%</span>
      )}
    </div>
  );
};
