"""
Adaptive router: per-shard latency history → preferentially route to faster shards.
Mirrors Cassandra speculative execution / Bigtable hedged requests.
"""
from queryforge.schema_registry import SchemaRegistry


def pick_best_shard(table_name, candidate_shards):
    if len(candidate_shards) <= 1:
        return candidate_shards[0] if candidate_shards else None
    profile = SchemaRegistry().get_shard_latency_profile(table_name)

    def score(sid):
        if sid not in profile or profile[sid]["sample_count"] < 3:
            return 0.0  # No data → assume fast (explore)
        return profile[sid]["p50"]

    return min(candidate_shards, key=score)


def rank_shards_by_latency(table_name, candidate_shards):
    profile = SchemaRegistry().get_shard_latency_profile(table_name)

    def score(sid):
        if sid not in profile or profile[sid]["sample_count"] < 3:
            return 0.0
        return profile[sid]["p50"]

    return sorted(candidate_shards, key=score)
