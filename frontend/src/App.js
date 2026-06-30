
import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import Console from './pages/Console';
import Ingest from './pages/Ingest';
import Cluster from './pages/Cluster';
import Schema from './pages/Schema';
import History from './pages/History';
import Benchmark from './pages/Benchmark';

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          {/* Mapping the root path to your Landing page ensures it loads at http://localhost:3000/ */}
          <Route path="/" element={<Landing />} />
          <Route path="/console" element={<Console />} />
          <Route path="/ingest" element={<Ingest />} />
          <Route path="/cluster" element={<Cluster />} />
          <Route path="/schema" element={<Schema />} />
          <Route path="/history" element={<History />} />
          <Route path="/benchmark" element={<Benchmark />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}