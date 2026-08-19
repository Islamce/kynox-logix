import { useMemo, useState } from 'react';
import { useWorkspaceIds } from '../components/Layout';
import { useFetch } from './Inventory';
import { Card, EmptyState, ErrorState, Spinner } from '../components/ui';
import { IntelligenceHeader } from '../components/intelligence';

/**
 * Scenario Simulation — "what-if" exploration on top of the existing planning
 * proposal for a material. Fetches the same baseline the Planning page uses
 * (`/api/analytics/planning/:stockId/:movementsId?material=`), which already
 * returns the current safety-stock inputs (avg daily demand, lead time,
 * service level, sigma) alongside the recommended proposal. The user can then
 * drag lead-time / service-level / demand-growth sliders and see the safety
 * stock, reorder point and min/max recompute live — using the exact formulas
 * documented in packages/analytics-engine/src/planning.ts (statistical
 * service-level method), mirrored here in pure client-side TypeScript so the
 * recompute is instant. No new backend endpoint or business rule: this is a
 * transparent, reviewable re-application of the same math already trusted
 * elsewhere in the product, with every formula and assumption shown.
 */

// z-score for a given service level via a rational approximation of the
// inverse standard normal CDF (Acklam's algorithm), matching
// packages/analytics-engine/src/stats.ts's normInv so results agree exactly
// with the backend proposal at 0% scenario deltas.
function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

const round = (n: number, dp = 3) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

interface PlanningResponse {
  insufficientData: boolean;
  note?: string;
  current?: Record<string, number | null>;
  proposed?: {
    safetyStock: { safetyStock: number; formula: string; assumptions: string[]; inputs: Record<string, number> };
    reorderPoint: { reorderPoint: number; leadTimeDemand: number; formula: string };
    minMax: { minStock: number; maxStock: number; orderQuantity: number; formula: string };
  };
  assumptions?: string[];
}

export function ScenarioSimulationPage() {
  const ws = useWorkspaceIds();
  const [material, setMaterial] = useState('');
  const [applied, setApplied] = useState('');

  const planningUrl = ws.stockDatasetId && ws.movementsDatasetId && applied
    ? `/api/analytics/planning/${ws.stockDatasetId}/${ws.movementsDatasetId}?material=${encodeURIComponent(applied)}`
    : null;
  const planning = useFetch<PlanningResponse>(planningUrl);

  // Scenario controls — deltas applied on top of the fetched baseline inputs.
  const [leadTimeDeltaDays, setLeadTimeDeltaDays] = useState(0);
  const [serviceLevelOverride, setServiceLevelOverride] = useState<number | null>(null);
  const [demandGrowthPct, setDemandGrowthPct] = useState(0);
  const [coverageTargetDays, setCoverageTargetDays] = useState(30);

  const baseline = planning.data?.proposed;
  const baseInputs = baseline?.safetyStock.inputs;

  const scenario = useMemo(() => {
    if (!baseInputs) return null;
    const avgDaily = (baseInputs.avgDailyDemand ?? 0) * (1 + demandGrowthPct / 100);
    const sigmaDaily = (baseInputs.sigmaDaily ?? 0) * (1 + demandGrowthPct / 100);
    const leadTimeDays = Math.max(0, (baseInputs.leadTimeDays ?? 0) + leadTimeDeltaDays);
    const serviceLevel = serviceLevelOverride ?? (baseInputs.serviceLevel ?? 0.95);
    const z = normInv(serviceLevel);

    const safetyStock = Math.max(0, z * sigmaDaily * Math.sqrt(leadTimeDays));
    const leadTimeDemand = avgDaily * leadTimeDays;
    const reorderPoint = leadTimeDemand + safetyStock;
    const minStock = reorderPoint;
    const maxStock = minStock + avgDaily * coverageTargetDays;

    return {
      avgDaily: round(avgDaily, 4),
      sigmaDaily: round(sigmaDaily, 4),
      leadTimeDays: round(leadTimeDays, 2),
      serviceLevel,
      z: round(z, 4),
      safetyStock: round(safetyStock),
      leadTimeDemand: round(leadTimeDemand),
      reorderPoint: round(reorderPoint),
      minStock: round(minStock),
      maxStock: round(maxStock),
      orderQuantity: round(maxStock - minStock),
    };
  }, [baseInputs, leadTimeDeltaDays, serviceLevelOverride, demandGrowthPct, coverageTargetDays]);

  const reset = () => {
    setLeadTimeDeltaDays(0);
    setServiceLevelOverride(null);
    setDemandGrowthPct(0);
    setCoverageTargetDays(30);
  };

  if (!ws.movementsDatasetId || !ws.stockDatasetId) {
    return (
      <EmptyState
        title="Scenario Simulation needs stock and movements datasets"
        hint="Select both a stock and a movements dataset in the header. Scenarios recompute the same safety-stock, reorder-point and min/max formulas Planning & Forecasting uses, with adjustable lead time, service level, demand growth and coverage target."
      />
    );
  }

  return (
    <div className="space-y-4">
      <IntelligenceHeader
        eyebrow="Scenario Simulation"
        title="What-If Planning Scenarios"
        description="Stress-test the safety-stock proposal against lead-time delays, service-level targets and demand growth — every number recomputed live from the same statistical service-level formulas used in Planning & Forecasting, with full transparency."
      />
      <div className="flex items-center gap-2">
        <input
          className="border border-line-strong rounded-lg px-3 py-1.5 text-sm bg-surface w-64"
          placeholder="Material code (exact)"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setApplied(material.trim()); }}
          aria-label="Material code for scenario simulation"
        />
        <button type="button" className="bg-brand hover:bg-brand-hover text-white rounded-lg px-4 py-1.5 text-sm" onClick={() => setApplied(material.trim())}>
          Load baseline
        </button>
        {baseInputs && (
          <button type="button" className="border border-line rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-sunken" onClick={reset}>
            Reset scenario
          </button>
        )}
      </div>

      {!applied && <EmptyState title="Enter a material to simulate" hint="Loads the current planning baseline (average demand, lead time, variability, service level) as the scenario starting point." />}
      {planning.loading && <Spinner label="Loading baseline…" />}
      {planning.error && <ErrorState message={planning.error} />}

      {planning.data && planning.data.insufficientData && (
        <Card title="Scenario Simulation"><p className="text-sm text-muted">{planning.data.note}</p></Card>
      )}

      {baseInputs && scenario && (
        <>
          <Card title="Scenario inputs" subtitle="Adjust to stress-test the proposal. All changes apply on top of the fetched baseline for this material.">
            <div className="grid md:grid-cols-2 gap-5 text-sm">
              <SliderRow
                label="Lead-time change"
                value={leadTimeDeltaDays}
                onChange={setLeadTimeDeltaDays}
                min={-Math.min(30, Math.floor(baseInputs.leadTimeDays ?? 0))}
                max={60}
                step={1}
                format={(v) => `${v > 0 ? '+' : ''}${v} day${Math.abs(v) === 1 ? '' : 's'}`}
                hint={`Baseline lead time: ${baseInputs.leadTimeDays ?? '—'} days`}
              />
              <SliderRow
                label="Service level"
                value={Math.round((serviceLevelOverride ?? baseInputs.serviceLevel ?? 0.95) * 100)}
                onChange={(v) => setServiceLevelOverride(v / 100)}
                min={50}
                max={99.9}
                step={0.5}
                format={(v) => `${round(v, 1)}%`}
                hint={`Baseline: ${round((baseInputs.serviceLevel ?? 0.95) * 100, 1)}%`}
              />
              <SliderRow
                label="Demand growth"
                value={demandGrowthPct}
                onChange={setDemandGrowthPct}
                min={-50}
                max={200}
                step={5}
                format={(v) => `${v > 0 ? '+' : ''}${v}%`}
                hint="Scales both average demand and its variability proportionally."
              />
              <SliderRow
                label="Coverage target (Max stock)"
                value={coverageTargetDays}
                onChange={setCoverageTargetDays}
                min={0}
                max={180}
                step={5}
                format={(v) => `${v} days`}
                hint="Additional days of average demand covered above the reorder point."
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Baseline (as-is proposal)" subtitle="From Planning & Forecasting, unchanged">
              <ProposalGrid
                safetyStock={baseline!.safetyStock.safetyStock}
                leadTimeDemand={baseline!.reorderPoint.leadTimeDemand}
                reorderPoint={baseline!.reorderPoint.reorderPoint}
                minStock={baseline!.minMax.minStock}
                maxStock={baseline!.minMax.maxStock}
                orderQuantity={baseline!.minMax.orderQuantity}
              />
            </Card>
            <Card title="Scenario result" subtitle="Recomputed live from your adjustments above">
              <ProposalGrid
                safetyStock={scenario.safetyStock}
                leadTimeDemand={scenario.leadTimeDemand}
                reorderPoint={scenario.reorderPoint}
                minStock={scenario.minStock}
                maxStock={scenario.maxStock}
                orderQuantity={scenario.orderQuantity}
                compareTo={{
                  safetyStock: baseline!.safetyStock.safetyStock,
                  reorderPoint: baseline!.reorderPoint.reorderPoint,
                  maxStock: baseline!.minMax.maxStock,
                }}
              />
            </Card>
          </div>

          <Card title="Formulas & assumptions" subtitle="Same statistical service-level method as Planning & Forecasting — nothing hidden">
            <div className="text-sm space-y-2">
              <p className="text-body"><span className="font-medium">Safety stock</span> = z(service level) × σ_daily_demand × √(lead time)</p>
              <p className="text-body"><span className="font-medium">Reorder point</span> = average daily demand × lead time + safety stock</p>
              <p className="text-body"><span className="font-medium">Min / Max</span> = Min = reorder point; Max = Min + average daily demand × coverage target</p>
              <ul className="list-disc ms-5 text-xs text-muted mt-2">
                <li>z at {round(scenario.serviceLevel * 100, 1)}% service level = {scenario.z}</li>
                <li>Scenario average daily demand: {scenario.avgDaily} (baseline {baseInputs.avgDailyDemand ?? '—'}, {demandGrowthPct > 0 ? '+' : ''}{demandGrowthPct}% growth applied)</li>
                <li>Scenario σ daily demand: {scenario.sigmaDaily}</li>
                <li>Scenario lead time: {scenario.leadTimeDays} days</li>
                <li>Demand and lead time assumed independent; demand assumed approximately normal — same assumptions as the baseline proposal.</li>
                <li>This is a planning aid, not a system change — nothing here writes back to stock policy; a planner reviews and applies changes deliberately.</li>
              </ul>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SliderRow({
  label, value, onChange, min, max, step, format, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  format: (v: number) => string; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-body font-medium">{label}</label>
        <span className="tabular-nums text-link font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        className="w-full accent-[var(--kx-brand-600)]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <p className="text-xs text-subtle mt-0.5">{hint}</p>}
    </div>
  );
}

function ProposalGrid({
  safetyStock, leadTimeDemand, reorderPoint, minStock, maxStock, orderQuantity, compareTo,
}: {
  safetyStock: number; leadTimeDemand: number; reorderPoint: number;
  minStock: number; maxStock: number; orderQuantity: number;
  compareTo?: { safetyStock: number; reorderPoint: number; maxStock: number };
}) {
  const delta = (curr: number, base?: number) => {
    if (base === undefined) return null;
    const d = curr - base;
    if (Math.abs(d) < 0.005) return null;
    return d > 0 ? `+${round(d)}` : `${round(d)}`;
  };
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div className="bg-sunken rounded-lg p-3">
        <p className="text-xs text-muted">Safety stock</p>
        <p className="text-lg font-bold tabular-nums">{safetyStock.toLocaleString()}</p>
        {compareTo && delta(safetyStock, compareTo.safetyStock) && (
          <p className="text-[11px] text-subtle">{delta(safetyStock, compareTo.safetyStock)} vs baseline</p>
        )}
      </div>
      <div className="bg-sunken rounded-lg p-3">
        <p className="text-xs text-muted">Reorder point</p>
        <p className="text-lg font-bold tabular-nums">{reorderPoint.toLocaleString()}</p>
        {compareTo && delta(reorderPoint, compareTo.reorderPoint) && (
          <p className="text-[11px] text-subtle">{delta(reorderPoint, compareTo.reorderPoint)} vs baseline</p>
        )}
        <p className="text-[11px] text-subtle">Lead-time demand: {leadTimeDemand.toLocaleString()}</p>
      </div>
      <div className="bg-sunken rounded-lg p-3">
        <p className="text-xs text-muted">Min / Max</p>
        <p className="text-lg font-bold tabular-nums">{minStock.toLocaleString()} / {maxStock.toLocaleString()}</p>
        {compareTo && delta(maxStock, compareTo.maxStock) && (
          <p className="text-[11px] text-subtle">Max {delta(maxStock, compareTo.maxStock)} vs baseline</p>
        )}
        <p className="text-[11px] text-subtle">Order qty: {orderQuantity.toLocaleString()}</p>
      </div>
    </div>
  );
}
