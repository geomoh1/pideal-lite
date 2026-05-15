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

export async function fetchMarketplaceData() {
  const [servicesData, ordersData, reportsData] = await Promise.all([
    requestJson('/api/services'),
    requestJson('/api/orders'),
    requestJson('/api/reports'),
  ]);

  return {
    services: servicesData.services || [],
    orders: ordersData.orders || [],
    reports: reportsData.reports || [],
  };
}

export async function createService(listing) {
  const data = await postJson('/api/services', listing);
  return data.service;
}

export async function updateServiceStatus(serviceId, status) {
  const data = await postJson(`/api/services/${encodeURIComponent(serviceId)}/status`, { status });
  return data.service;
}

export async function removeServiceById(serviceId) {
  const data = await postJson(`/api/services/${encodeURIComponent(serviceId)}/remove`, {});
  return data.service;
}

export async function createOrder(order) {
  const data = await postJson('/api/orders', order);
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

export async function disputeOrder(orderId) {
  const data = await postJson(`/api/orders/${encodeURIComponent(orderId)}/dispute`, {});
  return data.order;
}

export async function createReport(report) {
  const data = await postJson('/api/reports', report);
  return data.report;
}

export async function resolveReportById(reportId) {
  const data = await postJson(`/api/reports/${encodeURIComponent(reportId)}/resolve`, {});
  return data.report;
}

function isDeployedStaticFrontend() {
  if (typeof window === 'undefined') return false;

  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}
