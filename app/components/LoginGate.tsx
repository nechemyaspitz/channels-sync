"use client";

import { useState } from "react";

export function LoginGate({ onLogin }: { onLogin: (pw: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Verify by hitting a protected endpoint
    const res = await fetch("/api/mapping", {
      headers: { Authorization: `Bearer ${input}` },
    });

    if (res.ok) {
      onLogin(input);
    } else {
      setError("Invalid password");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="space-y-4 w-80">
        <h1 className="text-xl font-bold text-center">Channels Sync</h1>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Admin password"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
        >
          Sign In
        </button>
      </form>
    </main>
  );
}
