
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Database, Network, Sparkles, GitBranch, ShieldCheck, Activity } from 'lucide-react';
import { api } from '../lib/api';

const FEATURES = [
  { icon: Network, title: 'Async scatter-gather', desc: 'Parallel query execution across N shards with sub-second fan-in.' },
  { icon: GitBranch, title: 'Predicate pushdown', desc: 'Column min/max stats prune provably-empty shards at query time.' },
  { icon: Activity, title: 'Adaptive routing', desc: 'Rolling P50 latency history routes targeted queries to fastest shard.' },
  { icon: ShieldCheck, title: 'Heartbeat & recovery', desc: 'Dead-shard detection with automatic re-admission on recovery.' },
  { icon: Database, title: 'WAL-backed registry', desc: 'ACID-compliant SQLite metadata store. No JSON corruption possible.' },
  { icon: Sparkles, title: 'AI SQL Copilot', desc: 'Natural language → SQL using your live schema. Powered by Gemini.' }
];

export default function Landing() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api.engineInfo().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-56px)] overflow-hidden text-slate-200">
      {/* Hero Section */}
      <section className="relative px-6 lg:px-12 pt-20 pb-16 max-w-7xl mx-auto">
        <div>
          <div className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase">
            distributed query engine • v3.0
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mt-4 max-w-5xl leading-[1.05]">
            Forge SQL at <span className="text-cyan-400">cluster speed</span>,<br/>from a single file.
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mt-6 leading-relaxed">
            Drop any CSV. QueryForge auto-shards it, computes column statistics, and serves your SQL with predicate pushdown, adaptive routing, and live fault tolerance — all wrapped in an AI copilot that turns plain English into SQL.
          </p>
          <div className="flex flex-wrap gap-4 mt-8">
            <button onClick={() => navigate('/ingest')} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all uppercase tracking-wider shadow-lg shadow-indigo-600/10 group">
              Get Started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => navigate('/console')} className="px-6 py-3 bg-slate-900/50 hover:bg-slate-800/60 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg font-bold text-xs transition-all uppercase tracking-wider">
              Open Console
            </button>
            <button onClick={() => navigate('/cluster')} className="px-6 py-3 bg-slate-900/50 hover:bg-slate-800/60 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg font-bold text-xs transition-all uppercase tracking-wider">
              See Live Cluster
            </button>
          </div>
          {info && (
            <div className="mt-12 flex flex-wrap gap-8 font-mono text-xs text-slate-400 border-t border-slate-800 pt-6 items-center">
              <div><span className="text-cyan-400 font-bold text-xl mr-1.5">{info.table_count || 0}</span> tables registered</div>
              <div><span className="text-indigo-400 font-bold text-xl mr-1.5">{info.total_shards || 0}</span> live shards</div>
              <div><span className="text-emerald-400 font-bold text-xl mr-1.5">{(info.total_rows || 0).toLocaleString()}</span> rows under management</div>
              <div className="flex items-center gap-2 ml-auto"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /><span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">engine online</span></div>
            </div>
          )}
        </div>
        <div className="absolute -right-32 top-20 w-[400px] h-[400px] pointer-events-none opacity-20 rounded-full blur-[120px] bg-cyan-400" />
        <div className="absolute -left-32 bottom-0 w-[500px] h-[500px] pointer-events-none opacity-20 rounded-full blur-[120px] bg-indigo-500" />
      </section>

      {/* Capabilities Section */}
      <section className="px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <div className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase mb-6">
          capabilities & differentiators
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl hover:border-slate-700 transition-colors group space-y-3 shadow-md">
                <Icon size={20} className="text-indigo-400 group-hover:text-cyan-400 transition-colors" />
                <div className="font-sans font-bold text-base text-slate-100">{f.title}</div>
                <div className="text-xs text-slate-400 font-mono leading-relaxed">{f.desc}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}