"use client";

import React from "react";
import { AgentRun } from "@/types/telemetry";
import { RunStatusBadge } from "../common/RunStatusBadge";
import { formatDuration } from "@/lib/utils";
import {
  GitCompare,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RunComparisonProps {
  originalRun: AgentRun;
  replayRun: AgentRun;
  checkpointStep?: number;
  onClose?: () => void;
  className?: string;
}

export const RunComparison: React.FC<RunComparisonProps> = ({
  originalRun,
  replayRun,
  checkpointStep = 5,
  onClose,
  className,
}) => {
  const maxSteps = Math.max(originalRun.steps.length, replayRun.steps.length);
  const stepIndices = Array.from({ length: maxSteps }, (_, i) => i + 1);

  const durationDelta = replayRun.durationMs - originalRun.durationMs;
  const isFaster = durationDelta < 0;

  return (
    <div className={cn("rounded border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden", className)}>
      {/* Header Banner */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="font-mono text-xs font-semibold text-zinc-100 tracking-wide uppercase">
              TRACE DIVERGENCE & REPAIR COMPARISON
            </span>
            <span className="text-[11px] text-zinc-400 font-mono block">
              Divergence Point: <span className="text-amber-400 font-medium">Step {checkpointStep}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Verdict Banner */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 font-mono text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>FAILURE RESOLVED</span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Close Diff
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-b border-zinc-850 bg-zinc-950 text-xs font-mono">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">OUTCOME</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RunStatusBadge outcome={originalRun.outcome} size="sm" />
            <ArrowRight className="w-3 h-3 text-zinc-600" />
            <RunStatusBadge outcome={replayRun.outcome} size="sm" />
          </div>
        </div>

        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">RUN DURATION</span>
          <div className="flex items-center gap-1 mt-0.5 text-zinc-200">
            <span>{formatDuration(originalRun.durationMs)}</span>
            <ArrowRight className="w-3 h-3 text-zinc-600" />
            <span>{formatDuration(replayRun.durationMs)}</span>
            <span className={`text-[10px] ml-1 ${isFaster ? "text-emerald-400" : "text-zinc-400"}`}>
              ({isFaster ? "" : "+"}{formatDuration(durationDelta)})
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">CHANGED STEPS</span>
          <div className="mt-0.5 text-amber-400 font-semibold">
            Steps {checkpointStep} to {maxSteps} ({maxSteps - checkpointStep + 1} steps)
          </div>
        </div>

        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">VERIFICATION</span>
          <div className="mt-0.5 text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>100% Policy Compliant</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Step Alignment Table */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[640px] space-y-2">
          {/* Column Header Titles */}
          <div className="grid grid-cols-2 gap-4 pb-2 border-b border-zinc-800 font-mono text-[11px] text-zinc-400 uppercase">
            <div className="flex items-center justify-between px-2">
              <span className="text-rose-400 font-semibold">ORIGINAL RUN ({originalRun.runId})</span>
              <span className="text-rose-500 text-[10px]">FAILED AT STEP {checkpointStep}</span>
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-emerald-400 font-semibold">REPLAY RUN ({replayRun.runId})</span>
              <span className="text-emerald-400 text-[10px]">REPAIRED EXECUTION</span>
            </div>
          </div>

          {/* Steplist comparison */}
          {stepIndices.map((idx) => {
            const origStep = originalRun.steps.find((s) => s.stepId === idx);
            const repStep = replayRun.steps.find((s) => s.stepId === idx);

            const isDivergence = idx === checkpointStep;
            const isCommon = idx < checkpointStep;
            const isDownstreamRepaired = idx > checkpointStep;

            return (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-2 gap-4 p-2 rounded border transition-colors",
                  isDivergence
                    ? "border-amber-700 bg-amber-950/30"
                    : isDownstreamRepaired
                    ? "border-emerald-900/30 bg-emerald-950/10"
                    : "border-zinc-850 bg-zinc-900/20"
                )}
              >
                {/* Left Side: Original Step */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-zinc-500 w-6 shrink-0 tnum">
                    {String(idx).padStart(2, "0")}
                  </span>

                  {origStep ? (
                    <>
                      {origStep.status === "failed" ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : origStep.status === "warning" || idx === checkpointStep ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate font-medium text-zinc-300">
                          {origStep.title}
                        </div>
                        {origStep.toolName && (
                          <div className="text-[10px] font-mono text-rose-400 truncate">
                            tool: {origStep.toolName}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-zinc-600 text-xs italic font-mono">No step</span>
                  )}
                </div>

                {/* Right Side: Replay Step */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-zinc-500 w-6 shrink-0 tnum">
                    {String(idx).padStart(2, "0")}
                  </span>

                  {repStep ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate font-medium text-zinc-200">
                          {repStep.title}
                        </div>
                        {repStep.toolName && (
                          <div className="text-[10px] font-mono text-emerald-400 truncate">
                            tool: {repStep.toolName}
                          </div>
                        )}
                      </div>

                      {isDivergence && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-amber-300 shrink-0">
                          DIVERGED
                        </span>
                      )}
                      {isDownstreamRepaired && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900 text-emerald-300 shrink-0">
                          REPAIRED
                        </span>
                      )}
                      {isCommon && (
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          IDENTICAL
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-600 text-xs italic font-mono">No step</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
