"use client";

import React, { useState } from "react";
import { TraceStep } from "@/types/telemetry";
import { TraceStepItem } from "./TraceStepItem";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";

interface TraceTimelineProps {
  steps: TraceStep[];
  predictedFailureStep?: number;
  confidence?: number;
  onSelectStep?: (step: TraceStep) => void;
  onReplayFromStep?: (stepId: number) => void;
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  steps,
  predictedFailureStep,
  confidence,
  onSelectStep,
  onReplayFromStep,
}) => {
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div className="space-y-3">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-mono text-zinc-300 font-medium">
            EXECUTION SEQUENCE ({steps.length} STEPS)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpandAll(!expandAll)}
          className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {expandAll ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Collapse All</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Expand All</span>
            </>
          )}
        </button>
      </div>

      {/* Step Sequence Container */}
      <div className="space-y-2 relative">
        {/* Subtle connector spine */}
        <div className="absolute left-6.5 top-3 bottom-3 w-px bg-zinc-800 -z-0 hidden md:block" />

        {steps.map((step) => {
          const isSuspected = step.stepId === predictedFailureStep;

          return (
            <div key={`${step.stepId}-${step.title}`} className="relative z-10">
              <TraceStepItem
                step={step}
                isSuspected={isSuspected}
                confidence={isSuspected ? confidence : undefined}
                onSelect={onSelectStep}
                onReplayFromStep={onReplayFromStep}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
