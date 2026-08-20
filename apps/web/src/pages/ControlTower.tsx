import { useMemo, useState } from 'react';
import { useWorkspaceIds } from '../components/Layout';
import { useFetch } from './Inventory';
import { Card, DataTable, EmptyState, ErrorState, Spinner, Badge, PageHeader, type Column } from '../components/ui';
import { StatTile } from '../components/intelligence';

/**
 * Control Tower — an operations triage view, distinct from the Executive
 * Dashboard's summary KPIs (which the dashboard already surfaces per
 * docs/FRONTEND_CHECKLIST.md's note that "its KPIs are on the dashboard").
 * This page answers a different question: "what needs attention right now,
 * ranked by severity, with a reason for each item" — for a planner working
 * the exception queue rather than reporting up. It composes three existing
 * analytics endpoints (no new backend logic):
 *   - /api/analytics/shortage/:stockId            → ranked stockout risk
 *   - /api/analytics/excess/:stockId               → ranked excess exposure
 *   - /api/analytics/movement-categories/:stockId  → non-moving/slow-moving counts
 */

interface ShortageResult {
  material: string;
  reason: string;
  stockQty: number;
  safetyStock?: number;
  reorderPoint?: number;
  gapQty: number;
  risk: 'critical' | 'high' | 'medium';
  [key: string]: unknown;
}
interface ShortageResponse {
  results: ShortageResult[];
  summary: { critical: number; high: number; medium: number };
}

interface ExcessResult {
  material: string;
  method: string;
  stockQty: number;
  stockValue: number;
  referenceQty: number;
  excessQty: number;
  excessValue: number;
  [key: string]: unknown;
}
interface ExcessResponse {
  method: string;
  results: ExcessResult[];
  totalExcessValue: number;
  note?: string;
}

interface MovementCategoryResult {
  material: string;
  category: string;
  stockValue: number;
}
interface MovementCategoryResponse {
  asOfDate: string;
  results: MovementCategoryResult[];
  summary: Record<string, { count: number; value: number }>;
}

const RISK_ORDER: Record<ShortageResult['risk'], number> = { critical: 0, high: 1, medium: 2 };

const shortageColumns: Column<ShortageResult>[] = [
  { key: 'material', label: 'Material' },
  { key: 'risk', label: 'Risk', render: (r) => <Badge value={r.risk} /> },
  { key: 'reason', label: 'Reason' },
  { key: 'stockQty', label: 'Stock qty', numeric: true },
  { key: 'gapQty', label: 'Gap qty', numeric: true },
];

const excessColumns: Column<ExcessResult>[] = [
  { key: 'material', label: 'Material' },
  { key: 'stockQty', label: 'Stock qty', numeric: true },
  { key: 'referenceQty', label: 'Reference qty', numeric: true },
  { key: 'excessQty', label: 'Excess qty', numeric: true },
  { key: 'excessValue', label: 'Excess value', numeric: true },
];

export function ControlTowerPage() {
  const ws = useWorkspaceIds();
  const [excessMethod, setExcessMethod] = useState<'above_coverage_target' | 'above_max_stock' | 'no_demand'>('above_coverage_target');

  const shortageUrl = ws.stockDatasetId
    ? `/api/analytics/shortage/${ws.stockDatasetId}${ws.movementsDatasetId ? `?movementsDatasetId=${ws.movementsDatasetId}` : ''}`
    : null;
  const excessUrl = ws.stockDatasetId
    ? `/api/analytics/excess/${ws.stockDatasetId}?method=${excessMethod}${ws.movementsDatasetId ? `&movementsDatasetId=${ws.movementsDatasetId}` : ''}`
    : null;
  const categoriesUrl = ws.stockDatasetId
    ? `/api/analytics/movement-categories/${ws.stockDatasetId}${ws.movementsDatasetId ? `?movementsDatasetId=${ws.movementsDatasetId}` : ''}`
    : null;

  const shortage = useFetch<ShortageResponse>(shortageUrl);
  const excess = useFetch<ExcessResponse>(excessUrl);
  const categories = useFetch<MovementCategoryResponse>(categoriesUrl);

  const rankedShortages = useMemo(
    () => (shortage.data?.results ?? []).slice().sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.gapQty - a.gapQty),
    [shortage.data],
  );

  if (!ws.stockDatasetId) {
    return (
      <EmptyState
        title="Control Tower needs a stock dataset"
        hint="Select a stock dataset in the header. Add a movements dataset too for demand-aware shortage and excess signals."
      />
    );
  }

  const loading = shortage.loading || excess.loading || categories.loading;
  const anyError = shortage.error || excess.error || categories.error;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Control Tower"
        description="Live exception queue — what needs action right now, ranked by severity. Reuses the same shortage, excess and movement-category analyses as the rest of the platform; nothing here is a separate source of truth."
      />

      {loading && <Spinner label="Scanning for exceptions…" />}
      {anyError && <ErrorState message={anyError ?? 'Failed to load control tower data'} />}

      {!loading && !anyError && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Critical shortages"
              value={shortage.data?.summary.critical ?? 0}
              tone={(shortage.data?.summary.critical ?? 0) > 0 ? 'risk' : 'positive'}
              hint="Negative available stock or unmet reservations"
            />
            <StatTile
              label="High-risk shortages"
              value={shortage.data?.summary.high ?? 0}
              tone={(shortage.data?.summary.high ?? 0) > 0 ? 'warning' : 'positive'}
              hint="Below safety stock"
            />
            <StatTile
              label="Excess exposure"
              value={(excess.data?.totalExcessValue ?? 0).toLocaleString()}
              tone={(excess.data?.totalExcessValue ?? 0) > 0 ? 'warning' : 'positive'}
              hint={`By ${excessMethod.replace(/_/g, ' ')}`}
            />
            <StatTile
              label="Non-moving materials"
              value={categories.data?.summary.non_moving?.count ?? 0}
              tone={(categories.data?.summary.non_moving?.count ?? 0) > 0 ? 'warning' : 'positive'}
              hint={categories.data ? `As of ${categories.data.asOfDate}` : undefined}
            />
          </div>

          <Card
            title="Shortage exceptions"
            subtitle="Ranked by risk, then gap quantity — same shortageRisks() logic as Reports and the Dashboard's top-shortages list"
          >
            {rankedShortages.length === 0 ? (
              <p className="text-sm text-muted">No shortage exceptions detected in the current dataset selection.</p>
            ) : (
              <DataTable rows={rankedShortages} columns={shortageColumns} exportName="control-tower-shortages" />
            )}
          </Card>

          <Card
            title="Excess exceptions"
            subtitle="Ranked by excess value — reuses /api/analytics/excess with a selectable method, same as the Inventory page"
            actions={
              <select
                className="border border-line-strong rounded-lg px-2 py-1 text-sm bg-surface"
                value={excessMethod}
                onChange={(e) => setExcessMethod(e.target.value as typeof excessMethod)}
                aria-label="Excess method"
              >
                <option value="above_coverage_target">Above coverage target</option>
                <option value="above_max_stock">Above max stock</option>
                <option value="no_demand">No demand</option>
              </select>
            }
          >
            {excess.data?.note && <p className="text-xs text-subtle mb-2">{excess.data.note}</p>}
            {(excess.data?.results ?? []).length === 0 ? (
              <p className="text-sm text-muted">No excess exceptions detected for this method.</p>
            ) : (
              <DataTable rows={excess.data?.results ?? []} columns={excessColumns} exportName="control-tower-excess" />
            )}
          </Card>

          <Card title="Movement category summary" subtitle="Non-moving / slow-moving / active split, same engine as the Dashboard's category breakdown">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Object.entries(categories.data?.summary ?? {}).map(([cat, s]) => (
                <div key={cat} className="bg-sunken rounded-lg p-3">
                  <p className="text-xs text-muted capitalize">{cat.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold tabular-nums">{s.count.toLocaleString()}</p>
                  <p className="text-[11px] text-subtle">Value: {s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
