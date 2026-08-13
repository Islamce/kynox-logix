<!-- KAAF-GENERATED — do not edit by hand. Regenerate with scripts/architecture/generate.sh. -->

# Component — analytics-logistics-engine (C4 L3)

`analytics-logistics-engine` at `packages/logistics-engine` — confidence `verified`. 2 declared public entry point(s), 1 dependency(ies), 1 dependent(s).

```mermaid
graph TB
  subgraph analytics_logistics_engine_box["analytics-logistics-engine"]
    ep_packages_logistics_engine_package_json["packages/logistics-engine/package.json"]
    ep_packages_logistics_engine_src_index_ts["packages/logistics-engine/src/index.ts"]
  end
  analytics_shared_types["analytics-shared-types<br/>packages/shared-types<br/>verified"]
  analytics_logistics_engine_box --> analytics_shared_types
  analytics_api["analytics-api<br/>apps/api<br/>verified"]
  analytics_api --> analytics_logistics_engine_box
```

**Reading this diagram**

- Solid arrow: a dependency declared in a `kaaf.module.json` manifest.
- Dotted arrow: a real import discovered in the source that no manifest declares — see `.ai/drift.json`.
- Node outline reflects confidence: solid = `verified`, dashed = `documented` or `derived`.
<!-- kaaf:bodyDigest=55576c2344d94cffd476607c6298831a9df7b2b87044696a8f9a36cf17a64e0e -->
