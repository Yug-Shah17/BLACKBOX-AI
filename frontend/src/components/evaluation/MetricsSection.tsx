"use client";

import React from "react";
import { ModelMetrics } from "@/types/telemetry";
import { FailureTypeBadge } from "../common/RunStatusBadge";
import { BarChart3, Target, ShieldCheck, Database, Layers } from "lucide-react";

interface MetricsSectionProps {
  metrics: ModelMetrics;
}

export const MetricsSection: React.FC<MetricsSectionProps> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
            <span>TOP-1 LOCALIZATION ACCURACY</span>
            <Target className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1.5 tnum">
            {(metrics.top1Accuracy * 100).toFixed(1)}%
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            Exact step identification
          </span>
        </div>

        <div className="p-3.5 rounded border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
            <span>TOP-3 LOCALIZATION ACCURACY</span>
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-sky-400 mt-1.5 tnum">
            {(metrics.top3Accuracy * 100).toFixed(1)}%
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            Within ±1 step neighborhood
          </span>
        </div>

        <div className="p-3.5 rounded border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
            <span>AVERAGE CONFIDENCE</span>
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-1.5 tnum">
            {(metrics.averageConfidence * 100).toFixed(1)}%
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            Across 440 failed traces
          </span>
        </div>

        <div className="p-3.5 rounded border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
            <span>RUNS EVALUATED</span>
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-zinc-100 mt-1.5 tnum">
            {metrics.totalRunsEvaluated}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            {metrics.successfulRuns} pass / {metrics.failedRuns} fail
          </span>
        </div>
      </div>

      {/* Failure Category Distribution Table */}
      <div className="rounded border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wide">
              Failure Category Distribution & Diagnostic Precision
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {metrics.categoryDistribution.length} taxonomy categories
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 font-mono text-[11px] text-zinc-400 uppercase">
                <th className="py-2.5 px-4 font-medium">Failure Category</th>
                <th className="py-2.5 px-3 font-medium text-right">Count</th>
                <th className="py-2.5 px-4 font-medium">Taxonomy Share</th>
                <th className="py-2.5 px-3 font-medium text-right">Top-1 Accuracy</th>
                <th className="py-2.5 px-4 font-medium">Model Calibration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 font-mono">
              {metrics.categoryDistribution.map((item) => {
                const accPercent = Math.round(item.top1Accuracy * 100);

                return (
                  <tr key={item.category} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <FailureTypeBadge type={item.category} />
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-300 tnum">
                      {item.count}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-400"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-[11px] tnum">{item.percentage}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-zinc-200 tnum">
                      {accPercent}%
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400"
                          style={{ width: `${accPercent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Held-Out Evaluation Benchmarks */}
      <div className="rounded border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wide">
              Performance On Held-Out / Unseen Failure Datasets
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">
            Zero-shot generalizability
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] text-zinc-400 uppercase">
                <th className="py-2.5 px-4 font-medium">Benchmark Dataset</th>
                <th className="py-2.5 px-3 font-medium text-right">Runs</th>
                <th className="py-2.5 px-3 font-medium text-right">Accuracy</th>
                <th className="py-2.5 px-3 font-medium text-right">F1 Score</th>
                <th className="py-2.5 px-3 font-medium text-right">Mean Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {metrics.heldOutEvaluation.map((b) => (
                <tr key={b.dataset} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="py-2.5 px-4 font-sans font-medium text-zinc-200">
                    {b.dataset}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-400 tnum">
                    {b.runsCount}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-medium tnum">
                    {(b.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-sky-400 tnum">
                    {b.f1Score.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-400 tnum">
                    {b.meanLatencyMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
