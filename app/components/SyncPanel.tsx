"use client";

import { useState, useEffect, useCallback } from "react";

interface MappingEntry {
  webflowCategoryId: string;
  showcaseName: string;
  categoryName: string;
}

type Mapping = Record<string, MappingEntry>;

interface LogEntry {
  action: string;
  vimeoId: string;
  videoName: string;
  details: string;
}

interface SyncTotals {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
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
  const [mapping, setMapping] = useState<Mapping>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [totals, setTotals] = useState<SyncTotals | null>(null);
  const [error, setError] = useState("");

  const loadMapping = useCallback(async () => {
    try {
      const res = await fetch("/api/mapping", {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.ok) setMapping(await res.json());
    } catch {}
  }, [password]);

  useEffect(() => {
    loadMapping();
  }, [loadMapping]);

  const syncShowcase = async (showcaseId: string) => {
    setSyncing(showcaseId);
    setLogEntries([]);
    setTotals(null);
    setError("");

    let page = 1;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalVideos = 0;

    try {
      while (true) {
        setStatusMsg(
          totalVideos > 0
            ? `Syncing batch... (${Math.min((page - 1) * 10, totalVideos)}/${totalVideos})`
            : "Starting sync..."
        );

        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${password}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ showcaseId, page }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed with status ${res.status}`);
          break;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setError("Invalid response from server — the sync may have timed out. Try syncing again.");
          break;
        }

        totalCreated += data.created;
        totalUpdated += data.updated;
        totalSkipped += data.skipped;
        totalErrors += data.errors;
        totalVideos = data.total;

        setLogEntries((prev) => [...prev, ...data.log]);
        setTotals({
          total: totalCreated + totalUpdated + totalSkipped + totalErrors,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          errors: totalErrors,
        });

        if (!data.hasMore) {
          setStatusMsg(`Done! ${data.processed}/${data.total} videos processed.`);
          break;
        }

        page = data.nextPage;
      }
    } catch (err) {
      setError(`Network error: ${err}`);
    }

    setSyncing(null);
  };

  const syncAll = async () => {
    const ids = Object.keys(mapping);
    setLogEntries([]);
    setTotals(null);
    setError("");

    let allCreated = 0;
    let allUpdated = 0;
    let allSkipped = 0;
    let allErrors = 0;

    for (const id of ids) {
      setSyncing(id);
      setStatusMsg(`Syncing ${mapping[id]?.showcaseName || id}...`);

      let page = 1;
      let totalVideos = 0;

      try {
        while (true) {
          setStatusMsg(
            totalVideos > 0
              ? `Syncing ${mapping[id]?.showcaseName || id}... (${Math.min((page - 1) * 10, totalVideos)}/${totalVideos})`
              : `Syncing ${mapping[id]?.showcaseName || id}...`
          );

          const res = await fetch("/api/sync", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${password}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ showcaseId: id, page }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            setError(errData.error || `Failed with status ${res.status}`);
            allErrors++;
            break;
          }

          let data;
          try {
            data = await res.json();
          } catch {
            setError("Invalid response from server — the sync may have timed out.");
            allErrors++;
            break;
          }

          allCreated += data.created;
          allUpdated += data.updated;
          allSkipped += data.skipped;
          allErrors += data.errors;
          totalVideos = data.total;

          setLogEntries((prev) => [...prev, ...data.log]);
          setTotals({
            total: allCreated + allUpdated + allSkipped + allErrors,
            created: allCreated,
            updated: allUpdated,
            skipped: allSkipped,
            errors: allErrors,
          });

          if (!data.hasMore) break;
          page = data.nextPage;
        }
      } catch (err) {
        setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        allErrors++;
      }
    }

    setStatusMsg(`Done! Created: ${allCreated}, Updated: ${allUpdated}, Skipped: ${allSkipped}, Errors: ${allErrors}`);
    setSyncing(null);
  };

  const showcaseIds = Object.keys(mapping);

  if (showcaseIds.length === 0) {
    return (
      <section className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold">Bulk Sync</h2>
        <p className="text-gray-500 text-sm mt-2">
          No showcase mappings found. Set the SHOWCASE_MAPPING env var first.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-gray-900 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Bulk Sync</h2>

      <div className="space-y-2">
        {showcaseIds.map((id) => (
          <div
            key={id}
            className="flex items-center justify-between bg-gray-800 p-3 rounded"
          >
            <div>
              <span className="font-medium">{mapping[id].showcaseName}</span>
              <span className="text-gray-500 text-sm ml-2">
                → {mapping[id].categoryName}
              </span>
            </div>
            <button
              onClick={() => syncShowcase(id)}
              disabled={syncing !== null}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
            >
              {syncing === id ? "Syncing..." : "Sync"}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={syncAll}
        disabled={syncing !== null}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium text-sm transition-colors"
      >
        {syncing ? "Syncing..." : "Sync All"}
      </button>

      {statusMsg && (
        <p className="text-gray-400 text-sm">{statusMsg}</p>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-5 gap-4 text-center">
          <div className="bg-gray-800 rounded p-3">
            <div className="text-2xl font-bold">{totals.total}</div>
            <div className="text-gray-500 text-xs">Total</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="text-2xl font-bold text-green-400">{totals.created}</div>
            <div className="text-gray-500 text-xs">Created</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="text-2xl font-bold text-blue-400">{totals.updated}</div>
            <div className="text-gray-500 text-xs">Updated</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="text-2xl font-bold text-gray-400">{totals.skipped}</div>
            <div className="text-gray-500 text-xs">Skipped</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="text-2xl font-bold text-red-400">{totals.errors}</div>
            <div className="text-gray-500 text-xs">Errors</div>
          </div>
        </div>
      )}

      {logEntries.length > 0 && (
        <div className="bg-gray-800 rounded overflow-hidden">
          <div className="px-4 py-2 bg-gray-700/50 text-sm font-medium">
            Sync Log
          </div>
          <div className="max-h-96 overflow-y-auto">
            {logEntries.map((entry, i) => (
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
    </section>
  );
}
