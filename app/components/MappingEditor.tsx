"use client";

import { useState, useEffect, useCallback } from "react";

interface Showcase {
  uri: string;
  name: string;
  metadata: { connections: { videos: { total: number } } };
}

interface Category {
  id: string;
  fieldData: { name: string; slug: string };
}

interface MappingEntry {
  webflowCategoryId: string;
  showcaseName: string;
  categoryName: string;
}

type Mapping = Record<string, MappingEntry>;

function extractId(uri: string): string {
  const match = uri.match(/\/albums\/(\d+)/);
  return match ? match[1] : uri;
}

export function MappingEditor({ password }: { password: string }) {
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");

  const loadData = useCallback(async () => {
    const headers = { Authorization: `Bearer ${password}` };
    setLoading(true);
    try {
      const [scRes, catRes, mapRes] = await Promise.all([
        fetch("/api/showcases", { headers }),
        fetch("/api/categories", { headers }),
        fetch("/api/mapping", { headers }),
      ]);

      if (scRes.ok) setShowcases(await scRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (mapRes.ok) setMapping(await mapRes.json());
    } catch (err) {
      setStatus(`Error loading data: ${err}`);
    }
    setLoading(false);
  }, [password]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateMapping = (showcaseId: string, categoryId: string) => {
    const showcase = showcases.find((s) => extractId(s.uri) === showcaseId);
    const category = categories.find((c) => c.id === categoryId);

    if (!showcase || !category) return;

    setMapping((prev) => ({
      ...prev,
      [showcaseId]: {
        webflowCategoryId: categoryId,
        showcaseName: showcase.name,
        categoryName: String(category.fieldData.name),
      },
    }));
  };

  const removeMapping = (showcaseId: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[showcaseId];
      return next;
    });
  };

  const mappingJson = JSON.stringify(mapping);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(mappingJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <section className="bg-gray-900 rounded-lg p-6">
        <p className="text-gray-400">Loading showcases and categories...</p>
      </section>
    );
  }

  const hasMappings = Object.keys(mapping).length > 0;

  return (
    <section className="bg-gray-900 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Showcase → Category Mapping</h2>

      <div className="space-y-3">
        {showcases.map((showcase) => {
          const scId = extractId(showcase.uri);
          const currentMapping = mapping[scId];

          return (
            <div
              key={scId}
              className="flex items-center gap-4 bg-gray-800 p-3 rounded"
            >
              <div className="flex-1">
                <span className="font-medium">{showcase.name}</span>
                <span className="text-gray-500 text-sm ml-2">
                  ({showcase.metadata.connections.videos.total} videos)
                </span>
              </div>
              <span className="text-gray-500">→</span>
              <select
                value={currentMapping?.webflowCategoryId || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    updateMapping(scId, e.target.value);
                  } else {
                    removeMapping(scId);
                  }
                }}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Not mapped --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {String(cat.fieldData.name)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {showcases.length === 0 && (
        <p className="text-gray-500 text-sm">
          No showcases found. Check your Vimeo API token.
        </p>
      )}

      {hasMappings && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Copy this JSON and set it as <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">SHOWCASE_MAPPING</code> in your Vercel environment variables, then redeploy.
            </label>
            <div className="relative">
              <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 overflow-x-auto">
                {JSON.stringify(mapping, null, 2)}
              </pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <span className="text-sm text-gray-400">{status}</span>
      )}
    </section>
  );
}
