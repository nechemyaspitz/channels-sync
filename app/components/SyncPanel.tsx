"use client";

import { useState } from "react";

interface SyncLogEntry {
  timestamp: string;
  action: string;
  vimeoId: string;
  videoName: string;
  details: string;
}

interface SyncResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  log: SyncLogEntry[];
}

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
  skip: "text-gray-500",
  error: "text-red-500",
  publish: "text-purple-400",
};

export function SyncPanel({ password }: { password: string }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  const runSync = async (showcaseId?: string) => {
    setSyncing(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(showcaseId ? { showcaseId } : {}),
      });

      if (res.ok) {
        setResult(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Sync failed with status ${res.status}`);
      }
    } catch (err) {
      setError(`Network error: ${err}`);
    }

    setSyncing(false);
  };

  return (
    <section className="bg-gray-900 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Bulk Sync</h2>

      <div className="flex items-center gap-4">
        <button
          onClick={() => runSync()}
          disabled={syncing}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium text-sm transition-colors"
        >
          {syncing ? "Syncing..." : "Sync All Showcases"}
        </button>
        {syncing && (
          <span className="text-gray-400 text-sm">
            This may take a while...
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-2xl font-bold">{result.totalProcessed}</div>
              <div className="text-gray-500 text-xs">Total</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-2xl font-bold text-green-400">
                {result.created}
              </div>
              <div className="text-gray-500 text-xs">Created</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-2xl font-bold text-blue-400">
                {result.updated}
              </div>
              <div className="text-gray-500 text-xs">Updated</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-2xl font-bold text-gray-400">
                {result.skipped}
              </div>
              <div className="text-gray-500 text-xs">Skipped</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-2xl font-bold text-red-400">
                {result.errors}
              </div>
              <div className="text-gray-500 text-xs">Errors</div>
            </div>
          </div>

          {result.log.length > 0 && (
            <div className="bg-gray-800 rounded overflow-hidden">
              <div className="px-4 py-2 bg-gray-700/50 text-sm font-medium">
                Sync Log
              </div>
              <div className="max-h-96 overflow-y-auto">
                {result.log.map((entry, i) => (
                  <div
                    key={i}
                    className="px-4 py-2 border-t border-gray-700/50 text-sm flex items-start gap-3"
                  >
                    <span
                      className={`font-mono uppercase text-xs w-16 shrink-0 pt-0.5 ${ACTION_COLORS[entry.action] || "text-gray-400"}`}
                    >
                      {entry.action}
                    </span>
                    <span className="flex-1">
                      {entry.videoName && (
                        <span className="font-medium">{entry.videoName}</span>
                      )}
                      {entry.videoName && " — "}
                      <span className="text-gray-400">{entry.details}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
