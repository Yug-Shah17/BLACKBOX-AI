"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AgentRun, FailureType, RunOutcome } from "@/types/telemetry";
import { RunStatusBadge, FailureTypeBadge } from "../common/RunStatusBadge";
import { ConfidenceIndicator } from "../common/ConfidenceIndicator";
import { formatDuration, formatTimestamp } from "@/lib/utils";
import { Search, AlertCircle, ArrowUpRight, Filter } from "lucide-react";

interface RunsTableProps {
  runs: AgentRun[];
}

export const RunsTable: React.FC<RunsTableProps> = ({ runs }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunOutcome | "all">("all");
  const [failureTypeFilter, setFailureTypeFilter] = useState<FailureType | "all">("all");

  // Compact metrics for header
  const stats = useMemo(() => {
    const total = runs.length;
    const failed = runs.filter((r) => r.outcome === "failed").length;
    const success = runs.filter((r) => r.outcome === "success").length;
    const diagnosedCount = runs.filter((r) => r.predictedFailureStep !== undefined).length;
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "0";

    return { total, failed, success, diagnosedCount, failureRate };
  }, [runs]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Search
      const matchesSearch =
        run.runId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.task.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (run.failureType && run.failureType.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status
      if (statusFilter !== "all" && run.outcome !== statusFilter) {
        return false;
      }

      // Failure type
      if (failureTypeFilter !== "all" && run.failureType !== failureTypeFilter) {
        return false;
      }

      return true;
    });
  }, [runs, searchQuery, statusFilter, failureTypeFilter]);

  return (
    <div className="space-y-4">
      {/* Compact Top Summary Strip (2-3 items max as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="px-3.5 py-2.5 rounded border border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              RECORDED RUNS
            </span>
            <div className="text-xl font-mono font-semibold text-zinc-100 mt-0.5">
              {stats.total}
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {stats.success} pass / {stats.failed} fail
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded border border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              FAILURE RATE
            </span>
            <div className="text-xl font-mono font-semibold text-rose-400 mt-0.5">
              {stats.failureRate}%
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {stats.failed} triage required
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded border border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              ROOT-CAUSE LOCALIZED
            </span>
            <div className="text-xl font-mono font-semibold text-amber-400 mt-0.5">
              {stats.diagnosedCount}
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            avg 91% conf
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded border border-zinc-800 bg-zinc-900/40">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["all", "failed", "success", "running"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                statusFilter === status
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              {status === "all" ? "All Runs" : status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 font-mono text-[10px] text-zinc-400">
                {status === "all"
                  ? runs.length
                  : runs.filter((r) => r.outcome === status).length}
              </span>
            </button>
          ))}
        </div>

        {/* Right side: Search & Failure Filter */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter by run, task, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 font-sans"
            />
          </div>

          {/* Failure Type Select */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-zinc-400 hidden md:block" />
            <select
              value={failureTypeFilter}
              onChange={(e) => setFailureTypeFilter(e.target.value as FailureType | "all")}
              aria-label="Filter by failure type"
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-zinc-600 cursor-pointer font-mono"
            >
              <option value="all">All Failure Types</option>
              <option value="wrong_tool">wrong_tool</option>
              <option value="wrong_argument">wrong_argument</option>
              <option value="bad_retrieval">bad_retrieval</option>
              <option value="premature_completion">premature_completion</option>
              <option value="tool_error">tool_error</option>
              <option value="incorrect_branch">incorrect_branch</option>
              <option value="context_loss">context_loss</option>
              <option value="timeout">timeout</option>
              <option value="repeated_action">repeated_action</option>
            </select>
          </div>
        </div>
      </div>

      {/* Engineering Table */}
      <div className="rounded border border-zinc-800 bg-zinc-950/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/70 font-mono text-[11px] text-zinc-400 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 font-medium">Run ID</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Task & Context</th>
                <th className="py-2.5 px-3 font-medium">Agent</th>
                <th className="py-2.5 px-3 font-medium text-right">Steps</th>
                <th className="py-2.5 px-3 font-medium text-right">Duration</th>
                <th className="py-2.5 px-3 font-medium">Diagnosis & Localization</th>
                <th className="py-2.5 px-3 font-medium text-right">Time</th>
                <th className="py-2.5 px-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400 font-mono">
                    No recorded agent runs match filter criteria
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => {
                  const isShowcase = run.runId === "run_0142";

                  return (
                    <tr
                      key={run.runId}
                      className={`group hover:bg-zinc-900/60 transition-colors ${
                        isShowcase ? "bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Run ID */}
                      <td className="py-3 px-3 font-mono font-medium text-zinc-200 whitespace-nowrap">
                        <Link
                          href={`/trace/${run.runId}`}
                          className="hover:underline flex items-center gap-1.5 group-hover:text-zinc-100"
                        >
                          <span>{run.runId}</span>
                          {isShowcase && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-900/40 text-amber-400 border border-amber-800/60 font-mono font-normal">
                              DEMO
                            </span>
                          )}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <RunStatusBadge outcome={run.outcome} />
                      </td>

                      {/* Task */}
                      <td className="py-3 px-4 max-w-xs md:max-w-md">
                        <Link
                          href={`/trace/${run.runId}`}
                          className="block text-zinc-200 hover:text-zinc-100 truncate font-medium"
                          title={run.task}
                        >
                          {run.task}
                        </Link>
                      </td>

                      {/* Agent */}
                      <td className="py-3 px-3 font-mono text-zinc-400 whitespace-nowrap">
                        {run.agentName}
                      </td>

                      {/* Steps */}
                      <td className="py-3 px-3 text-right font-mono text-zinc-300 tnum whitespace-nowrap">
                        {run.steps.length}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-right font-mono text-zinc-400 tnum whitespace-nowrap">
                        {formatDuration(run.durationMs)}
                      </td>

                      {/* Diagnosis & Localization */}
                      <td className="py-3 px-3">
                        {run.predictedFailureStep ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-amber-400 font-medium text-xs flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                Step {run.predictedFailureStep}
                              </span>
                              {run.failureType && (
                                <FailureTypeBadge type={run.failureType} />
                              )}
                            </div>
                            {run.diagnosisConfidence && (
                              <ConfidenceIndicator
                                confidence={run.diagnosisConfidence}
                                className="scale-90 origin-left"
                              />
                            )}
                          </div>
                        ) : run.outcome === "success" ? (
                          <span className="text-zinc-400 text-xs font-mono">
                            Verified nominal
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs font-mono">
                            Analyzing...
                          </span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                        {formatTimestamp(run.timestamp)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Link
                          href={`/trace/${run.runId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-mono transition-colors"
                        >
                          <span>Inspect</span>
                          <ArrowUpRight className="w-3 h-3 text-zinc-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
