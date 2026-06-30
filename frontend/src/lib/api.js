import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

export const api = {
  engineInfo:    ()                 => client.get('/engine/info').then(r => r.data),
  schema:        ()                 => client.get('/schema').then(r => r.data),
  tableSchema:   (t)                => client.get(`/schema/${t}`).then(r => r.data),
  dropTable:     (t)                => client.delete(`/schema/${t}`).then(r => r.data),
  ingestSeed:    (rows, shards)     => client.post(`/ingest/seed?rows=${rows}&shard_count=${shards}`).then(r => r.data),
  ingestFile:    (file, shardCount) => {
    const fd = new FormData();
    fd.append('file', file);
    if (shardCount) fd.append('shard_count', String(shardCount));
    return client.post('/ingest', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  query:         (sql)              => client.post('/query', { sql }).then(r => r.data),
  explain:       (sql)              => client.post('/explain', { sql }).then(r => r.data),
  cluster:       ()                 => client.get('/cluster').then(r => r.data),
  failShard:     (t, sid)           => client.post('/cluster/fail_shard', { table_name: t, shard_id: sid }).then(r => r.data),
  recoverShard:  (t, sid)           => client.post('/cluster/recover_shard', { table_name: t, shard_id: sid }).then(r => r.data),
  copilot:       (question)         => client.post('/copilot', { question }).then(r => r.data),
  history:       ()                 => client.get('/history').then(r => r.data),
  listSaved:     ()                 => client.get('/saved').then(r => r.data),
  saveQuery:     (name, sql)        => client.post('/saved', { name, sql }).then(r => r.data),
  deleteSaved:   (id)               => client.delete(`/saved/${id}`).then(r => r.data),
  benchmark:     (table, runs)      => client.post(`/benchmark/run?table_name=${table}&runs=${runs}`).then(r => r.data),
  exportUrl:     ()                 => `${API}/export`,
};
