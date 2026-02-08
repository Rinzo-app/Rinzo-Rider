import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  AUTH_TOKEN: "saaf_auth_token",
  RIDER_PROFILE: "saaf_rider_profile",
  RIDER_AVAILABILITY: "saaf_rider_availability",
  ORDERS: "saaf_orders",
  DISPUTES: "saaf_disputes",
};

export type RiderStatus = "PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED";
export type AvailabilityStatus = "AVAILABLE" | "OFFLINE";
export type OrderStatus = "ASSIGNED" | "PICKED_UP" | "DELIVERED";
export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

export interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: RiderStatus;
  vehicleType: string;
  vehicleNumber: string;
  availability: AvailabilityStatus;
  joinedDate: string;
  totalDeliveries: number;
}

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
  createdAt: string;
  updatedAt: string;
}

export const DISPUTE_CATEGORIES = [
  "Payment Issue",
  "Customer Not Available",
  "Wrong Address",
  "Order Damaged",
  "Shop Issue",
  "App Issue",
  "Other",
];

const MOCK_RIDER: RiderProfile = {
  id: "RDR-001",
  name: "Ahmed Khan",
  email: "ahmed@saaf.pk",
  phone: "+92 300 1234567",
  status: "ACTIVE",
  vehicleType: "Motorcycle",
  vehicleNumber: "LHR-4521",
  availability: "OFFLINE",
  joinedDate: "2025-11-15",
  totalDeliveries: 142,
};

const MOCK_ORDERS: Order[] = [
  {
    id: "ORD-7842",
    shopName: "CleanPress Laundry",
    shopPhone: "+92 321 9876543",
    shopAddress: "Shop 12, Block C, Gulberg III, Lahore",
    customerName: "Sara Ali",
    customerPhone: "+92 333 4567890",
    customerAddress: "House 45, Street 7, DHA Phase 5, Lahore",
    type: "PICKUP",
    status: "ASSIGNED",
    distance: "3.2 km",
    services: [
      { name: "Wash & Fold", quantity: 5 },
      { name: "Dry Clean", quantity: 2 },
    ],
    createdAt: "2026-02-08T10:30:00Z",
  },
  {
    id: "ORD-7839",
    shopName: "Fresh & Clean",
    shopPhone: "+92 322 1112233",
    shopAddress: "Plaza 8, Main Boulevard, Johar Town, Lahore",
    customerName: "Usman Tariq",
    customerPhone: "+92 311 9998877",
    customerAddress: "Flat 3B, Tower A, Lake City, Lahore",
    type: "DELIVERY",
    status: "PICKED_UP",
    distance: "5.8 km",
    services: [
      { name: "Ironing", quantity: 8 },
      { name: "Stain Removal", quantity: 1 },
    ],
    createdAt: "2026-02-08T09:15:00Z",
  },
  {
    id: "ORD-7835",
    shopName: "Sparkle Dry Cleaners",
    shopPhone: "+92 300 5556677",
    shopAddress: "2nd Floor, Liberty Market, Lahore",
    customerName: "Fatima Noor",
    customerPhone: "+92 345 6543210",
    customerAddress: "House 112, Model Town Extension, Lahore",
    type: "PICKUP",
    status: "ASSIGNED",
    distance: "2.1 km",
    services: [
      { name: "Wash & Iron", quantity: 3 },
    ],
    createdAt: "2026-02-08T08:45:00Z",
  },
];

const MOCK_DISPUTES: Dispute[] = [
  {
    id: "DSP-201",
    category: "Customer Not Available",
    orderId: "ORD-7801",
    description: "Customer did not answer the door or phone after waiting 15 minutes.",
    status: "RESOLVED",
    createdAt: "2026-02-05T14:20:00Z",
    updatedAt: "2026-02-06T09:30:00Z",
  },
  {
    id: "DSP-198",
    category: "Wrong Address",
    orderId: "ORD-7790",
    description: "The address on the order does not exist. Pin location was in an empty plot.",
    status: "CLOSED",
    createdAt: "2026-02-03T11:00:00Z",
    updatedAt: "2026-02-04T16:45:00Z",
  },
];

async function initializeMockData() {
  const existingOrders = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!existingOrders) {
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(MOCK_ORDERS));
  }
  const existingDisputes = await AsyncStorage.getItem(STORAGE_KEYS.DISPUTES);
  if (!existingDisputes) {
    await AsyncStorage.setItem(STORAGE_KEYS.DISPUTES, JSON.stringify(MOCK_DISPUTES));
  }
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string; rider: RiderProfile }> {
    await new Promise((r) => setTimeout(r, 800));
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    const token = "mock_token_" + Date.now().toString();
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_PROFILE, JSON.stringify(MOCK_RIDER));
    await initializeMockData();
    return { token, rider: MOCK_RIDER };
  },

  async getProfile(): Promise<RiderProfile> {
    await new Promise((r) => setTimeout(r, 300));
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.RIDER_PROFILE);
    if (stored) return JSON.parse(stored);
    return MOCK_RIDER;
  },

  async updateAvailability(status: AvailabilityStatus): Promise<RiderProfile> {
    await new Promise((r) => setTimeout(r, 400));
    const profile = await api.getProfile();
    const updated = { ...profile, availability: status };
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_PROFILE, JSON.stringify(updated));
    return updated;
  },

  async getOrders(): Promise<Order[]> {
    await new Promise((r) => setTimeout(r, 400));
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
    if (stored) {
      const orders: Order[] = JSON.parse(stored);
      return orders.filter((o) => o.status !== "DELIVERED");
    }
    return MOCK_ORDERS;
  },

  async getOrderById(id: string): Promise<Order | null> {
    await new Promise((r) => setTimeout(r, 300));
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
    if (stored) {
      const orders: Order[] = JSON.parse(stored);
      return orders.find((o) => o.id === id) || null;
    }
    return MOCK_ORDERS.find((o) => o.id === id) || null;
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    await new Promise((r) => setTimeout(r, 500));
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
    const orders: Order[] = stored ? JSON.parse(stored) : MOCK_ORDERS;
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Order not found");

    const order = orders[idx];
    const validTransitions: Record<OrderStatus, OrderStatus | null> = {
      ASSIGNED: "PICKED_UP",
      PICKED_UP: "DELIVERED",
      DELIVERED: null,
    };
    if (validTransitions[order.status] !== status) {
      throw new Error("Invalid status transition");
    }

    orders[idx] = { ...order, status };
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    return orders[idx];
  },

  async getDisputes(): Promise<Dispute[]> {
    await new Promise((r) => setTimeout(r, 400));
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.DISPUTES);
    if (stored) return JSON.parse(stored);
    return MOCK_DISPUTES;
  },

  async createDispute(data: { category: string; orderId?: string; description: string }): Promise<Dispute> {
    await new Promise((r) => setTimeout(r, 600));
    const newDispute: Dispute = {
      id: "DSP-" + Date.now().toString().slice(-3),
      category: data.category,
      orderId: data.orderId,
      description: data.description,
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.DISPUTES);
    const disputes: Dispute[] = stored ? JSON.parse(stored) : [];
    disputes.unshift(newDispute);
    await AsyncStorage.setItem(STORAGE_KEYS.DISPUTES, JSON.stringify(disputes));
    return newDispute;
  },

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.RIDER_PROFILE,
      STORAGE_KEYS.ORDERS,
      STORAGE_KEYS.DISPUTES,
    ]);
  },

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },
};
