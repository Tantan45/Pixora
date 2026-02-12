export const ORDER_STORAGE_KEY = "pixoraOrders";
export const AUTO_CONFIRM_KEY = "pixoraAutoConfirmOrders";

export const ORDER_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
};

export const SHIPPING_STATUSES = {
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const SHIPPING_STATUS_OPTIONS = [
  SHIPPING_STATUSES.AWAITING_CONFIRMATION,
  SHIPPING_STATUSES.PROCESSING,
  SHIPPING_STATUSES.SHIPPED,
  SHIPPING_STATUSES.DELIVERED,
  SHIPPING_STATUSES.CANCELLED,
];

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.PENDING]: "Pending",
  [ORDER_STATUSES.CONFIRMED]: "Confirmed",
  [ORDER_STATUSES.CANCELLED]: "Cancelled",
};

export const SHIPPING_STATUS_LABELS = {
  [SHIPPING_STATUSES.AWAITING_CONFIRMATION]: "Awaiting confirmation",
  [SHIPPING_STATUSES.PROCESSING]: "Processing",
  [SHIPPING_STATUSES.SHIPPED]: "Shipped",
  [SHIPPING_STATUSES.DELIVERED]: "Delivered",
  [SHIPPING_STATUSES.CANCELLED]: "Cancelled",
};

const DEFAULT_AUTO_CONFIRM = true;

const toIsoNow = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const safeInteger = (value, fallback = 0) =>
  Math.max(0, Math.floor(safeNumber(value, fallback)));

const normalizeStatus = (status) =>
  ORDER_STATUSES[status?.toUpperCase?.()] ?? status ?? ORDER_STATUSES.PENDING;

const normalizeShippingStatus = (shippingStatus) => {
  if (!shippingStatus) return SHIPPING_STATUSES.AWAITING_CONFIRMATION;
  if (SHIPPING_STATUS_OPTIONS.includes(shippingStatus)) return shippingStatus;
  return SHIPPING_STATUSES.AWAITING_CONFIRMATION;
};

const normalizeTimelineEntry = (entry) => ({
  id: entry?.id ?? createId(),
  at: entry?.at ?? toIsoNow(),
  message: String(entry?.message ?? "").trim() || "Order updated",
});

const sanitizeOrderItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      product_id: item?.product_id ?? item?.id ?? "",
      product_name: item?.product_name ?? item?.name ?? "Untitled item",
      unit_price: safeInteger(item?.unit_price ?? item?.price, 0),
      quantity: Math.max(1, safeInteger(item?.quantity, 1)),
      image: item?.image ?? "",
      category: item?.category ?? "",
    }))
    .filter((item) => item.product_id);

const normalizeOrder = (order) => {
  const items = sanitizeOrderItems(order?.items);
  const subtotal =
    safeInteger(
      order?.subtotal,
      items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    ) ?? 0;

  return {
    id: order?.id ?? createId(),
    user_id: order?.user_id ?? null,
    user_email: String(order?.user_email ?? "").trim().toLowerCase(),
    status: normalizeStatus(order?.status),
    shipping_status: normalizeShippingStatus(order?.shipping_status),
    subtotal,
    created_at: order?.created_at ?? toIsoNow(),
    updated_at: order?.updated_at ?? order?.created_at ?? toIsoNow(),
    confirmed_at: order?.confirmed_at ?? null,
    items,
    timeline: (Array.isArray(order?.timeline) ? order.timeline : []).map(
      normalizeTimelineEntry,
    ),
  };
};

const sortByNewest = (orders) =>
  [...orders].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

export const loadOrders = () => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(ORDER_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return sortByNewest(parsed.map(normalizeOrder));
  } catch {
    return [];
  }
};

export const saveOrders = (orders) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    ORDER_STORAGE_KEY,
    JSON.stringify(sortByNewest((Array.isArray(orders) ? orders : []).map(normalizeOrder))),
  );
};

export const getAutoConfirmOrders = () => {
  if (typeof window === "undefined") return DEFAULT_AUTO_CONFIRM;
  const stored = localStorage.getItem(AUTO_CONFIRM_KEY);
  if (stored === null) return DEFAULT_AUTO_CONFIRM;
  return stored === "true";
};

export const setAutoConfirmOrders = (enabled) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_CONFIRM_KEY, enabled ? "true" : "false");
};

export const createOrder = ({
  userId = null,
  userEmail,
  items,
  subtotal,
  autoConfirm = getAutoConfirmOrders(),
}) => {
  const normalizedItems = sanitizeOrderItems(items);
  const computedSubtotal = safeInteger(
    subtotal,
    normalizedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    ),
  );

  const now = toIsoNow();
  const isConfirmed = Boolean(autoConfirm);

  const timeline = [
    {
      id: createId(),
      at: now,
      message: "Order placed by customer",
    },
  ];

  if (isConfirmed) {
    timeline.push({
      id: createId(),
      at: now,
      message: "Order auto-confirmed by system",
    });
  }

  const order = normalizeOrder({
    id: createId(),
    user_id: userId,
    user_email: userEmail,
    status: isConfirmed ? ORDER_STATUSES.CONFIRMED : ORDER_STATUSES.PENDING,
    shipping_status: isConfirmed
      ? SHIPPING_STATUSES.PROCESSING
      : SHIPPING_STATUSES.AWAITING_CONFIRMATION,
    subtotal: computedSubtotal,
    created_at: now,
    updated_at: now,
    confirmed_at: isConfirmed ? now : null,
    items: normalizedItems,
    timeline,
  });

  const orders = loadOrders();
  saveOrders([order, ...orders]);
  return order;
};

export const confirmOrder = (orderId, adminEmail = "admin") => {
  const orders = loadOrders();
  let updatedOrder = null;
  const now = toIsoNow();

  const nextOrders = orders.map((order) => {
    if (order.id !== orderId) return order;

    const nextOrder = normalizeOrder({
      ...order,
      status: ORDER_STATUSES.CONFIRMED,
      shipping_status:
        order.shipping_status === SHIPPING_STATUSES.AWAITING_CONFIRMATION
          ? SHIPPING_STATUSES.PROCESSING
          : order.shipping_status,
      confirmed_at: order.confirmed_at ?? now,
      updated_at: now,
      timeline: [
        ...order.timeline,
        {
          id: createId(),
          at: now,
          message: `Order confirmed by ${adminEmail}`,
        },
      ],
    });

    updatedOrder = nextOrder;
    return nextOrder;
  });

  saveOrders(nextOrders);
  return updatedOrder;
};

export const updateShippingStatus = (
  orderId,
  shippingStatus,
  adminEmail = "admin",
) => {
  const nextStatus = normalizeShippingStatus(shippingStatus);
  const orders = loadOrders();
  let updatedOrder = null;
  const now = toIsoNow();

  const nextOrders = orders.map((order) => {
    if (order.id !== orderId) return order;
    if (order.shipping_status === nextStatus) return order;

    const nextOrder = normalizeOrder({
      ...order,
      shipping_status: nextStatus,
      status:
        nextStatus === SHIPPING_STATUSES.CANCELLED
          ? ORDER_STATUSES.CANCELLED
          : order.status,
      updated_at: now,
      timeline: [
        ...order.timeline,
        {
          id: createId(),
          at: now,
          message: `Shipping updated to "${SHIPPING_STATUS_LABELS[nextStatus]}" by ${adminEmail}`,
        },
      ],
    });

    updatedOrder = nextOrder;
    return nextOrder;
  });

  saveOrders(nextOrders);
  return updatedOrder;
};

export const getOrdersForUser = (email) => {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return [];
  return loadOrders().filter((order) => order.user_email === normalizedEmail);
};

export const canOrderBeCancelled = (order) => {
  if (!order) return false;
  if (order.status === ORDER_STATUSES.CANCELLED) return false;
  if (
    order.shipping_status === SHIPPING_STATUSES.SHIPPED ||
    order.shipping_status === SHIPPING_STATUSES.DELIVERED ||
    order.shipping_status === SHIPPING_STATUSES.CANCELLED
  ) {
    return false;
  }
  return true;
};

export const cancelOrder = (orderId, userEmail = "") => {
  const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
  const orders = loadOrders();
  let cancelledOrder = null;
  const now = toIsoNow();

  const nextOrders = orders.map((order) => {
    if (order.id !== orderId) return order;
    if (normalizedEmail && order.user_email !== normalizedEmail) return order;
    if (!canOrderBeCancelled(order)) return order;

    const nextOrder = normalizeOrder({
      ...order,
      status: ORDER_STATUSES.CANCELLED,
      shipping_status: SHIPPING_STATUSES.CANCELLED,
      updated_at: now,
      timeline: [
        ...order.timeline,
        {
          id: createId(),
          at: now,
          message: "Order cancelled by customer",
        },
      ],
    });

    cancelledOrder = nextOrder;
    return nextOrder;
  });

  if (cancelledOrder) {
    saveOrders(nextOrders);
  }

  return cancelledOrder;
};

export const getRevenueMetrics = (ordersInput) => {
  const orders = Array.isArray(ordersInput)
    ? ordersInput.map(normalizeOrder)
    : loadOrders();
  const confirmedOrders = orders.filter(
    (order) => order.status === ORDER_STATUSES.CONFIRMED,
  );

  const totalRevenue = confirmedOrders.reduce(
    (sum, order) => sum + safeInteger(order.subtotal),
    0,
  );

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);

  const todayRevenue = confirmedOrders.reduce((sum, order) => {
    if (String(order.created_at).slice(0, 10) !== todayKey) return sum;
    return sum + safeInteger(order.subtotal);
  }, 0);

  const monthRevenue = confirmedOrders.reduce((sum, order) => {
    if (String(order.created_at).slice(0, 7) !== monthKey) return sum;
    return sum + safeInteger(order.subtotal);
  }, 0);

  const pendingOrders = orders.filter(
    (order) => order.status === ORDER_STATUSES.PENDING,
  ).length;

  return {
    totalRevenue,
    todayRevenue,
    monthRevenue,
    confirmedCount: confirmedOrders.length,
    pendingCount: pendingOrders,
    totalOrders: orders.length,
  };
};
