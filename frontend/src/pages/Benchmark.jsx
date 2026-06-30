import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Badge, SectionHeader, StatPill, EmptyState } from '../components/atoms';
import { Play, Loader2, BarChart2, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
export default function Benchmark() {
  const [tables, setTables] = useState([]);
  const [active, setActive] = useState('');
  const [runs, setRuns]     = useState(15);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    api.schema().then(d => {
      setTables(d.tables || []);
      if (d.tables && d.tables.length) {
        setActive(d.tables[0].table_name);
      }
    });
  }, []);
  const runBenchmarkSuite = async () => {
    setLoading(true); setData(null);
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/benchmark?table_name=${active}&runs=${runs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!resp.ok) throw new Error('Not Found or Server Error');
      const metrics = await resp.json();
      setData(metrics);
    } catch (e) {
      alert('Benchmark Suite Execution Faulted: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  if (!tables.length) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <EmptyState title="Analytical Context Required" hint="Please seed synthetic clusters or ingest an active dataset before performing analytical benchmarking sequences." />
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-200 px-4 py-6">
      <SectionHeader kicker="05 · PERFORMANCE PROFILE" title="P50 • P95 • P99 Latency Benchmarks Matrix" />
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Catalog Object:</span>
            <select value={active} onChange={e => setActive(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none">
              {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Iterations/Pass:</span>
            <input type="number" value={runs} min={1} max={50} onChange={e => setRuns(parseInt(e.target.value || 10))} className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none" />
          </div>
          <button className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-xs rounded-lg transition-all ml-auto shadow-md" onClick={runBenchmarkSuite} disabled={loading}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} RUN BENCHMARK
          </button>
        </div>
      </div>
      {loading && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center font-mono text-xs text-slate-400 shadow-md">
          <Loader2 className="inline animate-spin mr-2 text-indigo-400" /> Spawning evaluation threads... Executing testing iterations across database shards.
        </div>
      )}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.results.map(r => (
              <StatPill key={r.label} label={r.label.replace('_', ' ')} value={`${r.p50}ms`} accent="text-indigo-400" />
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-400" /> Percentile Breakdown Vector (ms)
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.results.map(r => ({ name: r.label, p50: r.p50, p95: r.p95, p99: r.p99 }))}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontFamily: 'monospace', borderRadius: '8px', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 11, paddingTop: '10px' }} />
                  <Bar dataKey="p50" fill="#4d5bff" name="P50 (Median)" />
                  <Bar dataKey="p95" fill="#ffb000" name="P95 (Tail)" />
                  <Bar dataKey="p99" fill="#ff2a5f" name="P99 (Max Burst)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="p-3 pl-6 font-semibold">Query Archetype</th>
                    <th className="p-3 font-semibold">Passes</th>
                    <th className="p-3 font-semibold">P50</th>
                    <th className="p-3 font-semibold">P95</th>
                    <th className="p-3 font-semibold">P99</th>
                    <th className="p-3 font-semibold">Mean</th>
                    <th className="p-3 font-semibold">Min / Max Bounds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.results.map(r => (
                    <tr key={r.label} className="border-b border-slate-900/60 hover:bg-slate-950/40">
                      <td className="p-3 pl-6 font-bold text-indigo-400">{r.label}</td>
                      <td className="p-3 text-slate-300">{r.runs}</td>
                      <td className="p-3 text-emerald-400 font-bold">{r.p50}ms</td>
                      <td className="p-3 text-amber-400 font-bold">{r.p95}ms</td>
                      <td className="p-3 text-rose-400 font-bold">{r.p99}ms</td>
                      <td className="p-3 text-slate-300">{r.mean}ms</td>
                      <td className="p-3 text-slate-500 text-[11px]">{r.min[0]}ms / {r.max}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}