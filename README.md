# QueryForge: Distributed Parallel SQL Query Engine 

## Live Demo

🚀 **[QueryForge – Live Application](https://queryforge-engine-frontend.vercel.app/)**
 
## System Architectural Blueprint 
QueryForge is a local-first distributed SQL query engine designed to shard raw datasets across isolated database storage units and execute analytical aggregations in parallel. By decomposing standard SQL strings into abstract syntax trees, the system applies column-level partition pruning to minimize disk I/O and optimize multi-node analytical workloads. 
 
## Key Engineering Features 
* **Asynchronous Scatter-Gather Execution:** Utilizes Python asynchronous coroutines to scatter rewritten SQL vectors across shards in parallel, avoiding GIL serialization. 
* **Predicate Pushdown Optimization:** Computes min/max column statistics eagerly during ingestion to prune shards that cannot satisfy range filters, reducing shard scans by 3-4x. 
* **Mathematical Aggregate Decomposition:** Decomposes complex aggregates like AVG into algebraic SUM and COUNT partials before scattering, ensuring mathematical correctness across uneven row distributions. 
* **Fault-Tolerant Partial Merging:** Gracefully isolates isolated shard simulation failures, returning partial datasets with real-time operational status warning flags instead of system crashes.

## Technology Stack

- **Backend:** Python, FastAPI, AsyncIO
- **Frontend:** React
- **Database:** SQLite (WAL mode)
- **SQL Parsing:** SQLGlot
- **Data Processing:** Pandas
- **AI Integration:** Gemini

## Deployment Architecture

QueryForge is deployed using separate frontend and backend hosting services.

| Component                  | Hosting Platform                       |
| -------------------------- | -------------------------------------- |
| React Frontend             | Vercel                                 |
| FastAPI Backend            | Render                                 |
| Database and Shard Storage | SQLite with persistent backend storage |

The frontend communicates with the backend through REST API endpoints. The backend manages dataset ingestion, schema discovery, shard creation, query planning, parallel execution, and result merging.
 
## Production Infrastructure Stack & Performance 
* **Core Coordinator Runtime:** Python 3 with FastAPI and Asyncio Execution Loops 
* **Distributed Storage Shards:** Isolated SQLite Engine Instances in WAL Mode 
* **SQL Parsing Architecture:** Abstract Syntax Tree Analysis via SqlGlot 
* **Performance Scale Baseline:** Processes 20K to 200K row sets with P50 broadcast latency under 30ms and targeted queries under 8ms. 
 
## System Topography Map 
* `/backend` - Holds the query planner, AST evaluation hooks, aiosqlite pools, and scatter-gather coordinators. 
* `/frontend` - React 19 and Tailwind CSS control center canvas featuring interactive shard topology visualization graphs. 
* `/datasets` - Relational CSV workspace targets used for parallel range partitioning execution runs.
