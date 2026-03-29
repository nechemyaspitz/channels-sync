"use client";

import { useState, useEffect, useCallback } from "react";

interface MappingEntry {
  webflowCategoryId: string;
  showcaseName: string;
  categoryName: string;
}

type Mapping = Record<string, MappingEntry>;

interface ShowcaseProgress {
  status: "pending" | "syncing" | "done" | "error";
  processed: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorMessage?: string;
}

export function SyncPanel({ password }: { password: string }) {
  const [mapping, setMapping] = useState<Mapping>({});
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Record<string, ShowcaseProgress>>({});

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

  const updateShowcaseProgress = (id: string, update: Partial<ShowcaseProgress>) => {
    setProgress((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...update },
    }));
  };

  const syncShowcase = async (showcaseId: string) => {
    updateShowcaseProgress(showcaseId, {
      status: "syncing",
      processed: 0,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    });

    let page = 1;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    try {
      while (true) {
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
          updateShowcaseProgress(showcaseId, {
            status: "error",
            errorMessage: data.error || `Failed with status ${res.status}`,
          });
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          updateShowcaseProgress(showcaseId, {
            status: "error",
            errorMessage: "Response timed out. Try again.",
          });
          return;
        }

        created += data.created;
        updated += data.updated;
        skipped += data.skipped;
        errors += data.errors;

        updateShowcaseProgress(showcaseId, {
          status: data.hasMore ? "syncing" : "done",
          processed: data.processed,
          total: data.total,
          created,
          updated,
          skipped,
          errors,
        });

        if (!data.hasMore) break;
        page = data.nextPage;
      }
    } catch (err) {
      updateShowcaseProgress(showcaseId, {
        status: "error",
        errorMessage: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const syncOne = async (id: string) => {
    setSyncing(true);
    setProgress({});
    await syncShowcase(id);
    setSyncing(false);
  };

  const syncAll = async () => {
    const ids = Object.keys(mapping);
    setSyncing(true);

    // Initialize all as pending
    const initial: Record<string, ShowcaseProgress> = {};
    for (const id of ids) {
      initial[id] = { status: "pending", processed: 0, total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
    }
    setProgress(initial);

    for (const id of ids) {
      await syncShowcase(id);
    }
    setSyncing(false);
  };

  const showcaseIds = Object.keys(mapping);
  const hasProgress = Object.keys(progress).length > 0;

  // Compute grand totals from all showcases
  const totals = Object.values(progress).reduce(
    (acc, p) => ({
      created: acc.created + p.created,
      updated: acc.updated + p.updated,
      skipped: acc.skipped + p.skipped,
      errors: acc.errors + p.errors,
    }),
    { created: 0, updated: 0, skipped: 0, errors: 0 }
  );
  const allDone = hasProgress && Object.values(progress).every((p) => p.status === "done" || p.status === "error");

  if (showcaseIds.length === 0) {
    return (
      <section className="bg-gray-900 rounded-lg p-6">
        <p className="text-gray-500 text-sm">
          No showcase mappings found. Set the SHOWCASE_MAPPING env var first.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Showcase list with sync buttons */}
      <section className="bg-gray-900 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Showcases</h2>
          <button
            onClick={syncAll}
            disabled={syncing}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
          >
            {syncing ? "Syncing..." : "Sync All"}
          </button>
        </div>

        {showcaseIds.map((id) => {
          const p = progress[id];
          const isSyncing = p?.status === "syncing";
          const isDone = p?.status === "done";
          const isError = p?.status === "error";
          const pct = p && p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;

          return (
            <div key={id} className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  {/* Status indicator */}
                  {isSyncing && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                  {isDone && <span className="w-2 h-2 rounded-full bg-green-400" />}
                  {isError && <span className="w-2 h-2 rounded-full bg-red-400" />}
                  {!p && <span className="w-2 h-2 rounded-full bg-gray-600" />}
                  {p?.status === "pending" && <span className="w-2 h-2 rounded-full bg-gray-500" />}

                  <span className="font-medium text-sm">{mapping[id].showcaseName}</span>
                  <span className="text-gray-500 text-xs">→ {mapping[id].categoryName}</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Inline stats when syncing or done */}
                  {p && (p.status === "syncing" || p.status === "done") && (
                    <div className="flex gap-2 text-xs">
                      {p.created > 0 && <span className="text-green-400">+{p.created}</span>}
                      {p.updated > 0 && <span className="text-blue-400">{p.updated} upd</span>}
                      {p.skipped > 0 && <span className="text-gray-500">{p.skipped} skip</span>}
                      {p.errors > 0 && <span className="text-red-400">{p.errors} err</span>}
                    </div>
                  )}

                  <button
                    onClick={() => syncOne(id)}
                    disabled={syncing}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
                  >
                    Sync
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {isSyncing && (
                <div className="h-1 bg-gray-700">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {isDone && <div className="h-1 bg-green-500" />}
              {isError && (
                <>
                  <div className="h-1 bg-red-500" />
                  <p className="px-3 py-2 text-red-400 text-xs">{p.errorMessage}</p>
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* Grand totals — shown once syncing starts */}
      {hasProgress && (
        <section className="bg-gray-900 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              {allDone ? "Results" : "Progress"}
            </h2>
            {!allDone && (
              <span className="text-xs text-gray-500 animate-pulse">Syncing...</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xl font-bold text-green-400">{totals.created}</div>
              <div className="text-gray-500 text-xs mt-0.5">Created</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xl font-bold text-blue-400">{totals.updated}</div>
              <div className="text-gray-500 text-xs mt-0.5">Updated</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xl font-bold text-gray-400">{totals.skipped}</div>
              <div className="text-gray-500 text-xs mt-0.5">Skipped</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xl font-bold text-red-400">{totals.errors}</div>
              <div className="text-gray-500 text-xs mt-0.5">Errors</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
