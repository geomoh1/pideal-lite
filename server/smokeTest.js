import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const baseUrl = 'http://127.0.0.1:4000';
const startedAt = Date.now();
const paymentId = `smoke-payment-${startedAt}`;
const serviceId = `smoke-service-${startedAt}`;
const txid = `smoke-tx-${startedAt}`;
const prisma = new PrismaClient();

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4000',
    NODE_ENV: 'production',
    PI_API_KEY: '',
    PI_USE_MOCK_PAYMENTS: 'false',
    DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let serverOutput = '';
let serverError = '';

server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

server.stderr.on('data', (chunk) => {
  serverError += chunk.toString();
});

try {
  await prisma.user.upsert({
    where: { id: 'admin-lina' },
    update: {
      username: 'lina.admin',
      role: 'admin',
    },
    create: {
      id: 'admin-lina',
      username: 'lina.admin',
      role: 'admin',
    },
  });

  const health = await waitForHealth();
  const demoAdminSession = await postJson('/api/session', {
    uid: 'admin-lina',
    username: 'lina.admin',
    demoMode: true,
  });
  assertEqual(demoAdminSession.user.role, 'admin', 'Demo Admin session must resolve to admin in mock mode.');

  const createdService = await postJson('/api/services', {
    id: serviceId,
    title: 'Smoke test logo sprint',
    category: 'Design',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    sellerHandle: '@smoke.seller',
    pricePi: 10,
    depositPi: 4,
    deliveryDays: 1,
    icon: 'ST',
    accent: '#f5b84b',
    summary: 'Smoke-test service for API-driven marketplace state.',
    terms: 'Buyer sends a short brief.',
    deliverables: ['Smoke delivery'],
  });

  assertEqual(createdService.service.status, 'pending', 'New services must start pending.');

  const rejectedModeration = await postJsonExpectFailure(`/api/services/${serviceId}/status`, { status: 'approved' });
  assertEqual(rejectedModeration.status, 401, 'Service moderation must require an admin actor.');

  const approvedService = await postJson(
    `/api/services/${serviceId}/status`,
    { status: 'approved' },
    { actorUserId: 'admin-lina' },
  );
  assertEqual(approvedService.service.status, 'approved', 'Service approval must persist.');

  const services = await getJson('/api/services');
  assertTruthy(
    services.services.some((service) => service.id === serviceId),
    'GET /api/services must include the smoke service.',
  );

  const createdOrder = await postJson('/api/orders', {
    serviceId,
    buyerId: 'smoke-buyer',
    buyerName: 'smoke.buyer',
    buyerNote: 'Please create a tiny logo for the smoke test.',
    requestSourceText: 'Smoke brand reference text.',
    requestReferenceLink: 'https://example.com/smoke-reference',
    requestFileName: 'smoke-reference.png',
    requestFileSize: '14 KB',
  });
  const orderId = createdOrder.order.id;
  assertEqual(createdOrder.order.status, 'Pending Payment', 'New orders must start Pending Payment.');
  assertEqual(createdOrder.order.requestFileName, 'smoke-reference.png', 'Order request metadata must persist.');

  const approval = await postJson(`/api/pi/payments/${paymentId}/approve`, {
    orderId,
    serviceId,
    amountPi: 4,
    mode: 'deposit',
    buyerId: 'smoke-buyer',
    buyerName: 'smoke.buyer',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    demoMode: true,
  });

  assertEqual(approval.order.status, 'Pending Payment', 'Approval must not mark order as Paid.');
  assertEqual(approval.mock, true, 'Demo approval must stay in mock mode.');

  const beforeCompletion = await getJson(`/api/orders/${orderId}/status`);
  assertEqual(beforeCompletion.order.status, 'Pending Payment', 'Stored order must remain Pending Payment before completion.');

  const completion = await postJson(`/api/pi/payments/${paymentId}/complete`, {
    orderId,
    txid,
  });

  assertEqual(completion.order.status, 'Paid', 'Completion must mark order as Paid.');
  assertEqual(completion.mock, true, 'Demo completion must stay in mock mode.');

  const started = await postJson(`/api/orders/${orderId}/start`, {});
  assertEqual(started.order.status, 'In Progress', 'Paid orders must be startable.');

  const delivered = await postJson(`/api/orders/${orderId}/deliver`, {
    deliveryMessage: 'Smoke delivery finished.',
    deliveryLink: 'https://example.com/smoke-delivery',
    deliveryFileName: 'smoke-delivery.zip',
    deliveryFileSize: '20 KB',
  });
  assertEqual(delivered.order.status, 'Delivered', 'Seller delivery must move order to Delivered.');
  assertEqual(delivered.order.deliveryFileName, 'smoke-delivery.zip', 'Delivery metadata must persist.');

  const confirmed = await postJson(`/api/orders/${orderId}/confirm`, {});
  assertEqual(confirmed.order.status, 'Completed', 'Buyer confirmation must complete the order.');

  const reviewed = await postJson(`/api/orders/${orderId}/review`, { rating: 5 });
  assertEqual(reviewed.order.rating, 5, 'Review rating must persist on the order response.');

  const report = await postJson('/api/reports', {
    serviceId,
    serviceTitle: 'Smoke test logo sprint',
    reporterId: 'smoke-buyer',
    reporterName: 'smoke.buyer',
    reason: 'Smoke report for moderation.',
  });
  assertEqual(report.report.status, 'open', 'Reports must start open.');

  const rejectedReportResolve = await postJsonExpectFailure(`/api/reports/${report.report.id}/resolve`, {});
  assertEqual(rejectedReportResolve.status, 401, 'Report resolution must require an admin actor.');

  const resolvedReport = await postJson(
    `/api/reports/${report.report.id}/resolve`,
    {},
    { actorUserId: 'admin-lina' },
  );
  assertEqual(resolvedReport.report.status, 'resolved', 'Reports must be resolvable.');

  const afterCompletion = await getJson(`/api/orders/${orderId}/status`);
  assertEqual(afterCompletion.order.status, 'Completed', 'Stored order must persist the final status.');

  const orders = await getJson('/api/orders');
  assertTruthy(
    orders.orders.some((order) => order.id === orderId && order.rating === 5),
    'GET /api/orders must include the completed reviewed order.',
  );

  console.log(JSON.stringify({
    health: health.database,
    piPaymentsMode: health.piPaymentsMode,
    serviceStatus: approvedService.service.status,
    orderStatus: afterCompletion.order.status,
    approvalMock: approval.mock,
    completionMock: completion.mock,
    deliveryFileName: delivered.order.deliveryFileName,
    rating: reviewed.order.rating,
    reportStatus: resolvedReport.report.status,
  }, null, 2));
} finally {
  await stopServer();
  await cleanupSmokeData();
  await prisma.$disconnect();
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await getJson('/api/health');
    } catch {
      await delay(250);
    }
  }

  throw new Error(`Backend did not become ready.\nstdout:\n${serverOutput}\nstderr:\n${serverError}`);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return parseResponse(response);
}

async function postJson(path, body, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.actorUserId ? { 'X-PiDeal-User-Id': options.actorUserId } : {}),
    },
    body: JSON.stringify(body),
  });

  return parseResponse(response);
}

async function postJsonExpectFailure(path, body, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.actorUserId ? { 'X-PiDeal-User-Id': options.actorUserId } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (response.ok || data?.ok) {
    throw new Error(`Expected ${path} to fail, but it succeeded.`);
  }

  return { status: response.status, data };
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Unexpected response ${response.status}`);
  }

  return data;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, received ${actual}.`);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function stopServer() {
  if (server.exitCode !== null) return;

  server.kill('SIGTERM');

  await Promise.race([
    new Promise((resolve) => {
      server.once('exit', resolve);
    }),
    delay(2000),
  ]);

  if (server.exitCode === null) {
    server.kill('SIGKILL');
  }
}

async function cleanupSmokeData() {
  const smokeServiceFilter = { startsWith: 'smoke-service-' };

  await prisma.review.deleteMany({
    where: {
      OR: [
        { serviceId: smokeServiceFilter },
        { buyerId: 'smoke-buyer' },
        { sellerId: 'smoke-seller' },
      ],
    },
  });
  await prisma.payment.deleteMany({
    where: {
      OR: [
        { id: { startsWith: 'smoke-payment-' } },
        { serviceId: smokeServiceFilter },
      ],
    },
  });
  await prisma.report.deleteMany({
    where: {
      OR: [
        { serviceId: smokeServiceFilter },
        { reporterId: 'smoke-buyer' },
      ],
    },
  });
  await prisma.order.deleteMany({
    where: {
      OR: [
        { serviceId: smokeServiceFilter },
        { buyerId: 'smoke-buyer' },
        { sellerId: 'smoke-seller' },
      ],
    },
  });
  await prisma.service.deleteMany({
    where: { id: smokeServiceFilter },
  });
  await prisma.user.deleteMany({
    where: { id: { in: ['smoke-buyer', 'smoke-seller'] } },
  });
}
