"use client";

import { useState } from "react";
import { LoginGate } from "./components/LoginGate";
import { SyncPanel } from "./components/SyncPanel";

export default function Home() {
  const [password, setPassword] = useState("");

  if (!password) {
    return <LoginGate onLogin={setPassword} />;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Channels Sync</h1>
          <p className="text-gray-400 mt-1">
            Vimeo Showcases → Webflow CMS
          </p>
        </header>

        <SyncPanel password={password} />
      </div>
    </main>
  );
}
