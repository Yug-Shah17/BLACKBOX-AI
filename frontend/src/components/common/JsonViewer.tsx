"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
  title?: string;
  className?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxHeight = "max-h-60",
  title,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  let formatted = "";
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      formatted = JSON.stringify(parsed, null, 2);
    } catch {
      formatted = data;
    }
  } else {
    formatted = JSON.stringify(data, null, 2);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={cn("rounded border border-zinc-800 bg-zinc-950 overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/60 text-xs font-mono text-zinc-400">
          <span>{title}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Copy JSON to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre
        className={cn(
          "p-3 text-xs font-mono text-zinc-300 leading-relaxed overflow-x-auto overflow-y-auto whitespace-pre selection:bg-zinc-800",
          maxHeight
        )}
      >
        <code>{formatted}</code>
      </pre>
    </div>
  );
};
