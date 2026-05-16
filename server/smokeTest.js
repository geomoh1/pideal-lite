import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';

const baseUrl = 'http://127.0.0.1:4000';
const piApiBaseUrl = 'http://127.0.0.1:4010/v2';
const startedAt = Date.now();
const depositPaymentId = `smoke-payment-${startedAt}-deposit`;
const balancePaymentId = `smoke-payment-${startedAt}-balance`;
const serviceId = `smoke-service-${startedAt}`;
const depositTxid = `smoke-tx-${startedAt}-deposit`;
const balanceTxid = `smoke-tx-${startedAt}-balance`;

if (!/^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || ''))) {
  throw new Error('DATABASE_URL must point to PostgreSQL before running npm run test:backend.');
}

const prisma = new PrismaClient();
const piApiServer = createPiApiMockServer();

await new Promise((resolve) => {
  piApiServer.listen(4010, '127.0.0.1', resolve);
});

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4000',
    NODE_ENV: 'test',
    PI_API_KEY: '',
    PI_API_BASE_URL: piApiBaseUrl,
    PI_USE_MOCK_PAYMENTS: 'false',
    PI_ADMIN_USERNAMES: 'mohammedabobaker',
    PLATFORM_FEE_RATE: '0.03',
    ESCROW_DISPUTE_WINDOW_HOURS: '0',
    DATABASE_URL: process.env.DATABASE_URL,
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
  await prisma.user.upsert({
    where: { id: 'verified-admin' },
    update: {
      username: 'verified.admin',
      role: 'admin',
    },
    create: {
      id: 'verified-admin',
      username: 'verified.admin',
      role: 'admin',
    },
  });

  const health = await waitForHealth();
  assertEqual(health.platformFeePercent, '3%', 'Backend must read PLATFORM_FEE_RATE from the environment.');
  assertEqual(health.escrowDisputeWindowHours, 0, 'Backend must expose the configured escrow dispute window.');
  const verifiedSession = await postJson('/api/session', {
    accessToken: 'valid-user-token',
  });
  assertEqual(verifiedSession.user.uid, 'verified-user', 'Valid Pi access token must create a verified user session.');
  assertEqual(verifiedSession.user.role, 'user', 'New verified Pi users must default to role user.');

  const invalidSession = await postJsonExpectFailure('/api/session', {
    accessToken: 'invalid-token',
  });
  assertEqual(invalidSession.status, 401, 'Invalid Pi access token must be rejected.');

  const missingTokenSession = await postJsonExpectFailure('/api/session', {});
  assertEqual(missingTokenSession.status, 401, 'Session creation must require a verified Pi access token.');

  const verifiedAdminSession = await postJson('/api/session', {
    accessToken: 'valid-admin-token',
  });
  assertEqual(verifiedAdminSession.user.uid, 'verified-admin', 'Admin auth must use the verified Pi uid.');
  assertEqual(verifiedAdminSession.user.role, 'admin', 'Existing admin role must be preserved after Pi auth.');

  const configuredAdminSession = await postJson('/api/session', {
    accessToken: 'valid-configured-admin-token',
  });
  assertEqual(
    configuredAdminSession.user.uid,
    'verified-mohammed',
    'Configured Pi admin username must still use the verified Pi uid.',
  );
  assertEqual(
    configuredAdminSession.user.username,
    'mohammedabobaker',
    'Configured Pi admin username must come from the verified Pi profile.',
  );
  assertEqual(
    configuredAdminSession.user.role,
    'admin',
    'Configured Pi admin username must receive role admin after token verification.',
  );

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
    portfolioUrl: 'https://github.com/pideal/smoke-portfolio',
    proofLink: 'https://docs.google.com/document/d/smoke-proof',
    experience: 'Smoke seller has sample digital-service experience.',
    revisionPolicy: 'One smoke-test revision is included.',
    requirementsFromBuyer: 'Buyer sends a clear brief and reference style.',
    deliverables: ['Smoke delivery'],
  });

  assertEqual(createdService.service.status, 'pending', 'New services must start pending.');
  const adminNotifications = await getJson('/api/notifications', { actorUserId: 'admin-lina' });
  assertTruthy(
    adminNotifications.notifications.some((notification) => notification.type === 'admin_pending_services'),
    'Admin must see pending service notifications.',
  );
  await expectCorsPreflight(`/api/services/${serviceId}/status`);

  const rejectedModeration = await postJsonExpectFailure(`/api/services/${serviceId}/status`, { status: 'approved' });
  assertEqual(rejectedModeration.status, 401, 'Service moderation must require an admin actor.');

  const rejectedContactListing = await postJsonExpectFailure('/api/services', {
    id: `${serviceId}-contact`,
    title: 'Unsafe contact listing',
    category: 'Design',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    pricePi: 10,
    depositPi: 4,
    deliveryDays: 1,
    icon: 'UC',
    accent: '#f5b84b',
    summary: 'Message me on Telegram for details.',
    terms: 'Buyer sends a short brief.',
    revisionPolicy: 'One revision.',
    requirementsFromBuyer: 'Brief and reference.',
  });
  assertEqual(rejectedContactListing.status, 400, 'Service listings must reject external contact methods.');

  const rejectedUnsafePortfolio = await postJsonExpectFailure('/api/services', {
    id: `${serviceId}-unsafe-link`,
    title: 'Unsafe portfolio listing',
    category: 'Design',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    pricePi: 10,
    depositPi: 4,
    deliveryDays: 1,
    icon: 'UL',
    accent: '#f5b84b',
    summary: 'Smoke-test service with a bad portfolio link.',
    terms: 'Buyer sends a short brief.',
    portfolioUrl: 'https://wa.me/123456789',
    proofLink: 'https://github.com/pideal/smoke-proof',
    revisionPolicy: 'One revision.',
    requirementsFromBuyer: 'Brief and reference.',
  });
  assertEqual(rejectedUnsafePortfolio.status, 400, 'Portfolio links must reject messaging domains.');

  const approvedService = await postJson(
    `/api/services/${serviceId}/status`,
    { status: 'approved' },
    { actorUserId: 'admin-lina' },
  );
  assertEqual(approvedService.service.status, 'approved', 'Service approval must persist.');
  assertTruthy(approvedService.service.slug, 'Approved services must expose a public slug.');

  const publicService = await getJson(`/api/public/services/${approvedService.service.slug}`);
  assertEqual(publicService.service.slug, approvedService.service.slug, 'Public service lookup must work by slug.');
  assertTruthy(!('sellerId' in publicService.service), 'Public service payload must not expose sellerId.');
  assertTruthy(!('orders' in publicService.service), 'Public service payload must not expose orders.');

  const publicPage = await getText(`/service/${approvedService.service.slug}`);
  assertTruthy(
    publicPage.includes('<meta property="og:title"'),
    'Public service page must include Open Graph title metadata.',
  );

  const verifiedSeller = await postJson(
    '/api/users/smoke-seller/seller-status',
    { sellerStatus: 'verified' },
    { actorUserId: 'admin-lina' },
  );
  assertEqual(verifiedSeller.user.sellerStatus, 'verified', 'Admin must be able to verify a seller.');

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
    requestReferenceLink: 'https://drive.google.com/file/d/smoke-reference/view',
    requestFileName: 'smoke-reference.png',
    requestFileSize: '14 KB',
  });
  const orderId = createdOrder.order.id;
  assertEqual(createdOrder.order.status, 'Requested', 'New orders must start as seller-review requests.');
  assertEqual(createdOrder.order.requestFileName, 'smoke-reference.png', 'Order request metadata must persist.');
  const sellerNotifications = await getJson('/api/notifications', { actorUserId: 'smoke-seller' });
  assertTruthy(
    sellerNotifications.notifications.some(
      (notification) =>
        notification.type === 'seller_order_requested' &&
        notification.targetType === 'order' &&
        notification.targetId === orderId,
    ),
    'Seller must see requested order notifications for their own orders.',
  );

  await prisma.user.upsert({
    where: { id: 'unrelated-buyer' },
    update: { username: 'unrelated.buyer' },
    create: { id: 'unrelated-buyer', username: 'unrelated.buyer', role: 'user' },
  });

  const unrelatedOrder = await prisma.order.create({
    data: {
      id: `smoke-unrelated-${startedAt}`,
      serviceId,
      buyerId: 'unrelated-buyer',
      sellerId: 'smoke-seller',
      buyerName: 'unrelated.buyer',
      sellerName: 'smoke.seller',
      status: 'Delivered',
      buyerNote: 'This order must not appear in smoke-buyer notifications.',
      deliveryMessage: 'Unrelated delivery.',
      deliveryLink: 'https://www.dropbox.com/s/unrelated-delivery.zip',
    },
  });

  const unrelatedViewerNotifications = await getJson('/api/notifications', { actorUserId: 'smoke-buyer' });
  assertTruthy(
    !unrelatedViewerNotifications.notifications.some((notification) => notification.targetId === unrelatedOrder.id),
    'Users must not see notifications for unrelated orders.',
  );

  const rejectedShortReference = await postJsonExpectFailure('/api/orders', {
    serviceId,
    buyerId: 'smoke-buyer-short-link',
    buyerName: 'smoke.buyer.short',
    buyerNote: 'Please use this reference.',
    requestSourceText: 'Smoke brand reference text.',
    requestReferenceLink: 'https://bit.ly/smoke-reference',
  });
  assertEqual(rejectedShortReference.status, 400, 'Request reference links must reject short links.');

  const rejectedEarlyPayment = await postJsonExpectFailure(`/api/pi/payments/${depositPaymentId}-early/approve`, {
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
  assertEqual(rejectedEarlyPayment.status, 400, 'Deposit cannot be paid before seller acceptance.');

  const acceptedOrder = await postJson(`/api/orders/${orderId}/accept`, {});
  assertEqual(acceptedOrder.order.status, 'Pending Payment', 'Accepted requests must wait for the buyer deposit.');

  const approval = await postJson(`/api/pi/payments/${depositPaymentId}/approve`, {
    orderId,
    serviceId,
    amountPi: 99,
    mode: 'deposit',
    buyerId: 'smoke-buyer',
    buyerName: 'smoke.buyer',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    demoMode: true,
  });

  assertEqual(approval.order.status, 'Pending Payment', 'Approval must not mark order as Paid.');
  assertEqual(approval.payment.amountPi, 4, 'Server must calculate the deposit amount from the service.');
  assertEqual(approval.mock, true, 'Mock approval must stay in mock mode.');

  const smokeUsers = await prisma.user.findMany({
    where: { id: { in: ['smoke-buyer', 'smoke-seller'] } },
    select: { id: true, role: true },
  });
  assertTruthy(
    smokeUsers.every((user) => user.role === 'user'),
    'Buying and selling test users must persist with role user.',
  );

  const beforeCompletion = await getJson(`/api/orders/${orderId}/status`);
  assertEqual(beforeCompletion.order.status, 'Pending Payment', 'Stored order must remain Pending Payment before completion.');

  const completion = await postJson('/api/pi/payments/incomplete', {
    paymentId: depositPaymentId,
    orderId,
    txid: depositTxid,
    demoMode: true,
  });

  assertEqual(completion.action, 'completed', 'Incomplete payment recovery must complete approved in-flight payments.');
  assertEqual(completion.order.status, 'Deposit Paid', 'Deposit completion must not mark the full order completed.');
  assertEqual(completion.order.paidPi, 4, 'Deposit completion must record only the paid deposit.');
  assertEqual(completion.order.remainingPi, 6, 'Deposit completion must keep the remaining balance due.');
  assertEqual(completion.order.platformFeePi, 0.12, 'Deposit fee must use PLATFORM_FEE_RATE.');
  assertEqual(completion.order.platformFeePercent, '3%', 'Order responses must expose the active platform fee label.');
  assertEqual(completion.order.escrowStatus, 'holding_deposit', 'Deposit completion must hold funds in escrow.');
  assertEqual(completion.order.escrowHeldPi, 4, 'Escrow must hold the completed deposit amount.');
  assertEqual(completion.order.sellerPayoutPi, 0, 'Seller payout must not be available before full payment.');
  assertEqual(completion.mock, true, 'Mock completion must stay in mock mode.');

  const started = await postJson(`/api/orders/${orderId}/start`, {});
  assertEqual(started.order.status, 'In Progress', 'Paid orders must be startable.');

  const rejectedUnsafeDelivery = await postJsonExpectFailure(`/api/orders/${orderId}/deliver`, {
    deliveryMessage: 'Smoke delivery finished.',
    deliveryLink: 'https://t.me/smoke-delivery',
  });
  assertEqual(rejectedUnsafeDelivery.status, 400, 'Delivery links must reject messaging domains.');

  const delivered = await postJson(`/api/orders/${orderId}/deliver`, {
    deliveryMessage: 'Smoke delivery finished.',
    deliveryLink: 'https://www.dropbox.com/s/smoke-delivery.zip',
    deliveryFileName: 'smoke-delivery.zip',
    deliveryFileSize: '20 KB',
  });
  assertEqual(delivered.order.status, 'Delivered', 'Seller delivery must move order to Delivered.');
  assertEqual(delivered.order.deliveryFileName, 'smoke-delivery.zip', 'Delivery metadata must persist.');
  const buyerNotifications = await getJson('/api/notifications', { actorUserId: 'smoke-buyer' });
  assertTruthy(
    buyerNotifications.notifications.some(
      (notification) =>
        notification.type === 'buyer_delivery_ready' &&
        notification.targetType === 'order' &&
        notification.targetId === orderId,
    ),
    'Buyer must see delivered order notifications for their own orders.',
  );

  const buyerOrdersBeforeBalance = await getJson('/api/orders', { actorUserId: 'smoke-buyer' });
  const buyerDeliveredOrder = buyerOrdersBeforeBalance.orders.find((order) => order.id === orderId);
  assertEqual(buyerDeliveredOrder.remainingPi, 6, 'Buyer must see the remaining balance before unlocking delivery.');
  assertEqual(buyerDeliveredOrder.canPayRemaining, true, 'Buyer must be told they can pay the remaining balance.');
  assertEqual(buyerDeliveredOrder.deliveryMessage, 'Smoke delivery finished.', 'Buyer must see the delivery preview note.');
  assertEqual(buyerDeliveredOrder.deliveryLink, '', 'Buyer must not receive deliveryLink before remaining payment.');
  assertEqual(buyerDeliveredOrder.deliveryFileName, '', 'Buyer must not receive delivery file name before remaining payment.');
  assertEqual(buyerDeliveredOrder.deliveryFileSize, '', 'Buyer must not receive delivery file size before remaining payment.');

  const sellerOrdersBeforeBalance = await getJson('/api/orders', { actorUserId: 'smoke-seller' });
  const sellerDeliveredOrder = sellerOrdersBeforeBalance.orders.find((order) => order.id === orderId);
  assertEqual(
    sellerDeliveredOrder.deliveryLink,
    'https://www.dropbox.com/s/smoke-delivery.zip',
    'Seller must receive deliveryLink before buyer pays remaining.',
  );

  const adminOrdersBeforeBalance = await getJson('/api/orders', { actorUserId: 'admin-lina' });
  const adminDeliveredOrder = adminOrdersBeforeBalance.orders.find((order) => order.id === orderId);
  assertEqual(
    adminDeliveredOrder.deliveryLink,
    'https://www.dropbox.com/s/smoke-delivery.zip',
    'Admin must receive deliveryLink before buyer pays remaining.',
  );

  const rejectedConfirm = await postJsonExpectFailure(`/api/orders/${orderId}/confirm`, {});
  assertEqual(rejectedConfirm.status, 409, 'Buyer confirmation must not complete the order while balance is due.');

  const balanceApproval = await postJson(`/api/pi/payments/${balancePaymentId}/approve`, {
    orderId,
    serviceId,
    amountPi: 999,
    mode: 'balance',
    buyerId: 'smoke-buyer',
    buyerName: 'smoke.buyer',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
    demoMode: true,
  });
  assertEqual(balanceApproval.payment.amountPi, 6, 'Server must calculate the remaining balance from completed payments.');

  const balanceCompletion = await postJson(`/api/pi/payments/${balancePaymentId}/complete`, {
    orderId,
    txid: balanceTxid,
  });
  assertEqual(balanceCompletion.order.status, 'Completed', 'Remaining balance completion must complete the order.');
  assertEqual(balanceCompletion.order.paidPi, 10, 'Completed order must show the full paid service price.');
  assertEqual(balanceCompletion.order.platformFeePi, 0.3, 'Final fee must use PLATFORM_FEE_RATE on total paid amount.');
  assertEqual(balanceCompletion.order.escrowStatus, 'release_pending', 'Full payment must schedule escrow release.');
  assertEqual(balanceCompletion.order.escrowHeldPi, 10, 'Full payment must remain held during the dispute window.');
  assertEqual(balanceCompletion.order.sellerPayoutPi, 9.7, 'Seller payout must be net of platform fee.');
  assertTruthy(balanceCompletion.order.releaseEligibleAt, 'Completed escrow must expose its release eligibility time.');
  assertEqual(
    balanceCompletion.order.deliveryLink,
    'https://www.dropbox.com/s/smoke-delivery.zip',
    'Buyer must receive deliveryLink immediately after remaining payment completion.',
  );

  const buyerOrdersAfterBalance = await getJson('/api/orders', { actorUserId: 'smoke-buyer' });
  const buyerCompletedOrder = buyerOrdersAfterBalance.orders.find((order) => order.id === orderId);
  assertEqual(buyerCompletedOrder.remainingPi, 0, 'Completed buyer order must have no remaining balance.');
  assertEqual(buyerCompletedOrder.escrowStatus, 'released', 'Eligible completed escrow must auto-release after the dispute window.');
  assertEqual(buyerCompletedOrder.escrowHeldPi, 0, 'Released escrow must no longer hold buyer funds.');
  assertEqual(buyerCompletedOrder.sellerPayoutPi, 9.7, 'Released escrow must preserve the seller net payout.');
  assertTruthy(buyerCompletedOrder.releasedAt, 'Released escrow must record a release timestamp.');
  assertEqual(
    buyerCompletedOrder.deliveryLink,
    'https://www.dropbox.com/s/smoke-delivery.zip',
    'Buyer must receive deliveryLink after remaining payment.',
  );
  assertEqual(
    buyerCompletedOrder.deliveryFileName,
    'smoke-delivery.zip',
    'Buyer must receive delivery file name after remaining payment.',
  );

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

  const disputedOrderId = `smoke-dispute-${startedAt}`;
  await prisma.order.create({
    data: {
      id: disputedOrderId,
      serviceId,
      buyerId: 'smoke-buyer',
      sellerId: 'smoke-seller',
      buyerName: 'smoke.buyer',
      sellerName: 'smoke.seller',
      status: 'Disputed',
      amountPi: 4,
      platformFeePi: 0.2,
      escrowStatus: 'disputed',
      escrowHeldPi: 4,
      escrowFeePi: 0.2,
    },
  });
  const refunded = await postJson(
    `/api/orders/${disputedOrderId}/refund`,
    {},
    { actorUserId: 'admin-lina' },
  );
  assertEqual(refunded.order.status, 'Refunded', 'Admin must be able to mark a disputed order refunded.');
  assertEqual(refunded.order.escrowStatus, 'refunded', 'Refund resolution must close escrow as refunded.');
  assertEqual(refunded.order.refundedPi, 4, 'Refund resolution must record the refunded held amount.');
  assertEqual(refunded.order.escrowHeldPi, 0, 'Refunded escrow must no longer hold funds.');

  const releasedDisputeOrderId = `smoke-dispute-release-${startedAt}`;
  await prisma.order.create({
    data: {
      id: releasedDisputeOrderId,
      serviceId,
      buyerId: 'smoke-buyer',
      sellerId: 'smoke-seller',
      buyerName: 'smoke.buyer',
      sellerName: 'smoke.seller',
      status: 'Disputed',
      amountPi: 10,
      platformFeePi: 0.3,
      escrowStatus: 'disputed',
      escrowHeldPi: 10,
      escrowFeePi: 0.3,
    },
  });
  const releasedDispute = await postJson(
    `/api/orders/${releasedDisputeOrderId}/release`,
    {},
    { actorUserId: 'admin-lina' },
  );
  assertEqual(releasedDispute.order.status, 'Completed', 'Admin release must return a disputed order to completed.');
  assertEqual(releasedDispute.order.escrowStatus, 'released', 'Admin release must close escrow as released.');
  assertEqual(releasedDispute.order.escrowHeldPi, 0, 'Released dispute escrow must no longer hold funds.');
  assertEqual(releasedDispute.order.sellerPayoutPi, 9.7, 'Admin release must record the seller net payout.');

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
  await stopPiApiServer();
  await cleanupSmokeData();
  await prisma.$disconnect();
}

function createPiApiMockServer() {
  return createServer((request, response) => {
    const url = new URL(request.url, piApiBaseUrl);
    const authHeader = request.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    response.setHeader('Content-Type', 'application/json');

    if (request.method !== 'GET' || url.pathname !== '/v2/me') {
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    if (token === 'valid-user-token') {
      response.writeHead(200);
      response.end(JSON.stringify({ uid: 'verified-user', username: 'verified.pi' }));
      return;
    }

    if (token === 'valid-admin-token') {
      response.writeHead(200);
      response.end(JSON.stringify({ uid: 'verified-admin', username: 'verified.admin' }));
      return;
    }

    if (token === 'valid-configured-admin-token') {
      response.writeHead(200);
      response.end(JSON.stringify({ uid: 'verified-mohammed', username: 'mohammedabobaker' }));
      return;
    }

    response.writeHead(401);
    response.end(JSON.stringify({ error: 'invalid_token' }));
  });
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

async function getJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(options.actorUserId ? { 'X-PiDeal-User-Id': options.actorUserId } : {}),
    },
  });
  return parseResponse(response);
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Unexpected response ${response.status}`);
  }

  return text;
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

async function expectCorsPreflight(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://pideal-lite.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-pideal-user-id',
    },
  });
  const allowedHeaders = response.headers.get('access-control-allow-headers') || '';
  const allowedOrigin = response.headers.get('access-control-allow-origin') || '';

  assertEqual(response.status, 204, 'CORS preflight must return 204.');
  assertEqual(allowedOrigin, 'https://pideal-lite.vercel.app', 'CORS preflight must allow the deployed frontend origin.');
  assertTruthy(
    allowedHeaders.toLowerCase().includes('x-pideal-user-id'),
    'CORS preflight must allow x-pideal-user-id.',
  );
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

async function stopPiApiServer() {
  if (!piApiServer.listening) return;

  await new Promise((resolve) => {
    piApiServer.close(resolve);
  });
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
    where: {
      id: {
        in: [
          'smoke-buyer',
          'smoke-seller',
          'unrelated-buyer',
          'verified-user',
          'verified-admin',
          'verified-mohammed',
        ],
      },
    },
  });
}
