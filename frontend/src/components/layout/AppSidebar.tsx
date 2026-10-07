"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Database,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Runs", href: "/runs", icon: Layers, badge: "8" },
  { name: "Traces", href: "/trace/run_0142", icon: Activity, badge: "DEMO" },
  { name: "Evaluation", href: "/evaluation", icon: BarChart3 },
  { name: "Datasets", href: "/datasets", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const AppSidebar: React.FC = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-800 bg-zinc-950/95 transition-all duration-200 select-none z-20 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="h-13 flex items-center justify-between px-3 border-b border-zinc-800/80">
        <Link
          href="/runs"
          className="flex items-center gap-2.5 overflow-hidden group focus:outline-none focus:ring-1 focus:ring-zinc-700 rounded px-1 py-1"
        >
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shrink-0 text-zinc-100 group-hover:border-zinc-500 transition-colors">
            <Terminal className="w-4 h-4 text-zinc-300" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold tracking-wider text-zinc-100 uppercase">
                BLACK BOX
              </span>
              <span className="text-[10px] text-zinc-400 font-mono leading-none">
                FLIGHT RECORDER
              </span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Telemetry Status Indicator */}
      <div className={cn("px-3 py-2 border-b border-zinc-800/60 bg-zinc-950", collapsed && "px-2 text-center")}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {!collapsed && (
            <span className="text-[11px] font-mono text-zinc-400 truncate">
              INGESTION: <span className="text-emerald-400 font-medium">LIVE</span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/runs" && item.href !== "/" && pathname?.startsWith(item.href)) ||
            (item.href === "/runs" && (pathname === "/runs" || pathname === "/"));

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors group relative",
                isActive
                  ? "bg-zinc-900 text-zinc-100 font-medium border border-zinc-800 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent"
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-zinc-200" : "text-zinc-400 group-hover:text-zinc-300"
                )}
              />
              {!collapsed && (
                <span className="truncate flex-1 tracking-tight">{item.name}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded border",
                    item.badge === "DEMO"
                      ? "border-amber-900/80 bg-amber-950/40 text-amber-400"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-400 font-mono">
        {!collapsed ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">TELEMETRY AGENT</span>
              <span className="text-zinc-400">v0.9.4</span>
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Radio className="w-3 h-3 text-zinc-400" />
              <span>buffer: 100% healthy</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-[10px] text-zinc-400">v0.9</div>
        )}
      </div>
    </aside>
  );
};
