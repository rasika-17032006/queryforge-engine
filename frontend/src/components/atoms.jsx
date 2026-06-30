import React from 'react';

export function StatPill({ label, value, accent }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono font-bold text-xl mt-1 ${accent || 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}

export function Badge({ children, kind = 'default' }) {
  const colors = {
    default: 'text-slate-400 border-slate-800 bg-slate-900',
    success: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    warn: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    error: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    info: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
    accent: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[10px] font-mono uppercase tracking-wide ${colors[kind] || colors.default}`}>
      {children}
    </span>
  );
}

export function SectionHeader({ kicker, title, right }) {
  return (
    <div className="flex items-start justify-between mb-6 border-b border-slate-900 pb-4">
      <div>
        {kicker && <div className="text-[10px] font-mono tracking-widest text-indigo-400 uppercase">{kicker}</div>}
        <h1 className="font-sans font-bold text-2xl md:text-3xl mt-1 tracking-tight text-slate-100">{title}</h1>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/80 border-dashed rounded-2xl p-10 text-center max-w-xl mx-auto">
      <div className="font-sans font-bold text-lg text-slate-300">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-2 font-mono leading-relaxed">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}