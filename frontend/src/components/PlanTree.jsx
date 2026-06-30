import React, { useEffect, useRef } from 'react';
import { ReactFlow, Background, BackgroundVariant, MarkerType, Handle, Position } from '@xyflow/react';

/**
 * Renders the EXPLAIN plan as a top-down operator tree.
 * SCAN -> FILTER -> GROUP/AGG -> SORT -> LIMIT -> RESULT
 */
function buildNodes(plan) {
  if (!plan) return { nodes: [], edges: [] };
  const stages = [];
  stages.push({
    type: 'SCAN',
    detail: `${plan.target_shards?.length || 0} shard(s) scanned${plan.pruned_shards?.length ? ` · ${plan.pruned_shards.length} pruned` : ''}`,
    color: '#4D5BFF',
  });
  if (plan.filter_predicates?.length) {
    stages.push({
      type: 'FILTER',
      detail: plan.filter_predicates.map(p => `${p.col} ${({ GT: '>', GTE: '>=', LT: '<', LTE: '<=', EQ: '=' }[p.op] || p.op)} ${p.val}`).join(' AND '),
      color: '#FFB000',
    });
  }
  if (plan.group_by?.length) {
    stages.push({
      type: 'GROUP BY',
      detail: plan.group_by.join(', '),
      color: '#00E5FF',
    });
  }
  if (plan.aggregates?.length) {
    stages.push({
      type: 'AGGREGATE',
      detail: plan.aggregates.map(a => `${a.func}(${a.col})`).join(', '),
      color: '#FF3DCB',
    });
  }
  if (plan.order_by?.length) {
    stages.push({ type: 'ORDER BY', detail: plan.order_by.join(', '), color: '#8B90A4' });
  }
  if (plan.limit) {
    stages.push({ type: 'LIMIT', detail: String(plan.limit), color: '#8B90A4' });
  }
  stages.push({
    type: 'MERGE',
    detail: `coordinator merges ${plan.target_shards?.length || 0} partial results`,
    color: '#00FF94',
  });
  stages.push({ type: 'RESULT', detail: `~${(plan.estimated_rows || 0).toLocaleString()} rows`, color: '#F8F9FA' });

  const nodes = stages.map((s, i) => ({
    id: `n-${i}`,
    position: { x: 30, y: i * 76 },
    data: { label: s, idx: i },
    type: 'op',
  }));
  const edges = stages.slice(1).map((_, i) => ({
    id: `e-${i}`,
    source: `n-${i}`,
    target: `n-${i + 1}`,
    style: { stroke: '#30344D', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#30344D' },
  }));
  return { nodes, edges };
}

const opNode = ({ data }) => (
  <div className="qf-card-elevated px-4 py-2.5 relative"
       style={{ width: 260, borderColor: data.label.color, borderWidth: 1 }}>
    <Handle type="target" position={Position.Top} style={{ background: data.label.color, opacity: 0.5 }} />
    <Handle type="source" position={Position.Bottom} style={{ background: data.label.color, opacity: 0.5 }} />
    <div className="font-mono text-[10px] uppercase tracking-widest"
         style={{ color: data.label.color }}>
      ★ {data.label.type}
    </div>
    <div className="font-mono text-[12px] text-[color:var(--text-primary)] mt-1 break-all">{data.label.detail}</div>
  </div>
);

const nodeTypes = { op: opNode };

export default function PlanTree({ plan, height = 520 }) {
  const { nodes, edges } = buildNodes(plan);
  if (!plan) return null;
  return (
    <div style={{ height }} data-testid="plan-tree">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        nodesDraggable={false}
        panOnDrag>
        <Background color="#1E2030" gap={16} variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </div>
  );
}
