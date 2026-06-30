// import React from 'react';
// import { NavLink, useLocation } from 'react-router-dom';
// import { Terminal, Database, Upload, Network, History, Activity, Sparkles, Zap } from 'lucide-react';

// const NAV = [
//   { to: '/console',   label: 'CONSOLE',   icon: Terminal,  testid: 'nav-console' },
//   { to: '/ingest',    label: 'INGEST',    icon: Upload,    testid: 'nav-ingest' },
//   { to: '/cluster',   label: 'CLUSTER',   icon: Network,   testid: 'nav-cluster' },
//   { to: '/schema',    label: 'SCHEMA',    icon: Database,  testid: 'nav-schema' },
//   { to: '/history',   label: 'HISTORY',   icon: History,   testid: 'nav-history' },
//   { to: '/benchmark', label: 'BENCHMARK', icon: Activity,  testid: 'nav-benchmark' },
// ];

// export default function Shell({ children }) {
//   const location = useLocation();
//   return (
//     <div className="App font-body" data-testid="app-shell">
//       {/* Top bar */}
//       <header className="sticky top-0 z-40 border-b border-[color:var(--border-default)] backdrop-blur-xl"
//               style={{ background: 'rgba(5,5,8,0.78)' }}>
//         <div className="flex items-center justify-between px-6 h-14">
//           <div className="flex items-center gap-3" data-testid="brand-mark">
//             <div className="relative">
//               <Zap size={20} className="text-[color:var(--accent-cyan)]" strokeWidth={2.5} />
//               <span className="absolute inset-0 blur-md opacity-60">
//                 <Zap size={20} className="text-[color:var(--accent-cyan)]" strokeWidth={2.5} />
//               </span>
//             </div>
//             <div className="font-display text-lg leading-none">
//               QUERY<span className="text-[color:var(--accent-cyan)]">FORGE</span>
//             </div>
//             <span className="qf-label hidden md:inline ml-2">v3.0 · distributed sql engine</span>
//           </div>

//           <nav className="flex items-center gap-1" data-testid="primary-nav">
//             {NAV.map(({ to, label, icon: Icon, testid }) => (
//               <NavLink
//                 key={to}
//                 to={to}
//                 data-testid={testid}
//                 className={({ isActive }) =>
//                   `font-mono text-[11px] tracking-[0.18em] px-3 py-2 rounded-md flex items-center gap-2 transition-all
//                    ${isActive
//                      ? 'text-[color:var(--accent-cyan)] bg-[color:var(--bg-elevated)] border border-[color:var(--border-active)]'
//                      : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`
//                 }>
//                 <Icon size={13} />
//                 <span>{label}</span>
//               </NavLink>
//             ))}
//           </nav>

//           <div className="flex items-center gap-2 text-[10px] font-mono text-[color:var(--text-tertiary)]" data-testid="status-indicator">
//             <span className="qf-pulse-dot" />
//             <span className="hidden md:inline">ENGINE ONLINE</span>
//           </div>
//         </div>
//       </header>

//       <main data-testid="main-content" key={location.pathname}>
//         {children}
//       </main>
//     </div>
//   );
// }















import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Terminal, Database, Upload, Network, History, Activity, Zap, Home } from 'lucide-react';

const NAV = [
  { to: '/console',   label: 'CONSOLE',   icon: Terminal },
  { to: '/ingest',    label: 'INGEST',    icon: Upload },
  { to: '/cluster',   label: 'CLUSTER',   icon: Network },
  { to: '/schema',    label: 'SCHEMA',    icon: Database },
  { to: '/history',   label: 'HISTORY',   icon: History },
  { to: '/benchmark', label: 'BENCHMARK', icon: Activity },
];

export default function Shell({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col select-none">
      {/* Top bar header */}
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl h-14 flex items-center">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-6">
          
          {/* Brand Mark linked back home */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <Zap size={18} className="text-cyan-400" strokeWidth={2.5} />
              <span className="absolute inset-0 blur-md opacity-40">
                <Zap size={18} className="text-cyan-400" strokeWidth={2.5} />
              </span>
            </div>
            <div className="font-sans font-black tracking-tight text-base text-white">
              QUERY<span className="text-cyan-400">FORGE</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 hidden md:inline ml-2 uppercase tracking-wider">v3.0 · distributed engine</span>
          </Link>

          {/* Navigation Matrix Tabs */}
          <nav className="flex items-center gap-1.5">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `font-mono text-[11px] tracking-wider px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all
                 ${isActive
                   ? 'text-cyan-400 bg-slate-900 border-slate-800 shadow-md'
                   : 'text-slate-400 border-transparent hover:text-slate-200'}`
              }
            >
              <Home size={12} />
              <span>HOME</span>
            </NavLink>

            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `font-mono text-[11px] tracking-wider px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all
                   ${isActive
                     ? 'text-cyan-400 bg-slate-900 border-slate-800 shadow-md'
                     : 'text-slate-400 border-transparent hover:text-slate-200'}`
                }
              >
                <Icon size={12} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Infrastructure Health Indicator */}
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="hidden md:inline tracking-wider text-emerald-400 uppercase">ENGINE ONLINE</span>
          </div>

        </div>
      </header>

      {/* Main Container Layout Outlet */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto" key={location.pathname}>
        {children}
      </main>
    </div>
  );
}