"use client";

import React from "react";
import { Diagnosis } from "@/types/telemetry";
import { FailureTypeBadge } from "../common/RunStatusBadge";
import { ConfidenceIndicator } from "../common/ConfidenceIndicator";
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  BarChart2,
  FileText,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosisPanelProps {
  diagnosis: Diagnosis | null;
  onOpenReplay?: (stepId: number) => void;
  className?: string;
}

export const DiagnosisPanel: React.FC<DiagnosisPanelProps> = ({
  diagnosis,
  onOpenReplay,
  className,
}) => {
  if (!diagnosis) {
    return (
      <div className={cn("p-6 text-center border border-zinc-800 rounded bg-zinc-950/60", className)}>
        <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
        <h4 className="text-xs font-mono text-zinc-300 font-medium">NO FAILURE DETECTED</h4>
        <p className="text-xs text-zinc-500 mt-1">
          Execution trace completed nominally with zero divergence flags.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden", className)}>
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-zinc-200 tracking-wide">
            ROOT-CAUSE DIAGNOSIS
          </span>
        </div>
        <ConfidenceIndicator
          confidence={diagnosis.confidence}
          label="Confidence:"
        />
      </div>

      <div className="p-4 space-y-4 text-xs overflow-y-auto">
        {/* Core Localization Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded border border-zinc-800 bg-zinc-900/40">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              MOST LIKELY FAILURE
            </span>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-amber-400 font-bold text-sm">
              <span>Step {diagnosis.predictedFailureStep}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              FAILURE TYPE
            </span>
            <div className="mt-1">
              <FailureTypeBadge type={diagnosis.failureType} className="bg-zinc-900 text-xs px-2 py-0.5" />
            </div>
          </div>
        </div>

        {/* Technical Explanation */}
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] mb-1.5">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>DIAGNOSTIC EXPLANATION</span>
          </div>
          <div className="p-3 rounded border border-zinc-850 bg-zinc-900/30 text-zinc-200 leading-relaxed text-xs">
            {diagnosis.explanation}
          </div>
        </div>

        {/* Itemized Evidence */}
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] mb-2">
            <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>TELEMETRY EVIDENCE</span>
          </div>
          <ul className="space-y-1.5">
            {diagnosis.evidence.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 p-2 rounded bg-zinc-900/20 border border-zinc-850 text-zinc-300 text-xs"
              >
                <span className="font-mono text-[10px] text-amber-500/80 mt-0.5 font-bold">
                  [E{idx + 1}]
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Suspicion Score Distribution per Step */}
        {diagnosis.suspicionDistribution && diagnosis.suspicionDistribution.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px] mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>SUSPICION DISTRIBUTION</span>
              </div>
              <span className="text-[10px] text-zinc-400">Step P(Fail)</span>
            </div>

            <div className="space-y-1.5 p-2.5 rounded border border-zinc-850 bg-zinc-900/30 font-mono">
              {diagnosis.suspicionDistribution.map((point) => {
                const percent = Math.round(point.score * 100);
                const isTarget = point.isSuspected;

                return (
                  <div key={point.stepId} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "w-7 text-[11px] shrink-0 font-bold tnum",
                        isTarget ? "text-amber-400" : "text-zinc-500"
                      )}
                    >
                      S{point.stepId}
                    </span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-xs overflow-hidden flex">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          isTarget ? "bg-amber-400" : percent > 40 ? "bg-zinc-500" : "bg-zinc-700"
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-9 text-right text-[11px] shrink-0 tnum",
                        isTarget ? "text-amber-400 font-bold" : "text-zinc-500"
                      )}
                    >
                      {percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggested Repair Prompt */}
        {diagnosis.suggestedAlternative && (
          <div className="p-3 rounded border border-amber-900/60 bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px]">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>RECOMMENDED COUNTERMEASURE</span>
            </div>
            <p className="text-xs text-zinc-300 leading-snug">
              {diagnosis.suggestedAlternative.explanation}
            </p>
            <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              Tool: <span className="text-emerald-400 font-medium">{diagnosis.suggestedAlternative.toolName}</span>
            </div>
          </div>
        )}

        {/* Action Button: Replay from Checkpoint */}
        {onOpenReplay && (
          <button
            type="button"
            onClick={() => onOpenReplay(diagnosis.predictedFailureStep)}
            className="w-full py-2 px-3 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-950" />
            <span>Replay From Checkpoint (Step {diagnosis.predictedFailureStep})</span>
          </button>
        )}
      </div>
    </div>
  );
};
