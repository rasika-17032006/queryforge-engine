import React from 'react';
import { motion } from 'framer-motion';

/**
 * Cinematic scatter-gather visualization.
 * Renders a coordinator node at center-top and N shard nodes around an arc.
 * Animates glowing packets along SVG paths.
 */
export default function ScatterGatherViz({ shards = [], active = false, pruned = [], failed = [] }) {
  const W = 760, H = 240;
  const COORD = { x: W / 2, y: 26 };
  const n = Math.max(shards.length, 1);
  const radius = 80;

  const shardPositions = shards.map((s, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = 60 + t * (W - 120);
    const y = H - 40;
    return { ...s, x, y };
  });

  return (
    <div className="relative w-full overflow-hidden" data-testid="scatter-gather-viz">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]" preserveAspectRatio="xMidYMid meet">
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1E2030" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="coordGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4D5BFF" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#4D5BFF" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" opacity="0.4"/>

        {/* Edges from coord to each shard */}
        {shardPositions.map((s, i) => {
          const isPruned = pruned.includes(s.shard_id);
          const isFailed = failed.includes(s.shard_id);
          const dashed = isPruned;
          const color = isFailed ? '#FF2A5F' : isPruned ? '#55596D' : active ? '#00E5FF' : '#30344D';
          const pathId = `edge-${i}`;
          const d = `M ${COORD.x} ${COORD.y + 18} Q ${(COORD.x + s.x) / 2} ${(COORD.y + s.y) / 2 - 10}, ${s.x} ${s.y - 18}`;
          return (
            <g key={s.shard_id}>
              <path id={pathId} d={d} fill="none" stroke={color}
                    strokeWidth={isPruned ? 1 : 1.5}
                    strokeDasharray={dashed ? '4 4' : ''}
                    opacity={isPruned ? 0.4 : 0.9}/>
              {/* Animated packets when active and not pruned/failed */}
              {active && !isPruned && !isFailed && (
                <>
                  <circle r="3" fill="#00E5FF">
                    <animateMotion dur="0.9s" repeatCount="indefinite" begin={`${i * 0.07}s`}>
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                  <circle r="3" fill="#4D5BFF" opacity="0.7">
                    <animateMotion dur="1.1s" repeatCount="indefinite" begin={`${0.5 + i * 0.05}s`} keyPoints="1;0" keyTimes="0;1">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </>
              )}
            </g>
          );
        })}

        {/* Coordinator */}
        <g>
          <circle cx={COORD.x} cy={COORD.y} r="34" fill="url(#coordGlow)" opacity="0.4"/>
          <rect x={COORD.x - 38} y={COORD.y - 14} width="76" height="28" rx="6"
                fill="#0C0D14" stroke="#4D5BFF" strokeWidth="1.5"/>
          <text x={COORD.x} y={COORD.y + 4} fill="#F8F9FA" textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize="10" letterSpacing="2">COORD</text>
        </g>

        {/* Shard nodes */}
        {shardPositions.map((s, i) => {
          const isFailed = failed.includes(s.shard_id);
          const isPruned = pruned.includes(s.shard_id);
          const stroke = isFailed ? '#FF2A5F' : isPruned ? '#55596D' : '#00FF94';
          return (
            <g key={s.shard_id}>
              {!isPruned && !isFailed && (
                <circle cx={s.x} cy={s.y} r="22" fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.4">
                  <animate attributeName="r" values="20;28;20" dur="2.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite"/>
                </circle>
              )}
              <rect x={s.x - 28} y={s.y - 14} width="56" height="28" rx="6"
                    fill="#0C0D14" stroke={stroke} strokeWidth="1.5"
                    opacity={isPruned ? 0.5 : 1}/>
              <text x={s.x} y={s.y + 4} fill={isPruned ? '#55596D' : '#F8F9FA'}
                    textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" letterSpacing="1">
                S{s.shard_id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
