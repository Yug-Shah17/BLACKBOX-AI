"use client";

import React from "react";
import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";

interface AppShellProps {
  children: React.ReactNode;
  currentRunId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentRunId,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Collapsible Left Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top telemetry & command bar */}
        <TopHeader
          currentRunId={currentRunId}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Scrollable Engineering Workspace */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-950">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
