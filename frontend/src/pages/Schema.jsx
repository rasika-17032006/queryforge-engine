import React, { useEffect, useState } from 'react';
import { api } from '../lib/api'; // Native Path Alignment Fix
import { Badge, EmptyState, SectionHeader, StatPill } from '../components/atoms'; // Native Path Alignment Fix
import { Database, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Schema() {
  const [tables, setTables] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await api.schema();
      setTables(d.tables || []);
      if (!active && d.tables && d.tables.length > 0) {
        setActive(d.tables[0].table_name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const drop = async (t) => {
    if (!window.confirm(`Drop table "${t}"? This deletes all shard files.`)) return;
    try {
      await api.dropTable(t);
      setActive(null);
      refresh();
    } catch (e) {
      alert('Drop table operation failed.');
    }
  };

  if (loading) {
    return (
      <div className="p-10 font-mono text-sm text-slate-500 animate-pulse">
        Loading schema catalog ledger...
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <EmptyState 
          title="No tables yet" 
          hint="Ingest a CSV or seed sample data to initialize the schema explorer catalog." 
        />
      </div>
    );
  }

  const t = tables.find(x => x.table_name === active);

  return (
    <div className="px-4 lg:px-8 py-8 text-slate-200 max-w-7xl mx-auto space-y-6">
      <SectionHeader kicker="03 · DATA CATALOG" title="Schema & shard inventory" />

      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: Tables Selection Column list sidebar */}
        <aside className="col-span-12 lg:col-span-3 bg-slate-900 border border-slate-800 p-4 h-fit rounded-xl space-y-3 shadow-lg">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database size={12} className="text-indigo-400" /> Active Catalogs
          </div>
          <div className="space-y-1">
            {tables.map(x => (
              <button
                key={x.table_name}
                onClick={() => setActive(x.table_name)}
                className={`w-full text-left p-2.5 rounded-lg font-mono text-xs flex items-center justify-between transition-all border font-semibold ${
                  active === x.table_name
                    ? 'bg-indigo-600/10 text-cyan-400 border-indigo-500/30 shadow-md'
                    : 'text-slate-400 border-transparent bg-slate-950/40 hover:border-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  📁 {x.table_name}
                </span>
                <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/60">
                  {x.shard_count}S
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Right Side: Tabular Attribute Fields Definition Sheet Area */}
        <section className="col-span-12 lg:col-span-9 space-y-6">
          {t && (
            <>
              {/* Table Identity Header Panel Card */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-sans font-bold text-2xl uppercase tracking-tight text-slate-100">
                    {t.table_name}
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    source reference buffer: <span className="text-indigo-400">{t.source_file || 'seeded_cluster_binary'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => navigate('/console')} 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-md shadow-indigo-600/10"
                  >
                    Query table <ChevronRight size={14} />
                  </button>
                  <button 
                    onClick={() => drop(t.table_name)} 
                    className="p-2 bg-slate-950 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                    title="Drop table from ledger catalog clusters"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Stats Numerical Metric Overview Deck Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatPill label="Total Records" value={t.total_rows?.toLocaleString() || '0'} accent="text-cyan-400" />
                <StatPill label="Distributed Shards" value={`${t.shard_count} Nodes`} accent="text-indigo-400" />
                <StatPill label="Schema Column Count" value={`${t.columns?.length || 0} Attrs`} accent="text-emerald-400" />
                <StatPill label="Catalog Catalog Registered" value={t.created_at?.split(' ')[0] || 'Just Now'} accent="text-amber-400" />
              </div>

              {/* Attributes Specifications Data Grid Frame Sheet Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  📋 Columns Layout Definition Specification
                </div>
                <div className="overflow-x-auto bg-slate-950/20 font-mono text-xs text-left">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                        <th className="p-3 pl-6 font-semibold">Column Target</th>
                        <th className="p-3 font-semibold">SQL Data Type</th>
                        <th className="p-3 font-semibold">Pandas DataType Native</th>
                        <th className="p-3 font-semibold pr-6">Statistical Bounds Preview Samples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {t.columns?.map((c) => (
                        <tr key={c.col_name} className="hover:bg-slate-950/20 transition-colors">
                          <td className="p-3 pl-6 font-bold text-indigo-300">
                            {c.col_name}
                          </td>
                          <td className="p-3">
                            <Badge kind="accent">{c.sql_type || 'TEXT'}</Badge>
                          </td>
                          <td className="p-3 text-slate-400">
                            {c.pandas_dtype || 'object'}
                          </td>
                          <td className="p-3 pr-6 text-slate-500 text-[11px] italic truncate max-w-xs" title={String(c.sample_values || '')}>
                            {c.sample_values ? String(c.sample_values) : 'Dynamic bounds evaluation profiling active'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shard Nodes File Mapping Ledger Directory Table Container */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  🗄️ Underlying Shard Files Storage Mapping Infrastructure
                </div>
                <div className="overflow-x-auto bg-slate-950/20 font-mono text-xs text-left">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                        <th className="p-3 pl-6 font-semibold">Node Shard ID Target</th>
                        <th className="p-3 font-semibold">Physical File Location Path Segment</th>
                        <th className="p-3 font-semibold">Records Footprint Bounds</th>
                        <th className="p-3 font-semibold">Predicate Storage Ranges</th>
                        <th className="p-3 font-semibold pr-6">Operational Node Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {t.shards?.map((s) => (
                        <tr key={s.shard_id} className="hover:bg-slate-950/20 transition-colors text-slate-300">
                          <td className="p-3 pl-6 font-bold text-cyan-400">
                            Node #{s.shard_id}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] break-all max-w-xs" title={s.shard_path}>
                            {s.shard_path}
                          </td>
                          <td className="p-3 font-semibold text-slate-200">
                            {s.row_count?.toLocaleString() || '5,000'} rows
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {s.row_start !== undefined ? `[${s.row_start} → ${s.row_end || 'EOF'}]` : 'Dynamic statistical ranges active'}
                          </td>
                          <td className="p-3 pr-6">
                            <Badge kind={s.health_status === 'offline' || s.is_failed_injected ? 'error' : 'success'}>
                              {s.health_status === 'offline' || s.is_failed_injected ? 'crashed / offline' : 'online / healthy'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

