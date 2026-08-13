import crypto from 'crypto';

export const SHIPMENT_STATUSES = [
  'planned', 'booked', 'ready', 'picked_up', 'in_transit', 'arrived',
  'delivered', 'pod_confirmed', 'closed', 'cancelled',
] as const;

export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  planned: ['booked', 'ready', 'cancelled'],
  booked: ['ready', 'cancelled'],
  ready: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'arrived'],
  in_transit: ['arrived'],
  arrived: ['delivered'],
  delivered: ['pod_confirmed', 'closed'],
  pod_confirmed: ['closed'],
  closed: [],
  cancelled: [],
};

export const TRANSITION_EVENT: Partial<Record<ShipmentStatus, string>> = {
  booked: 'shipment.booked',
  ready: 'shipment.ready',
  picked_up: 'shipment.picked_up',
  in_transit: 'shipment.departed',
  arrived: 'shipment.arrived',
  delivered: 'shipment.delivered',
  pod_confirmed: 'pod.received',
  closed: 'shipment.closed',
  cancelled: 'shipment.cancelled',
};

export const OPERATIONAL_EVENT_TYPES = new Set([
  'shipment.created', 'shipment.booked', 'shipment.ready', 'shipment.picked_up',
  'shipment.departed', 'shipment.arrived', 'shipment.delivered', 'shipment.closed',
  'shipment.cancelled', 'pod.received', 'exception.created', 'exception.resolved',
  'freight_charge.recorded', 'tracking.updated',
]);

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from].includes(to);
}

export function asUtcIso(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid ISO-8601 timestamp`);
  return new Date(timestamp).toISOString();
}

/** A stable digest makes idempotency safe even if JSON key order differs. */
export function payloadDigest(value: unknown): string {
  const stable = stableJson(value);
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function operationId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function eventForTransition(to: ShipmentStatus): string {
  return TRANSITION_EVENT[to] ?? 'shipment.status_changed';
}
