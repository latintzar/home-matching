"use client";
import {appFetch as fetch} from '@/lib/app-path';

import { useState, useEffect, useCallback } from "react";

interface HarvesterProgress {
  current: number;
  total: number;
  percent: number;
}

interface HarvesterStats {
  totalNewFound: number;
  writtenToDynamo: number;
  newInDb: number;
  updatedInDb: number;
}

interface Harvester {
  id: string;
  name: string;
  lambda: string;
  domain: string;
  status: "complete" | "running" | "idle" | "stale";
  phase: string | null;
  invocation: number;
  maxInvocations: number;
  progress: HarvesterProgress;
  dbCount: number;
  stats: HarvesterStats;
  lastActivity: string | null;
}

interface HarvesterData {
  harvesters: Harvester[];
  totalDbCount: number;
  timestamp: string;
}

const STATUS_COLORS = {
  complete: "bg-green-100 text-green-800 border-green-300",
  running: "bg-blue-100 text-blue-800 border-blue-300",
  idle: "bg-gray-100 text-gray-600 border-gray-300",
  stale: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

const STATUS_ICONS = {
  complete: "✅",
  running: "🔄",
  idle: "⏸️",
  stale: "⚠️",
};

const formatTimeAgo = (dateStr: string | null): string => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const HarvesterCard = ({ 
  harvester, 
  onInvoke, 
  invoking 
}: { 
  harvester: Harvester; 
  onInvoke: (lambda: string) => void;
  invoking: string | null;
}) => {
  const isInvoking = invoking === harvester.lambda;
  const needsInvoke = harvester.status === "stale" || (harvester.status !== "complete" && harvester.status !== "running");

  return (
    <div className={`border rounded-lg p-4 ${harvester.status === "running" ? "ring-2 ring-blue-400" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{STATUS_ICONS[harvester.status]}</span>
          <h3 className="font-semibold text-lg">{harvester.name}</h3>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[harvester.status]}`}>
          {harvester.status.toUpperCase()}
        </span>
      </div>

      {/* Phase & Invocation */}
      {harvester.phase && (
        <div className="text-sm text-gray-600 mb-2">
          Phase: <span className="font-medium">{harvester.phase}</span>
          {harvester.invocation > 0 && (
            <span className="ml-2">
              (inv {harvester.invocation}/{harvester.maxInvocations})
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {harvester.progress.total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{harvester.progress.current.toLocaleString()} / {harvester.progress.total.toLocaleString()}</span>
            <span>{harvester.progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                harvester.status === "running" ? "bg-blue-500" : 
                harvester.status === "complete" ? "bg-green-500" : "bg-yellow-500"
              }`}
              style={{ width: `${Math.min(harvester.progress.percent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500 text-xs">DB Count</div>
          <div className="font-semibold">{harvester.dbCount.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500 text-xs">Last Activity</div>
          <div className="font-semibold">{formatTimeAgo(harvester.lastActivity)}</div>
        </div>
      </div>

      {/* Stats Row */}
      {(harvester.stats.newInDb > 0 || harvester.stats.updatedInDb > 0) && (
        <div className="text-xs text-gray-500 mb-3">
          New: {harvester.stats.newInDb} | Updated: {harvester.stats.updatedInDb}
        </div>
      )}

      {/* Invoke Button */}
      <button
        onClick={() => onInvoke(harvester.lambda)}
        disabled={isInvoking || harvester.status === "running"}
        className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors ${
          harvester.status === "running"
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : needsInvoke
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        } ${isInvoking ? "opacity-50" : ""}`}
      >
        {isInvoking ? "Invoking..." : harvester.status === "running" ? "Running..." : needsInvoke ? "⚡ Invoke Now" : "Invoke"}
      </button>
    </div>
  );
};

export default function HarvesterDashboard() {
  const [data, setData] = useState<HarvesterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/harvesters");
      if (!response.ok) throw new Error("Failed to fetch status");
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInvoke = async (lambda: string) => {
    setInvoking(lambda);
    try {
      const response = await fetch("/api/admin/harvesters/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lambda }),
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to invoke");
      }
      
      // Refresh status after short delay
      setTimeout(fetchStatus, 2000);
    } catch (err: any) {
      alert(`Failed to invoke ${lambda}: ${err.message}`);
    } finally {
      setInvoking(null);
    }
  };

  const handleInvokeAll = async () => {
    const toInvoke = data?.harvesters.filter(h => h.status !== "running" && h.status !== "complete") || [];
    for (const harvester of toInvoke) {
      await handleInvoke(harvester.lambda);
      await new Promise(r => setTimeout(r, 500)); // Small delay between invokes
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading harvesters...</div>
      </div>
    );
  }

  const runningCount = data?.harvesters.filter(h => h.status === "running").length || 0;
  const staleCount = data?.harvesters.filter(h => h.status === "stale").length || 0;
  const completeCount = data?.harvesters.filter(h => h.status === "complete").length || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🌾 Harvester Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Total: <strong>{data?.totalDbCount.toLocaleString()}</strong> listings</span>
            <span>|</span>
            <span className="text-blue-600">🔄 {runningCount} running</span>
            <span className="text-yellow-600">⚠️ {staleCount} stale</span>
            <span className="text-green-600">✅ {completeCount} complete</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
          <button
            onClick={fetchStatus}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
          >
            🔄 Refresh
          </button>
          
          <button
            onClick={handleInvokeAll}
            disabled={staleCount === 0}
            className={`px-4 py-2 rounded font-medium text-sm ${
              staleCount > 0 
                ? "bg-orange-500 hover:bg-orange-600 text-white" 
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            ⚡ Invoke All Stale ({staleCount})
          </button>

          <label className="flex items-center gap-2 ml-auto">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh (30s)</span>
          </label>

          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* Harvester Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.harvesters.map((harvester) => (
            <HarvesterCard
              key={harvester.id}
              harvester={harvester}
              onInvoke={handleInvoke}
              invoking={invoking}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold mb-2">Status Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded border ${STATUS_COLORS.running}`}>RUNNING</span>
              <span className="text-gray-600">Active in Lambda</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded border ${STATUS_COLORS.stale}`}>STALE</span>
              <span className="text-gray-600">Needs re-invoke</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded border ${STATUS_COLORS.complete}`}>COMPLETE</span>
              <span className="text-gray-600">Fully harvested</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded border ${STATUS_COLORS.idle}`}>IDLE</span>
              <span className="text-gray-600">No active state</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
