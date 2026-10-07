import React from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = "Loading telemetry stream...",
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center p-12 text-zinc-400 gap-3",
      className
    )}
  >
    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
    <span className="text-xs font-mono text-zinc-400">{message}</span>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, className }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded bg-zinc-950/40",
      className
    )}
  >
    <Inbox className="w-8 h-8 text-zinc-600 mb-2" />
    <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
    {description && <p className="text-xs text-zinc-500 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message, onRetry, className }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center p-8 text-center border border-rose-900/40 rounded bg-rose-950/10 text-rose-300",
      className
    )}
  >
    <AlertCircle className="w-6 h-6 text-rose-500 mb-2" />
    <p className="text-xs font-mono">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 px-3 py-1 bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
      >
        Retry
      </button>
    )}
  </div>
);
