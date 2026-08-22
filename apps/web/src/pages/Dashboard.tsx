import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiSend } from '../lib/api';
import { useWorkspaceIds } from '../components/Layout';
import { Card, DataTable, EmptyState, ErrorState, Kpi, Spinner, Badge, PageHeader } from '../components/ui';
import { StatTile } from '../components/intelligence';
import { Chart, SEQUENTIAL_BLUE, SERIES_COLORS } from '../components/Chart';

interface DashboardData {
  dataset: { id: number; name: string; periodStart: string | null; periodEnd: string | null };
  kpis: Record<string, number | null>;
  aging: { bucket: string; materialCount: number; value: number }[];
  byGroup: { group: string; value: number }[];
  byPlant: { plant: string; value: number }[];
  topShortages: { material: string; reason: string; risk: string; gapQty: number }[];
  topExcess: { material: string; excessValue: number; excessQty: number }[];
  healthExplanation: string[];
  notes: string[];
}

export function DashboardPage() {
  const ws = useWorkspaceIds();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ws.stockDatasetId) { setData(null); return; }
    setLoading(true);
    setError(null);
    const qs = ws.movementsDatasetId ? `?movementsDatasetId=${ws.movementsDatasetId}` : '';
    apiGet<DashboardData>(`/api/analytics/dashboard/${ws.stockDatasetId}${qs}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [ws.stockDatasetId, ws.movementsDatasetId]);

  // Phase 2: source-independent transaction categories for the linked
  // movements dataset — receipts/consumption/transfers/returns/adjustments/
  // reversals/unknown, backed by the canonical_transactions engine.

  if (!ws.stockDatasetId) {
    return (
      <EmptyState
        title="No stock dataset selected"
        hint="Upload a stock report (e.g. MB52) in the Data Workspace, then pick it in the header above."
      />
    );
  }
  if (loading) return <Spinner label="Computing dashboard…" />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const k = data.kpis;
  const health = k.healthScore ?? null;
  const healthStatus: 'good' | 'warning' | 'critical' | 'neutral' =
    health === null ? 'neutral' : health >= 75 ? 'good' : health >= 50 ? 'warning' : 'critical';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Executive Dashboard"
        description={<>Dataset: <span className="text-body font-medium">{data.dataset.name}</span> · Period {data.dataset.periodStart ?? 'n/a'} → {data.dataset.periodEnd ?? 'n/a'}</>}
      />

      {data.notes.map((n) => (
        <p key={n} className="text-sm bg-info-soft border border-info/30 text-body rounded-lg px-3 py-2">{n}</p>
      ))}

      <HealthHero health={health} status={healthStatus} explanation={data.healthExplanation} kpis={k} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
        <Kpi name="Total value" value={k.totalValue} status="neutral"
          definition="Sum of stock line values in the selected dataset" formula="Σ line value" />
        <Kpi name="Materials" value={k.totalMaterials} status="neutral"
          definition="Distinct materials with stock lines" />
        <Kpi name="Blocked value" value={k.blockedValue} status={(k.blockedValue ?? 0) > 0 ? 'warning' : 'good'}
          definition="Value of stock in blocked status" />
        <Kpi name="Slow-moving value" value={k.slowMovingValue} status={(k.slowMovingValue ?? 0) > 0 ? 'warning' : 'good'}
          definition="Stock value of materials whose last issue exceeds the slow-moving threshold"
          formula="last issue ≥ configured slow-moving days" />
        <Kpi name="Non-moving value" value={k.nonMovingValue} status={(k.nonMovingValue ?? 0) > 0 ? 'critical' : 'good'}
          definition="Stock value of materials with no issue within the non-moving threshold" />
      </div>

      <SectionHeading label="Where the exposure is" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Inventory aging" subtitle="Value by days since last movement">
          <Chart option={{
            xAxis: { type: 'category', data: data.aging.map((a) => a.bucket), axisLabel: { rotate: 20 } },
            yAxis: { type: 'value', name: 'Value' },
            series: [{
              type: 'bar',
              data: data.aging.map((a, i) => ({
                value: Math.round(a.value * 100) / 100,
                itemStyle: { color: SEQUENTIAL_BLUE[Math.min(i, SEQUENTIAL_BLUE.length - 1)], borderRadius: [4, 4, 0, 0] },
              })),
              barMaxWidth: 48,
            }],
          }} />
        </Card>
        <Card title="Stock value by material group" subtitle="Top 10 groups">
          <Chart option={{
            yAxis: { type: 'category', data: data.byGroup.map((g) => g.group).reverse() },
            xAxis: { type: 'value', name: 'Value' },
            series: [{
              type: 'bar',
              data: data.byGroup.map((g) => Math.round(g.value * 100) / 100).reverse(),
              itemStyle: { color: '#2a78d6', borderRadius: [0, 4, 4, 0] },
              barMaxWidth: 24,
            }],
          }} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Top shortage risks" subtitle="Highest priority exceptions" actions={<Link className="text-sm text-link" to="/inventory">Drill down →</Link>}>
          {data.topShortages.length === 0
            ? <EmptyState title="No shortage risks detected" />
            : (
              <ul className="divide-y divide-line text-sm">
                {data.topShortages.map((s) => (
                  <li key={s.material + s.reason} className="py-2 flex items-start gap-2">
                    <Badge value={s.risk} />
                    <div>
                      <Link to={`/materials?material=${encodeURIComponent(s.material)}`} className="font-medium text-link">{s.material}</Link>
                      <p className="text-muted">{s.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Card>
        <Card title="Top excess stock" subtitle="Working-capital reduction candidates" actions={<Link className="text-sm text-link" to="/inventory">Drill down →</Link>}>
          {data.topExcess.length === 0
            ? <EmptyState title="No excess computed" hint="Link a movements dataset to enable demand-based excess." />
            : (
              <ul className="divide-y divide-line text-sm">
                {data.topExcess.map((e) => (
                  <li key={e.material} className="py-2 flex justify-between">
                    <Link to={`/materials?material=${encodeURIComponent(e.material)}`} className="font-medium text-link">{e.material}</Link>
                    <span className="tabular-nums">{e.excessValue.toLocaleString()} value · {e.excessQty.toLocaleString()} qty</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <SectionHeading label="Direction of travel" />
      <TrendCard stockDatasetId={ws.stockDatasetId} />

      {ws.movementsDatasetId && (
        <>
          <SectionHeading label="Transaction detail" hint="reference, not headline" />
          <MovementCategoriesCard movementsDatasetId={ws.movementsDatasetId} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiet section divider used to group the dashboard into a scannable
// narrative (exposure → trend → detail) instead of one undifferentiated
// stack of cards.
// ---------------------------------------------------------------------------

function SectionHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted whitespace-nowrap">
        {label}
        {hint && <span className="ms-1.5 font-normal normal-case tracking-normal text-subtle">— {hint}</span>}
      </h2>
      <span className="flex-1 h-px bg-line" aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health hero: pulls the single most important read (inventory health) out
// of the flat KPI grid and pairs it with its biggest drivers — excess,
// shortage risk, critical shortages, data quality — so the page answers
// "is inventory healthy?" before anything else competes for attention.
// The remaining KPIs move to a quieter secondary row below.
// ---------------------------------------------------------------------------

function HealthHero({ health, status, explanation, kpis }: {
  health: number | null;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  explanation: string[];
  kpis: Record<string, number | null>;
}) {
  const headline = health === null
    ? 'Inventory health is not yet evaluable'
    : health >= 75 ? 'Inventory is broadly healthy'
    : health >= 50 ? 'Inventory needs focused attention'
    : 'Inventory exposure requires action';
  const ringColor = { good: '#12a150', warning: '#e0930d', critical: '#d83a3a', neutral: '#97a4b6' }[status];
  const circumference = 2 * Math.PI * 32;
  const filled = health === null ? 0 : Math.max(0, Math.min(100, health));
  const dashoffset = circumference * (1 - filled / 100);

  return (
    <section className="grid lg:grid-cols-[1.3fr_1fr] rounded-2xl overflow-hidden border border-line shadow-[var(--kx-shadow-sm)]">
      <div
        className="relative overflow-hidden p-5 sm:p-6 text-white"
        style={{ background: 'linear-gradient(135deg,var(--kx-sidebar-bg),var(--kx-neutral-850))' }}
      >
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border border-white/10" aria-hidden />
        <p className="relative text-[11px] uppercase tracking-[0.18em] text-cyan-200/80 font-semibold">Inventory health signal</p>
        <h2 className="relative mt-2 max-w-md text-xl sm:text-2xl font-semibold tracking-tight">{headline}</h2>
        <p className="relative mt-2 max-w-sm text-sm leading-6 text-slate-300">
          Weighted index across availability, excess, obsolescence, aging, turnover and data quality.
        </p>
        <div className="relative mt-4 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
            <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
              <circle cx={38} cy={38} r={32} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={8} />
              {health !== null && (
                <circle
                  cx={38} cy={38} r={32} fill="none" stroke={ringColor} strokeWidth={8} strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={dashoffset}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-lg leading-none tabular-nums">{health === null ? '—' : health}</strong>
              <small className="text-[8.5px] text-slate-400">/ 100</small>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-slate-400 max-w-[15rem]">
            {explanation.length ? explanation[0] : 'Definition and formula details are available from the KPI explanation.'}
          </p>
        </div>
      </div>
      <div className="bg-surface p-4 sm:p-5 grid grid-cols-2 gap-2.5">
        <Kpi name="Excess value" value={kpis.excessValue} status={(kpis.excessValue ?? 0) > 0 ? 'warning' : 'good'}
          definition="Stock value above the configured coverage target" formula="stock − daily demand × coverage days" />
        <Kpi name="Shortage-risk materials" value={kpis.shortageMaterials}
          status={(kpis.criticalShortages ?? 0) > 0 ? 'critical' : (kpis.shortageMaterials ?? 0) > 0 ? 'warning' : 'good'}
          definition="Materials below safety stock / reorder point, or with negative availability" />
        <Kpi name="Critical shortages" value={kpis.criticalShortages} status={(kpis.criticalShortages ?? 0) > 0 ? 'critical' : 'good'}
          definition="Negative availability or uncovered reservations" />
        <Kpi name="Data quality" value={kpis.dataQualityScore} unit="/100"
          status={(kpis.dataQualityScore ?? 0) >= 90 ? 'good' : 'warning'}
          definition="Overall data-quality score of the dataset at creation time" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trend: headline KPIs across prior stock snapshots for the same company/
// plant series, so the exec view shows direction of travel, not just a
// single point-in-time read.
// ---------------------------------------------------------------------------

interface TrendPoint {
  datasetId: number;
  name: string;
  periodEnd: string | null;
  createdAt: string;
  totalValue: number;
  totalMaterials: number;
  healthScore: number | null;
  criticalShortages: number;
  shortageMaterials: number;
}

function TrendCard({ stockDatasetId }: { stockDatasetId: number }) {
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<{ points: TrendPoint[] }>(`/api/analytics/trend/${stockDatasetId}`)
      .then((r) => setPoints(r.points))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load trend'))
      .finally(() => setLoading(false));
  }, [stockDatasetId]);

  if (loading) return <Card title="Trend"><Spinner label="Loading trend…" /></Card>;
  if (error) return null; // non-critical secondary view — don't block the dashboard on it
  if (!points || points.length < 2) return null; // need at least two snapshots to show direction

  const labels = points.map((p) => p.periodEnd ?? p.createdAt.slice(0, 10));

  return (
    <Card title="Trend across snapshots" subtitle={`Last ${points.length} stock datasets for this company/plant, oldest → newest`}>
      <div className="grid lg:grid-cols-2 gap-4">
        <Chart option={{
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 20 } },
          yAxis: [
            { type: 'value', name: 'Health /100', min: 0, max: 100 },
            { type: 'value', name: 'Value' },
          ],
          legend: { data: ['Inventory health', 'Total value'] },
          series: [
            {
              name: 'Inventory health',
              type: 'line',
              yAxisIndex: 0,
              data: points.map((p) => p.healthScore),
              itemStyle: { color: SERIES_COLORS[1] },
              smooth: true,
            },
            {
              name: 'Total value',
              type: 'line',
              yAxisIndex: 1,
              data: points.map((p) => Math.round(p.totalValue * 100) / 100),
              itemStyle: { color: SERIES_COLORS[0] },
              smooth: true,
            },
          ],
        }} />
        <Chart option={{
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 20 } },
          yAxis: { type: 'value', name: 'Materials' },
          legend: { data: ['Critical shortages', 'All shortage-risk'] },
          series: [
            {
              name: 'All shortage-risk',
              type: 'bar',
              data: points.map((p) => p.shortageMaterials),
              itemStyle: { color: SERIES_COLORS[3], borderRadius: [4, 4, 0, 0] },
              barMaxWidth: 32,
            },
            {
              name: 'Critical shortages',
              type: 'bar',
              data: points.map((p) => p.criticalShortages),
              itemStyle: { color: SERIES_COLORS[7], borderRadius: [4, 4, 0, 0] },
              barMaxWidth: 32,
            },
          ],
        }} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase 2: movement-category cards + a demand-filtered canonical transaction
// browser for the linked movements dataset. Source-independent — driven by
// canonical_transactions, not SAP movement types.
// ---------------------------------------------------------------------------

interface NormalizationSummary {
  receiptRows: number; consumptionRows: number; transferRows: number; returnRows: number;
  adjustmentRows: number; reversalRows: number; neutralRows: number; unknownTransactionRows: number;
  totalReceiptQuantity: number; totalConsumptionQuantity: number;
}
interface NormalizationDetail {
  sourceSystem: string | null;
  summary: NormalizationSummary | null;
}
interface CanonicalRow extends Record<string, unknown> {
  id: number; source_row_number: number; material_id: string; transaction_date: string | null;
  signed_quantity: number | null; transaction_direction: string; transaction_category: string;
  warehouse_name: string | null; currency: string | null; transaction_value: number | null;
}

/** Categories excluded from the default "demand" view — internal movement, not external demand/supply. */
const NON_DEMAND_CATEGORIES = new Set([
  'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_IN', 'RETURN_OUT',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL_IN', 'REVERSAL_OUT',
]);

/** Every category a row can be manually reclassified into (matches the API's accepted values). */
const OVERRIDE_CATEGORIES = [
  'RECEIPT', 'CONSUMPTION', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_IN', 'RETURN_OUT',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'OPENING_BALANCE', 'CLOSING_BALANCE', 'STOCK_COUNT',
  'RESERVATION', 'BLOCKED_STOCK', 'QUALITY_INSPECTION', 'REVERSAL_IN', 'REVERSAL_OUT',
  'NEUTRAL', 'UNKNOWN',
];

function MovementCategoriesCard({ movementsDatasetId }: { movementsDatasetId: number }) {
  const [norm, setNorm] = useState<NormalizationDetail | null>(null);
  const [rows, setRows] = useState<CanonicalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [demandOnly, setDemandOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    return Promise.all([
      apiGet<NormalizationDetail>(`/api/datasets/${movementsDatasetId}/normalization`),
      apiGet<{ rows: CanonicalRow[]; total: number }>(`/api/datasets/${movementsDatasetId}/canonical?pageSize=500`),
    ])
      .then(([n, c]) => { setNorm(n); setRows(c.rows); setTotal(c.total); })
      .catch(() => { setNorm(null); setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [movementsDatasetId]);

  const overrideCategory = async (row: CanonicalRow, category: string) => {
    setSavingId(row.id); setOverrideError(null);
    try {
      await apiSend('PATCH', `/api/datasets/${movementsDatasetId}/canonical/${row.id}`, { category });
      await load(); // re-fetch: the dataset-level summary and this row's derived fields both changed
    } catch (e) {
      setOverrideError(e instanceof Error ? e.message : 'Failed to update classification');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <Card title="Transaction categories"><Spinner label="Loading transaction categories…" /></Card>;
  if (!norm?.summary) return null; // pre-Phase-2 dataset: no canonical data to show

  const s = norm.summary;
  const visibleRows = demandOnly ? rows.filter((r) => !NON_DEMAND_CATEGORIES.has(r.transaction_category)) : rows;

  return (
    <Card
      title="Transaction categories"
      subtitle="Source-independent classification of every transaction in the linked movements dataset — never SAP-specific movement codes"
      actions={norm.sourceSystem && <Badge value="info" label={norm.sourceSystem} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <StatTile label="Receipt" value={s.receiptRows} tone="positive" hint={s.totalReceiptQuantity.toLocaleString()} />
        <StatTile label="Consumption" value={s.consumptionRows} tone="warning" hint={s.totalConsumptionQuantity.toLocaleString()} />
        <StatTile label="Transfers" value={s.transferRows} tone="info" />
        <StatTile label="Returns" value={s.returnRows} tone="info" />
        <StatTile label="Adjustments" value={s.adjustmentRows} tone="warning" />
        <StatTile label="Reversals" value={s.reversalRows} tone="warning" />
        <StatTile label="Unknown" value={s.unknownTransactionRows} tone={s.unknownTransactionRows > 0 ? 'risk' : 'positive'}
          hint="excluded from receipt/consumption KPIs" />
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-line-strong overflow-hidden text-sm">
          <button type="button"
            className={`px-3 py-1.5 ${demandOnly ? 'bg-brand text-on-brand' : 'bg-surface text-body hover:bg-sunken'}`}
            onClick={() => setDemandOnly(true)}
          >
            Demand view (default)
          </button>
          <button type="button"
            className={`px-3 py-1.5 border-s border-line-strong ${!demandOnly ? 'bg-brand text-on-brand' : 'bg-surface text-body hover:bg-sunken'}`}
            onClick={() => setDemandOnly(false)}
          >
            All transactions
          </button>
        </div>
        <span className="text-xs text-subtle">
          {demandOnly
            ? 'Transfers, returns, adjustments and reversals are hidden by default — they are internal movement, not external demand or supply.'
            : `Showing every transaction category (${total.toLocaleString()} total in the dataset).`}
        </span>
      </div>

      {overrideError && (
        <p className="mt-2 text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">{overrideError}</p>
      )}

      <div className="mt-2">
        <DataTable<CanonicalRow>
          columns={[
            { key: 'source_row_number', label: 'Row', numeric: true, render: (r) => r.source_row_number + 2 },
            { key: 'material_id', label: 'Material' },
            { key: 'transaction_date', label: 'Date' },
            { key: 'signed_quantity', label: 'Signed qty', numeric: true },
            { key: 'transaction_direction', label: 'Direction' },
            {
              key: 'transaction_category', label: 'Category',
              render: (r) => (
                <select
                  className="border border-line-strong rounded-lg px-2 py-1 bg-surface text-body text-xs disabled:opacity-50"
                  value={r.transaction_category}
                  disabled={savingId === r.id}
                  aria-label={`Category for row ${r.source_row_number + 2}`}
                  onChange={(e) => void overrideCategory(r, e.target.value)}
                >
                  {OVERRIDE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ),
            },
            { key: 'warehouse_name', label: 'Warehouse' },
            { key: 'transaction_value', label: 'Value', numeric: true },
          ]}
          rows={visibleRows}
          exportName={`dataset-${movementsDatasetId}-transactions-${demandOnly ? 'demand' : 'all'}`}
        />
      </div>
    </Card>
  );
}
