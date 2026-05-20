function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

function apiPath(path) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl && isDeployedStaticFrontend()) {
    throw new Error(
      'Backend API URL is not configured. Set VITE_API_BASE_URL in Vercel to your deployed Render/Railway backend URL, then redeploy.',
    );
  }

  return `${apiBaseUrl}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiPath(path), {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `PiDeal API request failed: ${response.status}`);
  }

  return data;
}

function postJson(path, body) {
  return requestJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function postJsonAs(path, body, actor) {
  return requestJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMarketplaceData(actor) {
  const canLoadPrivateData = Boolean(actor?.uid);
  const isAdmin = actor?.appRole === 'admin' || actor?.role === 'admin';
  const [servicesData, ordersData, reportsData] = await Promise.all([
    requestJson('/api/services'),
    canLoadPrivateData ? requestJson('/api/orders') : Promise.resolve({ orders: [] }),
    isAdmin ? requestJson('/api/reports') : Promise.resolve({ reports: [] }),
  ]);

  return {
    services: servicesData.services || [],
    orders: ordersData.orders || [],
    reports: reportsData.reports || [],
  };
}

export async function fetchNotifications(actor) {
  const data = await requestJson('/api/notifications');

  return {
    notifications: data.notifications || [],
    count: data.count || 0,
  };
}

export async function syncUserSession(user) {
  const data = await postJson('/api/session', { accessToken: user.accessToken });
  return data.user;
}

export async function fetchCurrentSession() {
  const data = await requestJson('/api/session');
  return data.user;
}

export async function updatePayoutWallet(piWalletAddress, actor) {
  const data = await postJsonAs('/api/users/payout-wallet', { piWalletAddress }, actor);
  return data.user;
}

export async function createService(listing) {
  const data = await postJson('/api/services', listing);
  return data.service;
}

export async function updateServiceStatus(serviceId, status, actor) {
  const data = await postJsonAs(`/api/services/${encodeURIComponent(serviceId)}/status`, { status }, actor);
  return data.service;
}

export async function removeServiceById(serviceId, actor) {
  const data = await postJsonAs(`/api/services/${encodeURIComponent(serviceId)}/remove`, {}, actor);
  return data.service;
}

export async function updateSellerStatus(userId, sellerStatus, actor) {
  const data = await postJsonAs(`/api/users/${encodeURIComponent(userId)}/seller-status`, { sellerStatus }, actor);
  return data.user;
}

export async function createOrder(order) {
  const data = await postJson('/api/orders', order);
  return data.order;
}

export async function acceptOrder(orderId) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/accept`, {});
  return data.order;
}

export async function startOrder(orderId) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/start`, {});
  return data.order;
}

export async function deliverOrder(orderId, delivery) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/deliver`, delivery);
  return data.order;
}

export async function reviewOrder(orderId, rating) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/review`, { rating });
  return data.order;
}

export async function cancelOrder(orderId) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {});
  return data.order;
}

export async function disputeOrder(orderId, reason) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/dispute`, { reason });
  return data.order;
}

export async function refundOrder(orderId, actor) {
  const data = await postJsonAs(`/api/orders/${encodeURIComponent(orderId)}/refund`, {}, actor);
  return data.order;
}

export async function releaseOrder(orderId, actor) {
  const data = await postJsonAs(`/api/orders/${encodeURIComponent(orderId)}/release`, {}, actor);
  return data.order;
}

export async function releaseDueEscrows(actor) {
  return postJsonAs('/api/escrow/release-due', {}, actor);
}

export async function markSellerPayoutPaid(payoutId, payoutTxid, actor) {
  return postJsonAs(`/api/seller-payouts/${encodeURIComponent(payoutId)}/mark-paid`, { payoutTxid }, actor);
}

export async function markBuyerRefundPaid(refundId, refundTxid, actor) {
  return postJsonAs(`/api/buyer-refunds/${encodeURIComponent(refundId)}/mark-paid`, { refundTxid }, actor);
}

export async function createReport(report) {
  const data = await postJson('/api/reports', report);
  return data.report;
}

export async function resolveReportById(reportId, actor) {
  const data = await postJsonAs(`/api/reports/${encodeURIComponent(reportId)}/resolve`, {}, actor);
  return data.report;
}

function isDeployedStaticFrontend() {
  if (typeof window === 'undefined') return false;

  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}
