import React, { useState, useEffect, useRef } from 'react';
import { Upload, Sparkles, FileSpreadsheet, ChevronRight, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api'; 
import { Badge, SectionHeader, StatPill } from '../components/atoms'; 

export default function Ingest() {
  const [file, setFile] = useState(null);
  const [shardCount, setShardCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState(null); 
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls|json)$/i.test(f.name)) {
      setError('Only CSV, XLSX, XLS, and JSON are supported.');
      return;
    }
    setFile(f); setError(null); setResult(null);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setPhase('parsing');
    const t1 = setTimeout(() => setPhase('sharding'), 300);
    const t2 = setTimeout(() => setPhase('stats'), 600);
    try {
      const data = await api.ingestFile(file, shardCount);
      clearTimeout(t1); clearTimeout(t2); setPhase('done'); setResult(data);
    } catch (e) {
      clearTimeout(t1); clearTimeout(t2); setPhase(null);
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const seed = async () => {
    setLoading(true); setError(null); setResult(null); setPhase('parsing');
    const t1 = setTimeout(() => setPhase('sharding'), 300);
    const t2 = setTimeout(() => setPhase('stats'), 600);
    try {
      const data = await api.ingestSeed(20000, shardCount);
      clearTimeout(t1); clearTimeout(t2); setPhase('done'); setResult(data);
    } catch (e) {
      clearTimeout(t1); clearTimeout(t2); setPhase(null);
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="px-4 lg:px-8 py-8 max-w-7xl mx-auto text-slate-200 space-y-6">
      <SectionHeader kicker="01 · DATA INGESTION" title="Forge your dataset into shards" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`bg-slate-900 border-2 border-dashed p-10 text-center cursor-pointer rounded-2xl transition-all ${drag ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'}`}
          >
            <input ref={fileRef} type="file" hidden accept=".csv,.xlsx,.xls,.json" onChange={e => handleFile(e.target.files[0])} />
            <Upload size={36} className="mx-auto text-indigo-500 mb-2" />
            <div className="font-sans font-bold text-xl text-slate-200">Drop a CSV, XLSX, or JSON</div>
            <div className="text-sm text-slate-400 mt-2">The engine will discover schema, auto-shard the data, compute per-column min/max statistics, and register the table — all in one pass.</div>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-400">
                <FileSpreadsheet size={14} /> <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">Sharding parameters</div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="font-mono text-xs text-slate-500">shard count</label>
              <div className="flex items-center gap-1">
                {[2, 4, 6, 8].map(n => (
                  <button key={n} onClick={() => setShardCount(n)} className={`font-mono text-xs px-3 py-1.5 rounded border transition-all ${shardCount === n ? 'border-indigo-500 bg-indigo-500/20 text-cyan-400' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'}`}>{n}</button>
                ))}
              </div>
              <button onClick={seed} disabled={loading} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 text-slate-300 ml-auto">
                <Sparkles size={12} /> SAMPLE (20K) SEED
              </button>
              <button onClick={submit} disabled={!file || loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 text-xs font-mono font-bold rounded-lg transition-all flex items-center gap-1.5 text-white shadow-lg shadow-indigo-600/10">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />} INGEST
              </button>
            </div>
          </div>
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs rounded-xl"><span className="font-bold block text-rose-300 mb-1">error</span><div>{error}</div></div>
          )}
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-4">pipeline status</div>
            <div className="space-y-2">
              {[
                { key: 'parsing', label: 'Discover schema & dtypes' },
                { key: 'sharding', label: 'Split into N shards (parallel writes)' },
                { key: 'stats', label: 'Compute min/max + null stats per column' },
                { key: 'done', label: 'Register in WAL-backed registry' }
              ].map((s, i) => {
                const steps = ['parsing', 'sharding', 'stats', 'done'];
                const currentIdx = steps.indexOf(phase || '');
                const stepIdx = steps.indexOf(s.key);
                const isDone = phase && currentIdx > stepIdx;
                const isCurrent = phase === s.key && phase !== 'done';
                return (
                  <div key={s.key} className="flex items-center gap-3 font-mono text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-[10px] ${isDone || (phase === 'done' && s.key === 'done') ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : isCurrent ? 'border-cyan-400 text-cyan-400 animate-pulse' : 'border-slate-800 text-slate-600'}`}>
                      {isDone || (phase === 'done' && s.key === 'done') ? <Check size={10} /> : isCurrent ? <Loader2 size={10} className="animate-spin" /> : i + 1}
                    </div>
                    <span className={isDone || isCurrent || (phase === 'done' && s.key === 'done') ? 'text-slate-200' : 'text-slate-600'}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {result && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold"><Check size={16} /> Table ready</div>
              <div className="grid grid-cols-3 gap-2">
                <StatPill label="rows" value={result.total_rows?.toLocaleString() || '0'} accent="text-cyan-400" />
                <StatPill label="shards" value={result.shard_count} accent="text-indigo-400" />
                <StatPill label="columns" value={result.columns?.length || 0} />
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <Badge kind="info">table: {result.table_name}</Badge>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/console')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-[10px] rounded transition-all uppercase">Open in Console →</button>
                  <button onClick={() => navigate('/cluster')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-[10px] border border-slate-700 rounded transition-all uppercase">View Cluster</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}