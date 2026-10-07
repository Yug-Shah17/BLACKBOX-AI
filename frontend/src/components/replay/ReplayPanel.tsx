"use client";

import React, { useState } from "react";
import { AgentRun, Diagnosis, ReplayResult } from "@/types/telemetry";
import { replayFromCheckpoint } from "@/lib/services/telemetry-service";
import { JsonViewer } from "../common/JsonViewer";
import {
  RotateCcw,
  Loader2,
  CheckCircle2,
  Play,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplayPanelProps {
  run: AgentRun;
  diagnosis: Diagnosis | null;
  initialCheckpointStep?: number;
  onReplayComplete: (result: ReplayResult) => void;
  onCancel?: () => void;
  className?: string;
}

export const ReplayPanel: React.FC<ReplayPanelProps> = ({
  run,
  diagnosis,
  initialCheckpointStep,
  onReplayComplete,
  onCancel,
  className,
}) => {
  const defaultStep = initialCheckpointStep || diagnosis?.predictedFailureStep || 5;
  const [selectedStep, setSelectedStep] = useState<number>(defaultStep);
  const [prevInitialStep, setPrevInitialStep] = useState(initialCheckpointStep);

  if (initialCheckpointStep !== prevInitialStep) {
    setPrevInitialStep(initialCheckpointStep);
    if (initialCheckpointStep) {
      setSelectedStep(initialCheckpointStep);
    }
  }

  // Original step data
  const originalStep = run.steps.find((s) => s.stepId === selectedStep);

  // Alternative tool & params
  const [alternativeTool, setAlternativeTool] = useState(
    diagnosis?.suggestedAlternative?.toolName || "flight_inventory_search"
  );

  const [alternativeParams, setAlternativeParams] = useState(
    JSON.stringify(
      diagnosis?.suggestedAlternative?.arguments || {
        origin: "BOM",
        destination: "BLR",
        departureDate: "2026-10-04",
        sortBy: "price_asc",
      },
      null,
      2
    )
  );

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayStage, setReplayStage] = useState<string>("");
  const [replaySuccess, setReplaySuccess] = useState(false);

  const handleRunReplay = async () => {
    setIsReplaying(true);
    setReplayStage("Restoring state vector at Checkpoint Step " + selectedStep + "...");

    setTimeout(() => {
      setReplayStage("Dispatching alternative tool: " + alternativeTool + "...");
    }, 400);

    setTimeout(() => {
      setReplayStage("Re-evaluating downstream branches and synthesizing final response...");
    }, 800);

    try {
      const result = await replayFromCheckpoint({
        runId: run.runId,
        checkpointStep: selectedStep,
        alternativeAction: alternativeParams,
        toolName: alternativeTool,
      });

      setReplaySuccess(true);
      setReplayStage("Replay successful! Verification nominal.");

      setTimeout(() => {
        setIsReplaying(false);
        onReplayComplete(result);
      }, 600);
    } catch {
      setIsReplaying(false);
      setReplayStage("Replay simulation failed.");
    }
  };

  return (
    <div className={cn("rounded border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-semibold text-zinc-200 tracking-wide">
            CHECKPOINT REPLAY WORKBENCH
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
          Target: {run.runId}
        </span>
      </div>

      <div className="p-4 space-y-4 text-xs overflow-y-auto">
        {/* Step Selector */}
        <div className="flex items-center justify-between gap-3 p-3 rounded border border-zinc-800 bg-zinc-900/40">
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              CHECKPOINT STEP
            </label>
            <div className="font-mono text-sm text-zinc-200 font-bold mt-0.5">
              Step {selectedStep}
              {selectedStep === diagnosis?.predictedFailureStep && (
                <span className="ml-2 text-[10px] text-amber-400 font-normal bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/60">
                  Suspected Divergence
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-mono">Branch from:</span>
            <select
              value={selectedStep}
              onChange={(e) => setSelectedStep(Number(e.target.value))}
              aria-label="Branch from step"
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-zinc-700 cursor-pointer"
            >
              {run.steps.map((s) => (
                <option key={s.stepId} value={s.stepId}>
                  Step {s.stepId}: {s.title.slice(0, 24)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Side-by-Side: Original Action vs Alternative Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Original Action (Readonly) */}
          <div className="rounded border border-rose-900/40 bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-rose-400 font-semibold tracking-wider">
                ORIGINAL ACTION (FAILED)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {originalStep?.toolName || originalStep?.stepType}
              </span>
            </div>

            <div className="text-[11px] font-mono text-zinc-400">
              Tool: <span className="text-rose-300 font-medium">{originalStep?.toolName || "None"}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-500">PAYLOAD</span>
              <JsonViewer
                data={originalStep?.input || originalStep?.output || "{}"}
                maxHeight="max-h-36"
              />
            </div>
          </div>

          {/* Alternative Action (Interactive) */}
          <div className="rounded border border-emerald-900/60 bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                ALTERNATIVE ACTION (REPAIR)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Editable</span>
            </div>

            <div>
              <label className="text-[10px] font-mono text-zinc-400 block mb-1">
                REPLACEMENT TOOL
              </label>
              <input
                type="text"
                value={alternativeTool}
                onChange={(e) => setAlternativeTool(e.target.value)}
                placeholder="e.g. flight_inventory_search"
                className="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-zinc-400 block mb-1">
                TOOL ARGUMENTS / QUERY PAYLOAD
              </label>
              <textarea
                value={alternativeParams}
                onChange={(e) => setAlternativeParams(e.target.value)}
                rows={4}
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 leading-snug resize-none"
              />
            </div>
          </div>
        </div>

        {/* Loading / Status Simulation State */}
        {isReplaying && (
          <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60 flex items-center gap-3 font-mono text-xs">
            {replaySuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
            )}
            <span className={replaySuccess ? "text-emerald-300" : "text-zinc-300"}>
              {replayStage}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isReplaying}
              className="px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 font-mono text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleRunReplay}
            disabled={isReplaying}
            className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isReplaying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Replay...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Alternative Execution</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
