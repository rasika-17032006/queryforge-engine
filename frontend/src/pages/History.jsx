
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api'; 
import { Badge, SectionHeader, EmptyState } from '../components/atoms'; 
import { Trash2 } from 'lucide-react';
export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchLogs = () => {
    setLoading(true);
    api.history().then(d => {
      setHistory(d.history || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { fetchLogs(); }, []);
  const clearHistoryLog = async () => {
    if (!window.confirm("Are you sure you want to permanently delete the distributed query audit ledger trails?")) return;
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/history/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!resp.ok) throw new Error('Clear endpoint request failed or route not found');
      setHistory([]);
    } catch (e) {
      alert('Failed to clear operational history: ' + e.message);
    }
  };
  return (
    <div className="px-4 lg:px-8 py-8 text-slate-200 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
        <SectionHeader kicker="04 · QUERY LOG" title="Audit trail • every query, every shard" />
        {history.length > 0 && (
          <button onClick={clearHistoryLog} className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white font-mono text-xs font-bold rounded-lg transition-all uppercase tracking-wider shadow-md">
            <Trash2 size={13} /> Clear Logs
          </button>
        )}
      </div>
      {loading ? (
        <div className="font-mono text-sm text-slate-500 animate-pulse">Loading audit log streams...</div>
      ) : history.length === 0 ? (
        <EmptyState title="No queries yet" hint="Run a query in the Console to see it logged here." />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs text-left">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="p-3 pl-6 font-semibold">Time</th>
                  <th className="p-3 font-semibold">Query ID</th>
                  <th className="p-3 font-semibold">Target Table</th>
                  <th className="p-3 font-semibold">Strategy Scheme</th>
                  <th className="p-3 font-semibold">Latency</th>
                  <th className="p-3 font-semibold">Row Count</th>
                  <th className="p-3 font-semibold">Pruned Nodes</th>
                  <th className="p-3 font-semibold pr-6">Compiled SQL Directive Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((h) => (
                  <tr key={h.query_id} className="hover:bg-slate-950/30 transition-colors">
                    <td className="p-3 pl-6 text-slate-300 text-[11px] whitespace-nowrap font-medium">
                      {h.ts ? new Date(h.ts.replace(' ', 'T') + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : 'Just Now'}
                    </td>
                    <td className="p-3 text-cyan-400 font-bold font-mono">{h.query_id}</td>
                    <td className="p-3 text-slate-300 font-medium">{h.table_name || 'employees'}</td>
                    <td className="p-3">
                      <Badge kind={h.strategy === 'targeted' ? 'success' : 'info'}>{h.strategy || 'broadcast'}</Badge>
                    </td>
                    <td className="p-3 text-emerald-400 font-bold">{h.total_ms || h.latency_ms || 0} ms</td>
                    <td className="p-3 text-slate-300">{(h.row_count || 0).toLocaleString()}</td>
                    <td className="p-3 text-slate-500">{h.pruned_shards || 0}</td>
                    <td className="p-3 pr-6 text-slate-400 text-[11px] max-w-md truncate select-all" title={h.sql}>{h.sql}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}