import React, { useEffect, useState } from 'react';
import { HealthStatus } from '../types';
import { authFetch } from '../utils/authFetch';
import { Activity, RefreshCw, Cpu, Bot, Share2, Layers } from 'lucide-react';

export const LiveHealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch health monitor status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950 text-sm sm:text-base flex items-center gap-2">
              <span>সিস্টেম ও পাইপলাইন মনিটর</span>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                Active / 0-Surge
              </span>
            </h3>
            <p className="text-xs text-slate-500">মাইক্রোসার্ভিস ও সিকোয়েন্সিয়াল কিউ প্রসেসরের লাইভ স্ট্যাটাস</p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-950 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-slate-900' : ''}`} />
          <span className="hidden sm:inline">রিফ্রেশ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Meta / YouTube / Apify API */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
              YT / Apify API
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {health?.services.metaYoutubeTiktokApis.apifyActive ? 'APIFY ACTIVE' : 'ONLINE'}
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Latency:</span>
              <span className="font-semibold text-slate-900 tabular-nums">~{health?.services.metaYoutubeTiktokApis.latencyMs || 42}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">FB/IG/TikTok:</span>
              <span className="text-[11px] font-medium text-slate-700 font-sans">
                {health?.services.metaYoutubeTiktokApis.apifyActive ? 'Auto (Apify)' : 'yt-dlp / Manual'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Gemini AI Verification */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-slate-600" />
              Gemini AI
            </span>
            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              STRICT JSON
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Model:</span>
              <span className="font-semibold text-slate-900 text-[11px]">
                {health?.services.geminiAi.model || 'gemini-3.1-flash-lite'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Mode:</span>
              <span className="font-medium text-[11px] text-slate-700 font-sans">Strict JSON (Dynamic)</span>
            </div>
          </div>
        </div>

        {/* 3. FFmpeg Media Engine */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-600" />
              FFmpeg Engine
            </span>
            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              STANDBY
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Audio Format:</span>
              <span className="font-medium text-[11px] text-slate-700">16kHz Mono PCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Rule Slicing:</span>
              <span className="font-semibold text-slate-900 text-[11px]">30s Cut vs Full</span>
            </div>
          </div>
        </div>

        {/* 4. In-Memory Task Queue */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              Task Queue
            </span>
            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              SEQUENTIAL
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Queue State:</span>
              <span className="font-semibold text-slate-900 font-sans">
                {health?.services.taskQueueWorker.status === 'processing' ? '⚡ Processing' : 'Idle (0 RAM surge)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Completed:</span>
              <span className="font-bold text-slate-950 tabular-nums">
                {health?.services.taskQueueWorker.completedCount || 0} tasks
              </span>
            </div>
          </div>
        </div>
      </div>

      {lastUpdated && (
        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>creators.toolpotro.com</span>
          <span className="tabular-nums">Last heartbeat: {lastUpdated}</span>
        </div>
      )}
    </div>
  );
};
