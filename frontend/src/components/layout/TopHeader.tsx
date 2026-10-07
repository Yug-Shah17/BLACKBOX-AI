"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ChevronRight, SlidersHorizontal, RefreshCw } from "lucide-react";

interface TopHeaderProps {
  currentRunId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentRunId,
  onRefresh,
  isRefreshing = false,
}) => {
  const pathname = usePathname();

  // Breadcrumbs determination
  let pageTitle = "Runs Dashboard";
  if (pathname.startsWith("/trace")) {
    pageTitle = "Trace & Root-Cause Debugger";
  } else if (pathname.startsWith("/evaluation")) {
    pageTitle = "Model Evaluation Benchmarks";
  } else if (pathname.startsWith("/datasets")) {
    pageTitle = "Dataset Splits & Traces";
  } else if (pathname.startsWith("/settings")) {
    pageTitle = "Collector Settings";
  }

  return (
    <header className="h-13 border-b border-zinc-800 bg-zinc-950/80 px-4 flex items-center justify-between shrink-0 select-none z-10 backdrop-blur-xs">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/runs"
          className="text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
        >
          blackbox
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-zinc-300 font-medium">{pageTitle}</span>
        {currentRunId && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="font-mono text-zinc-100 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-[11px]">
              {currentRunId}
            </span>
          </>
        )}
      </div>

      {/* Right: Environment & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Environment Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>env: prod-telemetry</span>
        </div>

        {/* Quick Search Shortcut */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] text-zinc-400">Search traces...</span>
          <kbd className="text-[10px] font-mono bg-zinc-800 px-1 py-0.2 rounded text-zinc-400 border border-zinc-700">
            ⌘K
          </kbd>
        </div>

        {/* Refresh Action */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
            title="Refresh telemetry feed"
            aria-label="Refresh telemetry feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}

        {/* Filter / Config shortcut */}
        <button
          type="button"
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
          title="Telemetry Filter Settings"
          aria-label="Telemetry Filter Settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
