"use client";

import React, { useState } from "react";
import { TraceStep } from "@/types/telemetry";
import { cn } from "@/lib/utils";
import { JsonViewer } from "../common/JsonViewer";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Wrench,
  Cpu,
  Database,
  GitBranch,
  Send,
  RotateCcw,
} from "lucide-react";

interface TraceStepItemProps {
  step: TraceStep;
  isSuspected?: boolean;
  confidence?: number;
  isSelected?: boolean;
  onSelect?: (step: TraceStep) => void;
  onReplayFromStep?: (stepId: number) => void;
}

export const TraceStepItem: React.FC<TraceStepItemProps> = ({
  step,
  isSuspected = false,
  confidence,
  isSelected = false,
  onSelect,
  onReplayFromStep,
}) => {
  const [expanded, setExpanded] = useState(isSuspected);

  // Icon based on step type
  const getStepTypeIcon = () => {
    switch (step.stepType) {
      case "model_call":
        return <Cpu className="w-3.5 h-3.5 text-sky-400" />;
      case "tool_call":
        return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      case "retrieval":
        return <Database className="w-3.5 h-3.5 text-indigo-400" />;
      case "decision":
        return <GitBranch className="w-3.5 h-3.5 text-violet-400" />;
      case "final_answer":
        return <Send className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  // Status icon
  const getStatusIcon = () => {
    if (isSuspected || step.status === "warning") {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (step.status === "failed") {
      return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  };

  const formattedStepId = String(step.stepId).padStart(2, "0");

  return (
    <div
      className={cn(
        "group rounded border transition-colors relative overflow-hidden select-none",
        isSuspected
          ? "border-amber-700/80 bg-amber-950/20 shadow-xs"
          : isSelected
          ? "border-zinc-700 bg-zinc-900/80"
          : "border-zinc-850 bg-zinc-950/70 hover:bg-zinc-900/40 hover:border-zinc-800"
      )}
    >
      {/* Left indicator marker */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          isSuspected
            ? "bg-amber-500"
            : step.status === "failed"
            ? "bg-rose-500"
            : step.status === "warning"
            ? "bg-amber-500/60"
            : "bg-transparent group-hover:bg-zinc-700"
        )}
      />

      {/* Main Header / Summary Bar */}
      <div
        onClick={() => {
          setExpanded(!expanded);
          if (onSelect) onSelect(step);
        }}
        className="pl-3.5 pr-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
            if (onSelect) onSelect(step);
          }
        }}
      >
        {/* Left: Step # + Type + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="text-zinc-500 hover:text-zinc-300 p-0.5"
            aria-label={expanded ? "Collapse step details" : "Expand step details"}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <span className="font-mono text-xs text-zinc-400 font-semibold tnum">
            {formattedStepId}
          </span>

          {getStatusIcon()}

          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 shrink-0">
            {getStepTypeIcon()}
            <span>{step.stepType}</span>
          </div>

          {step.toolName && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-900/60 text-amber-300 shrink-0">
              {step.toolName}
            </span>
          )}

          <span className="text-xs font-medium text-zinc-200 truncate">
            {step.title}
          </span>
        </div>

        {/* Right: Badges, Telemetry (Latency, Tokens), and Replay Action */}
        <div className="flex items-center gap-3 shrink-0">
          {isSuspected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-800/80 bg-amber-950/60 text-amber-300 text-[11px] font-mono font-medium">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>SUSPECTED FAILURE</span>
              {confidence && <span className="tnum font-bold">({Math.round(confidence * 100)}%)</span>}
            </span>
          )}

          <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span className="tnum">{step.latencyMs}ms</span>
            </span>

            {step.tokenCount !== undefined && (
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-zinc-400" />
                <span className="tnum">{step.tokenCount}</span>
              </span>
            )}
          </div>

          {onReplayFromStep && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplayFromStep(step.stepId);
              }}
              className="px-2 py-1 text-[11px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 flex items-center gap-1 transition-colors cursor-pointer"
              title={`Replay from Step ${step.stepId}`}
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span className="hidden md:inline">Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Step Inspector Details */}
      {expanded && (
        <div className="border-t border-zinc-800/80 bg-zinc-950/90 p-4 space-y-3 select-text">
          {/* Metadata bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-zinc-850 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block text-[10px]">STEP STATUS</span>
              <span
                className={cn(
                  "font-medium uppercase",
                  step.status === "failed"
                    ? "text-rose-400"
                    : isSuspected
                    ? "text-amber-400"
                    : "text-emerald-400"
                )}
              >
                {step.status}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">LATENCY</span>
              <span className="text-zinc-200">{step.latencyMs}ms</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">TOKENS CONSUMED</span>
              <span className="text-zinc-200">{step.tokenCount ?? "N/A"}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">SUSPICION SCORE</span>
              <span className="text-zinc-200">
                {step.suspicionScore ? `${Math.round(step.suspicionScore * 100)}%` : "Nominal"}
              </span>
            </div>
          </div>

          {/* Input Payload */}
          {step.input && (
            <div>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Input Payload
              </span>
              <JsonViewer data={step.input} maxHeight="max-h-48" />
            </div>
          )}

          {/* Output Payload */}
          {step.output && (
            <div>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Output Return
              </span>
              <JsonViewer data={step.output} maxHeight="max-h-56" />
            </div>
          )}

          {/* Raw Metadata / State */}
          {step.metadata && Object.keys(step.metadata).length > 0 && (
            <div>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Step Telemetry & Internal State
              </span>
              <JsonViewer data={step.metadata} maxHeight="max-h-40" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
