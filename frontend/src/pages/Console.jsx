import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Sparkles, Download, AlertTriangle, Database, Terminal, Clock, Cpu, BarChart2, X, Send, Loader2, FileText } from 'lucide-react';
//import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import { Badge, EmptyState, SectionHeader, StatPill } from '../components/atoms';
import ScatterGatherViz from '../components/ScatterGatherViz';
import PlanTree from '../components/PlanTree';

const QUICK_QUERIES = [
  { label: 'Avg salary by department', sql: 'SELECT department, AVG(salary) AS avg_sal, COUNT(*) AS cnt FROM employees GROUP BY department ORDER BY avg_sal DESC;' },
  { label: 'Top earners', sql: 'SELECT name, department, salary FROM employees WHERE salary > 120000 ORDER BY salary DESC LIMIT 50;' },
  { label: 'Performance by region', sql: 'SELECT region, AVG(performance_score) AS avg_perf FROM employees GROUP BY region ORDER BY avg_perf DESC;' },
  { label: 'Manager headcount', sql: 'SELECT department, SUM(is_manager) AS managers, COUNT(*) AS total FROM employees GROUP BY department;' }
];

export default function Console() {
  const [sql, setSql] = useState(QUICK_QUERIES[0].sql);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotQ, setCopilotQ] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotMsgs, setCopilotMsgs] = useState([]);
  const [showPlan, setShowPlan] = useState(false);
  const editorRef = useRef(null);

  const loadSchema = async () => {
    try {
      const data = await api.schema();
      setTables(data.tables || []);
      if (data.tables?.length && !activeTable) {
        setActiveTable(data.tables[0].table_name);
      }
      if (!data.tables || !data.tables.length) {
        setSql('-- Central registry catalog empty. Ingest a sheet inside DATASET INGESTION panels first.\nSELECT 1;');
      }
    } catch {
      // Gracefully catch background compilation drops safely
    }
  };

  useEffect(() => { loadSchema(); }, []);

  const runQuery = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const data = await api.query(sql);
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setRunning(false);
    }
  };

  const askCopilot = async () => {
    if (!copilotQ.trim()) return;
    const q = copilotQ;
    setCopilotMsgs(m => [...m, { role: 'user', text: q }]);
    setCopilotQ(''); setCopilotLoading(true);
    try {
      const r = await api.copilot(q);
      if (r.error) {
        setCopilotMsgs(m => [...m, { role: 'ai', text: '', error: r.error }]);
      } else {
        setCopilotMsgs(m => [...m, { role: 'ai', text: r.sql }]);
      }
    } catch (e) {
      setCopilotMsgs(m => [...m, { role: 'ai', text: '', error: e.message }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const exportFile = async (format) => {
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, format })
      });
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `queryforge_result.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      alert('Report Export Failed: ' + e.message);
    }
  };

  const activeTableMeta = tables.find(t => t.table_name === activeTable);

  return (
    <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto text-slate-200">
      <aside className="col-span-12 lg:col-span-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4 max-h-[620px] overflow-y-auto">
        <div className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2">
          <Database size={14} className="text-indigo-400" /> Storage Catalog Explorer
        </div>
        <div className="space-y-1.5">
          {tables.length === 0 ? (
            <div className="text-xs font-mono text-slate-600 p-2 italic">No active metadata tables detected.</div>
          ) : (
            tables.map(t => (
              <div key={t.table_name} className="space-y-1">
                <button onClick={() => setActiveTable(t.table_name)} className={`w-full text-left font-mono text-xs px-3 py-2 rounded-lg flex items-center justify-between font-bold transition-colors ${activeTable === t.table_name ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'}`}>
                  <span className="truncate">📁 {t.table_name}</span>
                  <span className="text-[10px] opacity-60">({t.total_rows?.toLocaleString()})</span>
                </button>
                {activeTable === t.table_name && (
                  <ul className="pl-3 space-y-1 pt-1.5 text-[11px] font-mono text-slate-500 max-h-36 overflow-y-auto bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                    {t.columns?.map(c => (
                      <li key={c.col_name} className="flex items-center justify-between border-b border-slate-900/60 py-1 last:border-0 hover:text-indigo-400 cursor-pointer" onClick={() => editorRef.current?.trigger('keyboard', 'type', { text: c.col_name })}>
                        <span className="text-slate-300">{c.col_name}</span>
                        <span className="text-[9px] text-slate-600 uppercase">({c.sql_type || 'TEXT'})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
        <div className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2 pt-2">
          <Terminal size={14} className="text-indigo-400" /> Quick Presets Deck
        </div>
        <div className="space-y-1">
          {QUICK_QUERIES.map((q, i) => (
            <button key={i} onClick={() => setSql(q.sql)} className="w-full text-left font-mono text-[11px] p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:border-indigo-500/40 hover:text-slate-200 transition-all truncate block">⚡ {q.label}</button>
          ))}
        </div>
      </aside>
      <section className="col-span-12 lg:col-span-6 space-y-6">
        <div className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all ${running ? 'border-indigo-500 shadow-indigo-500/5 animate-pulse' : ''}`}>
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5"><Badge kind="accent">Engine Environment: Distributed SQLite</Badge></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopilotOpen(o => !o)} className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 rounded-lg hover:border-slate-700 flex items-center gap-1.5"><Sparkles size={12} className="text-purple-400 animate-pulse" /> AI Copilot</button>
              <button onClick={runQuery} disabled={running} className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-mono font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10">{running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}{running ? 'ROUTING...' : 'EXECUTE'}</button>
            </div>
          </div>
          <Editor height="220px" language="sql" theme="vs-dark" value={sql} onChange={(v) => setSql(v || '')} onMount={(editor) => { editorRef.current = editor; }} options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 12 } }} />
        </div>
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs rounded-xl flex items-start gap-2 shadow-md">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div><span className="font-bold block text-rose-300">Distributed Architecture Runtime Error:</span>{error}</div>
          </div>
        )}
        {(running || result) && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-6">
            <div className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Live Scatter-Gather Pipeline Metrics Channel</span>
              {result && <Badge kind={result.plan?.strategy === 'targeted' ? 'success' : 'info'}>Routing Scheme: {result.plan?.strategy}</Badge>}
            </div>
            <ScatterGatherViz shards={result?.telemetry?.shard_breakdown || (activeTableMeta?.shards || []).map(s => ({ shard_id: s.shard_id }))} active={running} pruned={result?.plan?.pruned_shards || []} failed={result?.telemetry?.failed_shard_ids || []} />
            {result && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <StatPill label="Total Cluster Latency" value={`${result.telemetry?.total_ms || 0} ms`} accent="text-emerald-400" />
                  <StatPill label="Scatter Processing Split" value={`${result.telemetry?.scatter_ms || 0} ms`} accent="text-indigo-400" />
                  <StatPill label="Relational Row Footprint" value={`${result.row_count?.toLocaleString() || 0} Rows`} accent="text-cyan-400" />
                  <StatPill label="Active Storage Nodes" value={`${result.telemetry?.online_shards || 0}/${result.telemetry?.total_shards || 4} Up`} accent="text-amber-400" />
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                    <span>Execution Plan (Cost-Based Opt Ledger)</span>
                    <button onClick={() => setShowPlan(!showPlan)} className="text-indigo-400 font-bold hover:underline text-xs">{showPlan ? 'Hide Blueprint' : 'Examine Tree Blueprint'}</button>
                  </div>
                  {showPlan && (
                    <div className="space-y-2 pt-3 border-t border-slate-900 font-mono text-xs">
                      {result.plan?.explanation?.map((e, idx) => (<div key={idx} className="text-slate-400"> {e}</div>))}
                      <div className="mt-2 text-indigo-300 border-t border-slate-800 pt-2">{result.plan?.shard_sql}</div>
                      <div className="h-64 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40"><PlanTree plan={result.plan} height={240} /></div>
                    </div>
                  )}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[300px] flex flex-col">
                  <div className="px-4 py-2 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between text-slate-500 font-mono text-[10px] uppercase">
                    <span>Relational Grid Matrix Viewport</span>
                    <div className="flex gap-2">
                      <button onClick={() => exportFile('csv')} className="px-2 py-0.5 border border-slate-800 hover:bg-slate-900 rounded transition-all text-xs text-slate-400">CSV</button>
                      <button onClick={() => exportFile('pdf')} className="px-2 py-0.5 border border-slate-800 hover:bg-slate-900 rounded transition-all text-xs text-slate-400">PDF Report</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                    {result.rows?.length === 0 ? (
                      <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl text-slate-600 text-xs italic">Query executed successfully but returned an empty structural data match grid.</div>
                    ) : (

                    <table className="w-full text-[11px] font-mono">
                        <thead className="bg-slate-900/50 border-b border-slate-800">
                          <tr>
                            {result.columns?.map(colName => (
                              <th key={colName} className="p-2.5 text-left text-indigo-400 uppercase font-bold tracking-wider">
                                {colName.replace('_', ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {result.rows?.slice(0, 50).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-900/20 transition-colors">
                              {result.columns?.map(colName => (
                                <td key={colName} className="p-2.5 text-slate-300">
                                  {row[colName] === null || row[colName] === undefined ? <span className="text-slate-700">NULL</span> : String(row[colName])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {!running && !result && tables.length > 0 && (<EmptyState title="Execution Context Thread Dormant" hint="Initialize parallel sharding routines by writing a filtering parameters directive and striking EXECUTE." />)}
      </section>
       {copilotOpen && (
        <aside className="col-span-12 lg:col-span-3 h-fit">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4 max-h-[620px] flex flex-col">
            
            {/* Header Strip */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400 animate-pulse" /> AI Query Copilot
              </span>
              <button 
                onClick={() => setCopilotOpen(false)} 
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
              Powered by QueryForge LLM Layer
            </div>
            
            {/* Chat Message Box Container */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {copilotMsgs.length === 0 && (
                <div className="text-[11px] text-slate-600 italic p-4 bg-slate-950 rounded-xl border border-dashed border-slate-800">
                  Ask any data question in plain English sentences. The bridge will parse your active shard storage catalog layouts to compile proper relational queries.<br/><br/>
                  <span className="text-slate-500">e.g., "Find total row records grouped by department targets"</span>
                </div>
              )}
              
              {copilotMsgs.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`p-2.5 rounded-xl font-mono text-xs space-y-1 max-w-[90%] ${
                    m.role === 'user' 
                      ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 ml-auto' 
                      : 'bg-slate-900 border border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-[9px] font-bold opacity-60 uppercase">
                    {m.role === 'user' ? 'YOU' : 'COPILOT ASSISTANT'}
                  </div>
                  <div className="break-all whitespace-pre-wrap select-all">
                    {m.error ? `Error: ${m.error}` : m.text}
                  </div>
                  {m.role === 'ai' && !m.error && (
                    <button 
                      onClick={() => { setSql(m.text); setCopilotOpen(false); }} 
                      className="mt-2 text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      → Load into workbench
                    </button>
                  )}
                </div>
              ))}
              
              {copilotLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono p-2">
                  <Loader2 size={12} className="animate-spin" /> Mapping schema vectors...
                </div>
              )}
            </div>

            {/* Input Element & Triggers */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <input 
                value={copilotQ} 
                onChange={e => setCopilotQ(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && askCopilot()} 
                placeholder="describe what you want..." 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-700" 
              />
              <button 
                onClick={askCopilot} 
                disabled={copilotLoading || !copilotQ.trim()} 
                className="w-full p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Send Request
              </button>
            </div>

          </div>
        </aside>
      )}

      <footer className="col-span-12 mt-6 p-4 border-t border-slate-800 text-slate-600 text-[10px] text-center space-y-1">
        <div className="font-bold text-slate-500">About Queryforge Simulator Core</div>
        <p>    A modular decoupled distributed SQL query routing engine simulator.</p>
        <p> Auto-shards relational data matrices across isolated host paths, processes asynchronous query tokens </p>
  <p>using scatter-gather channels, and isolates runtime cluster fault states using pushdown metadata statistics transparently.</p>
      </footer>
    </div>
  );
}