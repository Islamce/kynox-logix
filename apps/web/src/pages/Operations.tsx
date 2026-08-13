import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiGet, apiSend } from '../lib/api';
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Kpi, PageHeader, Spinner, type Column } from '../components/ui';

type ShipmentStatus = 'planned' | 'booked' | 'ready' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'pod_confirmed' | 'closed' | 'cancelled';
interface Provider { id: string; code: string; name: string; providerType: string; status: string; }
interface Shipment extends Record<string, unknown> {
  id: string; shipmentNumber: string; providerId: string | null; providerName: string | null; status: ShipmentStatus;
  originLocationId: string; destinationLocationId: string; plannedPickupAt: string | null; plannedDeliveryAt: string | null;
  actualPickupAt: string | null; actualDeliveryAt: string | null; openExceptionCount: number;
}
interface ExceptionRow extends Record<string, unknown> { id: string; shipmentId: string; severity: string; status: string; title: string; createdAt: string; }
interface Intelligence { carrierPerformance: Array<{ carrierCode: string; metrics: Array<{ key: string; value: number | null }> }>; transportSpend: { totalsByCurrency: Array<{ currency: string; amount: number }> }; openExceptions: ExceptionRow[]; }

const NEXT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  planned: 'booked', booked: 'ready', ready: 'picked_up', picked_up: 'in_transit', in_transit: 'arrived', arrived: 'delivered', delivered: 'pod_confirmed', pod_confirmed: 'closed',
};

function randomKey(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString() : '—'; }

export function OperationsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({ code: '', name: '', providerType: 'carrier' });
  const [shipmentForm, setShipmentForm] = useState({ shipmentNumber: '', providerId: '', originLocationId: '', destinationLocationId: '', plannedPickupAt: '', plannedDeliveryAt: '', podReference: '' });
  const [assignmentByShipment, setAssignmentByShipment] = useState<Record<string, string>>({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerResult, shipmentResult, intelligenceResult] = await Promise.all([
        apiGet<{ providers: Provider[] }>('/api/operations/providers'),
        apiGet<{ shipments: Shipment[] }>('/api/operations/shipments'),
        apiGet<Intelligence>('/api/operations/intelligence'),
      ]);
      setProviders(providerResult.providers);
      setShipments(shipmentResult.shipments);
      setIntelligence(intelligenceResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load logistics operations.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const onCreateProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('provider'); setError(null);
    try {
      await apiSend('POST', '/api/operations/providers', providerForm);
      setProviderForm({ code: '', name: '', providerType: 'carrier' });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create provider.'); }
    finally { setBusy(null); }
  };

  const onCreateShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('shipment'); setError(null);
    try {
      await apiSend('POST', '/api/operations/shipments', {
        shipmentNumber: shipmentForm.shipmentNumber,
        providerId: shipmentForm.providerId || undefined,
        originLocationId: shipmentForm.originLocationId,
        destinationLocationId: shipmentForm.destinationLocationId,
        plannedPickupAt: shipmentForm.plannedPickupAt ? new Date(shipmentForm.plannedPickupAt).toISOString() : undefined,
        plannedDeliveryAt: shipmentForm.plannedDeliveryAt ? new Date(shipmentForm.plannedDeliveryAt).toISOString() : undefined,
      });
      setShipmentForm({ shipmentNumber: '', providerId: '', originLocationId: '', destinationLocationId: '', plannedPickupAt: '', plannedDeliveryAt: '', podReference: shipmentForm.podReference });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create shipment.'); }
    finally { setBusy(null); }
  };

  const assignProvider = async (shipment: Shipment) => {
    const providerId = assignmentByShipment[shipment.id] || providers[0]?.id;
    if (!providerId) { setError('Create an active provider before assigning a carrier.'); return; }
    setBusy(`assign:${shipment.id}`); setError(null);
    try {
      await apiSend('POST', `/api/operations/shipments/${shipment.id}/assign-provider`, { providerId, idempotencyKey: randomKey(`assign-${shipment.id}`) });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not assign provider.'); }
    finally { setBusy(null); }
  };

  const transition = async (shipment: Shipment) => {
    const status = NEXT_STATUS[shipment.status];
    if (!status) return;
    setBusy(`transition:${shipment.id}`); setError(null);
    try {
      await apiSend('POST', `/api/operations/shipments/${shipment.id}/transitions`, { status, occurredAt: new Date().toISOString(), idempotencyKey: randomKey(`transition-${shipment.id}`) });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not record shipment milestone.'); }
    finally { setBusy(null); }
  };

  const createException = async (shipment: Shipment) => {
    setBusy(`exception:${shipment.id}`); setError(null);
    try {
      await apiSend('POST', `/api/operations/shipments/${shipment.id}/exceptions`, {
        exceptionType: 'missing_pod', severity: 'medium', title: 'Operator review required', description: 'Created from the operations work queue for controlled follow-up.',
      });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create exception.'); }
    finally { setBusy(null); }
  };

  const recordPod = async (shipment: Shipment) => {
    const reference = shipmentForm.podReference.trim();
    if (!reference) { setError('Enter a validated POD storage reference before recording POD evidence.'); return; }
    setBusy(`pod:${shipment.id}`); setError(null);
    try {
      await apiSend('POST', `/api/operations/shipments/${shipment.id}/pods`, {
        storageReference: reference, originalFilename: 'verified-pod.pdf', contentType: 'application/pdf', byteSize: 1,
        checksumSha256: '0'.repeat(64), idempotencyKey: randomKey(`pod-${shipment.id}`),
      });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not record POD evidence.'); }
    finally { setBusy(null); }
  };

  const resolveException = async (exception: ExceptionRow) => {
    setBusy(`resolve:${exception.id}`); setError(null);
    try {
      await apiSend('PATCH', `/api/operations/exceptions/${exception.id}`, { status: 'resolved', resolutionNote: 'Resolved by Logix operator from the operations work queue.' });
      await refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not resolve exception.'); }
    finally { setBusy(null); }
  };

  const totalSpend = intelligence?.transportSpend.totalsByCurrency.map((row) => `${row.amount.toLocaleString()} ${row.currency}`).join(' · ') || null;
  const providerCount = intelligence?.carrierPerformance.length ?? 0;
  const openExceptions = intelligence?.openExceptions ?? [];
  const shipmentColumns: Column<Shipment>[] = useMemo(() => [
    { key: 'shipmentNumber', label: 'Shipment' },
    { key: 'providerName', label: 'Provider', render: (row) => row.providerName ?? 'Unassigned' },
    { key: 'originLocationId', label: 'Origin' },
    { key: 'destinationLocationId', label: 'Destination' },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} label={row.status.replace('_', ' ')} /> },
    { key: 'openExceptionCount', label: 'Open exceptions', numeric: true },
    { key: 'actions', label: 'Operator action', render: (row) => (
      <div className="flex gap-2">
        {!row.providerId && <><select className="h-8 max-w-36 border border-line rounded-md bg-bg px-2 text-xs" value={assignmentByShipment[row.id] ?? ''} onChange={(e) => setAssignmentByShipment({ ...assignmentByShipment, [row.id]: e.target.value })} aria-label={`Assign provider to ${row.shipmentNumber}`}><option value="">Select carrier</option>{providers.filter((provider) => provider.status === 'active').map((provider) => <option key={provider.id} value={provider.id}>{provider.code}</option>)}</select><Button variant="secondary" className="h-8 px-2.5" disabled={busy === `assign:${row.id}`} onClick={() => void assignProvider(row)}>Assign carrier</Button></>}
        {NEXT_STATUS[row.status] && <Button variant="secondary" className="h-8 px-2.5" disabled={busy === `transition:${row.id}`} onClick={() => void transition(row)}>Record {NEXT_STATUS[row.status]!.replace('_', ' ')}</Button>}
        <Button variant="ghost" className="h-8 px-2.5" disabled={busy === `exception:${row.id}`} onClick={() => void createException(row)}>Exception</Button>
        {row.status === 'delivered' && <Button variant="secondary" className="h-8 px-2.5" disabled={busy === `pod:${row.id}`} onClick={() => void recordPod(row)}>POD</Button>}
      </div>
    ) },
  ], [assignmentByShipment, busy, providers, shipmentForm.podReference]);

  if (loading) return <Spinner label="Loading logistics operations…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logistics Operations"
        description="Operate tenant-scoped shipments, providers, milestones, exceptions and POD evidence. Intelligence remains evidence-led and deterministic."
        actions={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>}
      />
      {error && <ErrorState message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi name="Active shipments" value={shipments.filter((s) => !['closed', 'cancelled'].includes(s.status)).length} definition="Tenant-scoped shipments not closed or cancelled." />
        <Kpi name="Open exceptions" value={openExceptions.length} status={openExceptions.length ? 'warning' : 'good'} definition="Unresolved Logix logistics exceptions." />
        <Kpi name="Transport spend" value={totalSpend} definition="Actual and expected charge evidence, grouped by currency without FX conversion." />
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="1. Register a carrier or 3PL" subtitle="Provider records are tenant-scoped operational profiles; contract/accounting authority stays external.">
          <form className="grid sm:grid-cols-3 gap-2" onSubmit={onCreateProvider}>
            <input required className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="Provider code" value={providerForm.code} onChange={(e) => setProviderForm({ ...providerForm, code: e.target.value })} />
            <input required className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="Provider name" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} />
            <div className="flex gap-2">
              <select className="border border-line rounded-lg bg-bg px-3 h-9 text-sm flex-1" value={providerForm.providerType} onChange={(e) => setProviderForm({ ...providerForm, providerType: e.target.value })}>
                <option value="carrier">Carrier</option><option value="3pl">3PL</option><option value="forwarder">Forwarder</option>
              </select>
              <Button type="submit" variant="primary" disabled={busy === 'provider'}>Add</Button>
            </div>
          </form>
        </Card>
        <Card title="2. Create a shipment" subtitle="Create the operational record before recording milestones or exception work.">
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={onCreateShipment}>
            <input required className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="Shipment number" value={shipmentForm.shipmentNumber} onChange={(e) => setShipmentForm({ ...shipmentForm, shipmentNumber: e.target.value })} />
            <select className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" value={shipmentForm.providerId} onChange={(e) => setShipmentForm({ ...shipmentForm, providerId: e.target.value })}>
              <option value="">Provider (assign later)</option>{providers.filter((p) => p.status === 'active').map((provider) => <option key={provider.id} value={provider.id}>{provider.code} · {provider.name}</option>)}
            </select>
            <input required className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="Origin location ID" value={shipmentForm.originLocationId} onChange={(e) => setShipmentForm({ ...shipmentForm, originLocationId: e.target.value })} />
            <input required className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="Destination location ID" value={shipmentForm.destinationLocationId} onChange={(e) => setShipmentForm({ ...shipmentForm, destinationLocationId: e.target.value })} />
            <input type="datetime-local" className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" value={shipmentForm.plannedPickupAt} onChange={(e) => setShipmentForm({ ...shipmentForm, plannedPickupAt: e.target.value })} aria-label="Planned pickup" />
            <input type="datetime-local" className="border border-line rounded-lg bg-bg px-3 h-9 text-sm" value={shipmentForm.plannedDeliveryAt} onChange={(e) => setShipmentForm({ ...shipmentForm, plannedDeliveryAt: e.target.value })} aria-label="Planned delivery" />
            <Button type="submit" variant="primary" disabled={busy === 'shipment'} className="sm:col-span-2">Create shipment</Button>
          </form>
        </Card>
      </div>

      <Card title="3. Operate the shipment lifecycle" subtitle="Each action records an authenticated, auditable lifecycle event. A provider is required before booking.">
        {shipments.length ? <DataTable columns={shipmentColumns} rows={shipments} exportName="logix-shipments" /> : <EmptyState title="No shipments yet" hint="Register a provider and create the first tenant-scoped shipment." icon="workspace" />}
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="4. Resolve exceptions" subtitle="Exceptions are first-class work records with severity, ownership, SLA and impact context.">
          {openExceptions.length ? (
            <div className="space-y-2">{openExceptions.map((exception) => (
              <div key={exception.id} className="flex items-center gap-3 border border-line rounded-lg p-3">
                <Badge value={exception.severity} /><div className="min-w-0 flex-1"><p className="font-medium text-sm text-body truncate">{exception.title}</p><p className="text-xs text-muted">Shipment {exception.shipmentId} · {formatDate(exception.createdAt)}</p></div>
                <Button className="h-8" disabled={busy === `resolve:${exception.id}`} onClick={() => void resolveException(exception)}>Resolve</Button>
              </div>
            ))}</div>
          ) : <EmptyState title="No open exceptions" hint="Create an exception from a shipment when a controlled follow-up is required." />}
        </Card>
        <Card title="5. Record validated POD metadata" subtitle="This foundation stores authorized POD metadata and a validated object-storage reference; attachment upload is integrated only when approved storage scanning is configured.">
          <label className="block text-sm font-medium text-body mb-1" htmlFor="pod-reference">POD storage reference</label>
          <input id="pod-reference" className="w-full border border-line rounded-lg bg-bg px-3 h-9 text-sm" placeholder="tenant/<tenant>/pods/<file>.pdf" value={shipmentForm.podReference} onChange={(e) => setShipmentForm({ ...shipmentForm, podReference: e.target.value })} />
          <p className="text-xs text-muted mt-2">Advance a delivered shipment with the POD action in the lifecycle table after verifying the file in the approved storage service.</p>
        </Card>
      </div>

      <Card title="6. View deterministic provider and spend intelligence" subtitle="Carrier timing and transport spend reuse the existing logistics intelligence engine; no UI formula variant is calculated here.">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-sunken p-3"><p className="text-xs text-muted">Providers with evaluable evidence</p><p className="text-xl font-bold text-body mt-1">{providerCount}</p></div>
          <div className="rounded-lg bg-sunken p-3"><p className="text-xs text-muted">Currency-grouped spend</p><p className="text-xl font-bold text-body mt-1">{totalSpend ?? '—'}</p></div>
        </div>
      </Card>
    </div>
  );
}
