import { request, ApiError } from "./http-client";

// Re-export so existing consumers don't break
export { ApiError } from "./http-client";

export type RiderStatus = "PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED";
export type AvailabilityStatus = "AVAILABLE" | "OFFLINE";
export type OrderStatus = "OFFERED" | "ASSIGNED" | "PICKED_UP" | "DELIVERED";
export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

export interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: RiderStatus;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  availability: AvailabilityStatus;
  joinedDate: string;
  totalDeliveries: number;
  dlImageUrl: string | null;
  rcImageUrl: string | null;
  selfieUrl: string | null;
  documentsStatus: DocumentsStatus;
  documentsRejectionReason: string | null;
}

export type DocumentsStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED";

export interface Order {
  id: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  type: "PICKUP" | "DELIVERY";
  status: OrderStatus;
  /** Raw backend status — used to determine which mutation endpoint to call */
  backendStatus: string;
  /** Deadline for accepting a pending pickup offer (PICKUP_OFFERED only) */
  offerExpiresAt: string | null;
  /** COD amount to collect at delivery (paise) — null when unknown/paid */
  codAmount: number | null;
  /** COD payment status (PENDING / COLLECTED / SETTLED) */
  paymentStatus: string | null;
  distance: string;
  services: ServiceItem[];
  createdAt: string;
}

export interface ServiceItem {
  name: string;
  quantity: number;
}

export interface Dispute {
  id: string;
  category: string;
  orderId?: string;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export const DISPUTE_CATEGORIES = [
  "Payment Issue",
  "Late Delivery",
  "Wrong Items",
  "Order Damaged",
  "Missing Items",
  "Customer No-show",
  "Wrong Order Info",
  "Rider Issue",
  "App Issue",
  "Other",
];

// ── Backend → UI status mapping ──────────────────────────

function deriveType(backendStatus: string): "PICKUP" | "DELIVERY" {
  if (
    backendStatus === "PICKUP_OFFERED" ||
    backendStatus === "PICKUP_ASSIGNED" ||
    backendStatus === "PICKED_UP_FROM_CUSTOMER" ||
    backendStatus === "AT_SHOP"
  ) {
    return "PICKUP";
  }
  return "DELIVERY";
}

function deriveStatus(backendStatus: string): OrderStatus {
  switch (backendStatus) {
    case "PICKUP_OFFERED":
    case "DELIVERY_OFFERED":
      return "OFFERED";
    case "PICKUP_ASSIGNED":
      return "ASSIGNED";
    case "PICKED_UP_FROM_CUSTOMER":
      return "PICKED_UP";
    case "AT_SHOP":
      return "DELIVERED"; // pickup leg completed
    case "OUT_FOR_DELIVERY":
      return "ASSIGNED";
    case "DELIVERED":
      return "DELIVERED";
    default:
      return "ASSIGNED";
  }
}

/** Backend order statuses where the rider has active work to do */
const ACTIVE_BACKEND_STATUSES = [
  "PICKUP_OFFERED",
  "PICKUP_ASSIGNED",
  "PICKED_UP_FROM_CUSTOMER",
  "DELIVERY_OFFERED",
  "OUT_FOR_DELIVERY",
];

function mapOrder(raw: any): Order {
  const backendStatus = raw.status as string;

  // items can come from jsonb column or joined orderItems — both have serviceName & quantity
  const items: ServiceItem[] = Array.isArray(raw.items)
    ? raw.items.map((i: any) => ({
        name: i.serviceName || i.name || "Service",
        quantity: i.quantity,
      }))
    : [];

  return {
    id: raw.id,
    shopName: raw.shopName || "Laundry Shop",
    shopPhone: raw.shopPhone || "",
    shopAddress: raw.shopAddress || raw.deliveryAddress || "",
    customerName: raw.customerName || "Customer",
    customerPhone: raw.customerPhone || "",
    customerAddress: raw.customerAddress || raw.pickupAddress || "",
    type: deriveType(backendStatus),
    status: deriveStatus(backendStatus),
    backendStatus,
    offerExpiresAt: raw.offerExpiresAt ?? null,
    codAmount: raw.payment?.method === "COD" ? raw.payment.amount : null,
    paymentStatus: raw.payment?.status ?? null,
    distance: raw.distance || "",
    services: items,
    createdAt: raw.createdAt,
  };
}

// ── Real backend order APIs ──────────────────────────────

/** GET /api/rider/orders — active orders only (filters out completed) */
export async function fetchRiderOrders(): Promise<Order[]> {
  const res = await request<{ data: any[] }>("GET", "/api/rider/orders?limit=100");
  return res.data
    .filter((o) => ACTIVE_BACKEND_STATUSES.includes(o.status))
    .map(mapOrder);
}

/** GET /api/rider/orders — ALL orders (including completed). Used by dispute form. */
export async function fetchAllRiderOrders(): Promise<Order[]> {
  const res = await request<{ data: any[] }>("GET", "/api/rider/orders?limit=200");
  return res.data.map(mapOrder);
}

/** GET /api/orders/:id — single order with items */
export async function fetchOrder(id: string): Promise<Order> {
  const data = await request("GET", `/api/orders/${id}`);
  return mapOrder(data);
}

/** POST /api/rider/orders/:id/accept  (PICKUP_OFFERED → PICKUP_ASSIGNED) */
export async function acceptOffer(id: string): Promise<Order> {
  const data = await request("POST", `/api/rider/orders/${id}/accept`);
  return mapOrder(data);
}

/** POST /api/rider/orders/:id/decline  (PICKUP_OFFERED → back to the pool) */
export async function declineOffer(id: string): Promise<void> {
  await request("POST", `/api/rider/orders/${id}/decline`);
}

/** POST /api/rider/orders/:id/collect-cash — confirm COD collected (idempotent) */
export async function collectCash(id: string): Promise<void> {
  await request("POST", `/api/rider/orders/${id}/collect-cash`);
}

/** POST /api/rider/orders/:id/pickup  (PICKUP_ASSIGNED → PICKED_UP_FROM_CUSTOMER) */
export async function markPickup(id: string): Promise<Order> {
  const data = await request("POST", `/api/rider/orders/${id}/pickup`);
  return mapOrder(data);
}

/** POST /api/rider/orders/:id/dropoff  (PICKED_UP_FROM_CUSTOMER → AT_SHOP) */
export async function markDropoff(id: string): Promise<Order> {
  const data = await request("POST", `/api/rider/orders/${id}/dropoff`);
  return mapOrder(data);
}

/** POST /api/rider/orders/:id/deliver  (OUT_FOR_DELIVERY → DELIVERED) */
export async function markDelivery(
  id: string,
  deliveryProofUrl?: string,
): Promise<Order> {
  const data = await request(
    "POST",
    `/api/rider/orders/${id}/deliver`,
    deliveryProofUrl ? { deliveryProofUrl } : undefined,
  );
  return mapOrder(data);
}

// ── Rider profile API ────────────────────────────────────

/** GET /api/rider/profile — fetch rider's real profile from backend */
export async function fetchRiderProfile(): Promise<RiderProfile> {
  const data = await request<any>("GET", "/api/rider/profile");
  return {
    id: data.id,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "PENDING",
    vehicleType: data.vehicleType || "Motorcycle",
    vehicleNumber: data.vehicleNumber || "",
    licenseNumber: data.licenseNumber || "",
    availability: data.availability || "OFFLINE",
    joinedDate: data.joinedDate || new Date().toISOString(),
    totalDeliveries: data.totalDeliveries ?? 0,
    dlImageUrl: data.dlImageUrl ?? null,
    rcImageUrl: data.rcImageUrl ?? null,
    selfieUrl: data.selfieUrl ?? null,
    documentsStatus: data.documentsStatus || "NOT_SUBMITTED",
    documentsRejectionReason: data.documentsRejectionReason ?? null,
  };
}

/** PATCH /api/rider/documents — submit KYC document download URLs */
export async function submitDocuments(urls: {
  dlImageUrl?: string;
  rcImageUrl?: string;
  selfieUrl?: string;
}): Promise<{ documentsStatus: DocumentsStatus }> {
  return request("PATCH", "/api/rider/documents", urls);
}

/** PATCH /api/rider/profile — update vehicle details */
export async function updateRiderProfile(updates: {
  vehicleType?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
}): Promise<{ vehicleType: string; vehicleNumber: string; licenseNumber: string }> {
  return request("PATCH", "/api/rider/profile", updates);
}

// ── Rider availability API ───────────────────────────────

/** POST /api/rider/availability — toggle rider online/offline */
export async function setAvailability(isAvailable: boolean): Promise<any> {
  return request("POST", "/api/rider/availability", { isAvailable });
}

/** POST /api/rider/location — send rider GPS coordinates */
export async function updateLocation(lat: number, lng: number): Promise<any> {
  return request("POST", "/api/rider/location", { lat, lng });
}

/**
 * Advance an order to the next status — dispatches to the correct backend
 * endpoint based on the current backendStatus.
 */
export async function advanceOrder(
  id: string,
  backendStatus: string,
): Promise<Order> {
  switch (backendStatus) {
    case "PICKUP_ASSIGNED":
      return markPickup(id);
    case "PICKED_UP_FROM_CUSTOMER":
      return markDropoff(id);
    case "OUT_FOR_DELIVERY":
      return markDelivery(id);
    default:
      throw new ApiError(409, "No action available for this order status");
  }
}

/** Next-action metadata keyed by backend status (for the detail screen) */
export const BACKEND_NEXT_ACTION: Record<
  string,
  { label: string; modalTitle: string; modalSubtitle: string; icon: string } | null
> = {
  PICKUP_ASSIGNED: {
    label: "Mark as Picked Up",
    modalTitle: "Confirm Pickup",
    modalSubtitle: "Have you picked up the order?",
    icon: "cube-outline",
  },
  PICKED_UP_FROM_CUSTOMER: {
    label: "Mark as Dropped Off",
    modalTitle: "Confirm Drop-off",
    modalSubtitle: "Have you dropped off the order at the shop?",
    icon: "storefront-outline",
  },
  OUT_FOR_DELIVERY: {
    label: "Mark as Delivered",
    modalTitle: "Confirm Delivery",
    modalSubtitle: "Has the order been delivered to the customer?",
    icon: "checkmark-circle-outline",
  },
};

// ── Real backend API calls for disputes ──────────────────

/** GET /api/rider/disputes — fetch rider's disputes */
export async function fetchDisputes(): Promise<Dispute[]> {
  try {
    const data = await request<any[]>("GET", "/api/disputes");
    return data.map((d: any) => ({
      id: d.id,
      category: d.category || "Other",
      orderId: d.orderId,
      description: d.description || "",
      status: d.status || "OPEN",
      resolution: d.resolution || undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt || d.createdAt,
    }));
  } catch {
    // If endpoint doesn't exist yet, return empty array
    return [];
  }
}

/** POST /api/disputes — create a new dispute */
export async function createDispute(data: {
  category: string;
  orderId: string;
  description: string;
}): Promise<Dispute> {
  return request<Dispute>("POST", "/api/disputes", data);
}

// ── Rider earnings API ───────────────────────────────────

export interface EarningsEntry {
  orderId: string;
  leg: "PICKUP" | "DROP";
  distanceKm: number;
  amount: number;
  ratePerKm: number;
  distanceSource: string;
  createdAt: string;
}

export interface EarningsDaySummary {
  date: string;
  earnings: number;
  distanceKm: number;
  legs: number;
  entries: EarningsEntry[];
}

export interface RiderEarningsResponse {
  totalEarnings: number;
  totalDistanceKm: number;
  totalLegs: number;
  days: EarningsDaySummary[];
  /** COD cash currently in the rider's hand (unsettled) */
  cod?: {
    cashInHand: number;
    yourCut: number;
    handOver: number;
    orderCount: number;
  };
}

/** GET /api/rider/earnings — fetch rider's earnings summary */
export async function fetchRiderEarnings(): Promise<RiderEarningsResponse> {
  return request<RiderEarningsResponse>("GET", "/api/rider/earnings");
}
