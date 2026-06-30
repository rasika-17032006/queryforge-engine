import '@xyflow/react/dist/style.css';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, BackgroundVariant, MarkerType, Handle, Position } from '@xyflow/react';
import { Activity, ShieldAlert, CheckCircle, Flame, RefreshCw, Server, Cpu } from 'lucide-react';
import { api } from '../lib/api'; // Native Path Alignment Fix
import { Badge, SectionHeader, StatPill, EmptyState } from '../components/atoms'; // Native Path Alignment Fix

// ReactFlow High-Feature Node Templates Configuration
const coordNode = () => (
  <div className="px-5 py-3 rounded-xl border-2 border-indigo-500 bg-slate-900 relative shadow-2xl shadow-indigo-500/5 min-w-[200px]">
    <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', width: '8px', height: '8px' }} />
    <div className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5"><Cpu size={12}/> Coordinator</div>
    <div className="font-mono text-[10px] text-slate-400 mt-1">gateway-node-active</div>
    <div className="flex items-center gap-1.5 mt-2">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
      <span className="font-mono text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Topology Balanced</span>
    </div>
  </div>
);

const shardNode = ({ data }) => {
  const s = data.shard;
  const dead = s.health_status === 'offline' || s.is_failed_injected;
  
  return (
    <div className={`px-4 py-3 bg-slate-900 border-2 rounded-xl relative shadow-lg min-w-[180px] flex flex-col justify-between transition-all ${dead ? 'border-rose-500/40 shadow-rose-950/5' : 'border-slate-800'}`}>
      <Handle type="target" position={Position.Top} style={{ background: dead ? '#ef4444' : '#6366f1' }} />
      <div>
        <div className="flex items-center justify-between font-mono text-xs font-bold text-slate-300">
          <span>Worker Node-{s.shard_id}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${dead ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-ping'}`} />
        </div>
        <div className="mt-2 font-mono text-[9px] text-slate-500 break-all select-all">{data.tableName}_shard_{s.shard_id}.db</div>
        
        <div className="grid grid-cols-2 gap-1.5 mt-3 font-mono text-[10px] text-slate-500 border-t border-slate-950 pt-2">
          <div>Rows: <span className="text-slate-300">{(s.row_count || 0).toLocaleString()}</span></div>
          <div>Disk: <span className="text-slate-300">{(s.size_mb || 0.12).toFixed(2)}MB</span></div>
          <div className="col-span-2 text-cyan-400">P50 Mean: <span className="font-bold text-slate-300">{(s.latency_p50 || 0).toFixed(1)}ms</span></div>
        </div>
      </div>

      <button onClick={() => data.onToggle(s)} className={`w-full mt-4 flex items-center justify-center gap-1.5 py-1 rounded-lg font-mono font-bold text-[10px] uppercase border tracking-wider transition-colors ${dead ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white' : 'bg-rose-600/10 border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white'}`}>
        {dead ? <Activity size={10} /> : <Flame size={10} />}
        {dead ? 'Heal Cluster' : 'Inject Crash'}
      </button>
    </div>
  );
};

const nodeTypes = { coord: coordNode, shard: shardNode };

export default function Cluster() {
  const [data, setData] = useState({ tables: [] });
  const [loading, setLoading] = useState(true);
  const [activeTable, setActiveTable] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshTopology = useCallback(async () => {
    try {
      const d = await api.cluster();
      setData(d || { tables: [] });
      if (!activeTable && d.tables?.length) {
        setActiveTable(d.tables[0].table_name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTable]);

  useEffect(() => {
    refreshTopology();
    if (autoRefresh) {
      const timer = setInterval(refreshTopology, 4000);
      return () => clearInterval(timer);
    }
  }, [autoRefresh, refreshTopology]);

  const toggleFault = async (shard) => {
    const isDead = shard.health_status === 'offline' || shard.is_failed_injected;
    try {
      if (isDead) {
        await api.recoverShard(activeTable, shard.shard_id);
      } else {
        await api.failShard(activeTable, shard.shard_id);
      }
      refreshTopology();
    } catch (e) {
      alert('Fault actuator execution connection error.');
    }
  };

  const table = data.tables?.find(t => t.table_name === activeTable);

  const { nodes, edges } = useMemo(() => {
    if (!table || !table.shards) return { nodes: [], edges: [] };
    const cx = 350; //480
    const spacing = 240;  //220
    const startX = cx - ((table.shards.length - 1) * spacing) / 2;

    const flowNodes = [
      { id: 'coord', type: 'coord', position: { x: cx - 100, y: 20 }, data: {} },
      ...table.shards.map((s, i) => ({
        id: `s-${s.shard_id}`,
        type: 'shard',
        position: { x: startX + i * spacing, y: 180 }, //180
        data: { shard: s, tableName: table.table_name, onToggle: toggleFault }
      }))
    ];

    const flowEdges = table.shards.map(s => {
      const isDead = s.health_status === 'offline' || s.is_failed_injected;
      return {
        id: `e-${s.shard_id}`,
        source: 'coord',
        target: `s-${s.shard_id}`,
        style: { stroke: isDead ? '#ef4444' : '#6366f1', strokeWidth: 1.5 },
        animated: !isDead,
        markerEnd: { type: MarkerType.ArrowClosed }
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [table]);

  if (loading) return <div className="text-center p-12 font-mono text-slate-500 text-xs">Synchronizing active topology configurations...</div>;
  if (!data.tables?.length) return <div className="p-8"><EmptyState title="Cluster Ingestion Required" hint="Go to Ingestion and seed a mock dataset to spin up active topology grids." /></div>;

  const total = table?.shards?.length || 0;
  const alive = table?.shards?.filter(s => s.health_status !== 'offline' && !s.is_failed_injected).length || 0;
  const dead = total - alive;
  const avgP50 = total ? (table.shards.reduce((a, s) => a + (s.latency_p50 || 0), 0) / total).toFixed(1) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-slate-200">
      <SectionHeader kicker="02 · LIVE CLUSTER TOPOLOGY" title="Distributed Shard Control Plane" right={
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-3 py-1 text-xs font-mono font-bold border rounded-lg transition-colors ${autoRefresh ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>
            {autoRefresh ? 'AUTO-REFRESH 4S' : 'PAUSED'}
          </button>
          <button onClick={() => { setLoading(true); refreshTopology(); }} className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      } />

      {/* Tables Selection Deck */}
      <div className="flex gap-2 flex-wrap border-b border-slate-900 pb-4">
        {data.tables.map(t => (
          <button key={t.table_name} onClick={() => setActiveTable(t.table_name)} className={`px-4 py-2 font-mono text-xs font-bold border rounded-lg uppercase tracking-wider transition-all ${activeTable === t.table_name ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-md' : 'border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-700'}`}>
            📁 {t.table_name} ({t.shard_count} Nodes)
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatPill label="Total Managed Shards" value={total} accent="text-indigo-400" />
        <StatPill label="Online Workers" value={alive} accent="text-emerald-400" />
        <StatPill label="Crashed Injections" value={dead} accent={dead > 0 ? 'text-rose-500' : 'text-slate-500'} />
        <StatPill label="Distributed Records" value={(table?.total_rows || 20000).toLocaleString()} accent="text-cyan-400" />
        <StatPill label="Avg Shard P50" value={`${avgP50}ms`} accent="text-amber-400" />
      </div>

      {/* Interactive Graph Canvas Wrapper */}
      <div className="h-[460px] bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative backdrop-blur-md">
       <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }} zoomOnScroll={false} nodesDraggable={false} panOnDrag>
          <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} />
        </ReactFlow>
      </div>

      {/* Explainer Help Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md space-y-2">
        <div className="text-xs font-mono font-bold tracking-wider uppercase text-indigo-400">Chaos Engineering Simulation Sandbox</div>
        <p className="text-xs font-mono text-slate-400 leading-relaxed">
          Click <span className="text-rose-400 font-bold">Inject Crash</span> inside any virtual node to mutate partition execution states live. Once crashed, return to the Workbench Console to observe the coordinator bypass the outage using transaction balancing queries. Hit <span className="text-emerald-400 font-bold">Heal Cluster</span> to re-admit the node into active scheduling streams transparently.
        </p>
      </div>

    </div>
  );
}