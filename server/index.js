import 'dotenv/config';
import express from 'express';

import { allowLocalDevCors } from './middleware/cors.js';
import { prisma, ensureUser, shutdown } from './utils/db.js';
import { callPiPlatform } from './utils/piClient.js';
import {
  normalizePaymentRequest,
  createMockPaymentDto,
  normalizePaymentMode,
  calculatePlatformFee,
  serializeOrder,
  serializePayment,
  serializeReport,
  serializeService,
  stringifyJson,
} from './utils/payment.js';

const app = express();

const PORT = Number(process.env.PORT || 4000);
const USE_MOCK_PAYMENTS =
  process.env.PI_USE_MOCK_PAYMENTS === 'true' ||
  (!process.env.PI_API_KEY && process.env.NODE_ENV !== 'production');
const DEMO_ADMIN_IDS = (process.env.DEMO_ADMIN_IDS || 'admin-lina')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const ORDER_STATUS = {
  REQUESTED: 'Requested',
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  DEPOSIT_PAID: 'Deposit Paid',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

const SERVICE_INCLUDE = {
  seller: true,
  reviews: true,
};

const ORDER_INCLUDE = {
  payments: {
    orderBy: { updatedAt: 'desc' },
  },
  review: true,
  service: true,
};

const REPORT_INCLUDE = {
  service: true,
  reporter: true,
};

app.use(express.json({ limit: '256kb' }));
app.use(allowLocalDevCors);

app.get('/api/health', async (request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return response.json({
      ok: true,
      service: 'pideal-lite-api',
      database: 'sqlite-prisma',
      piPaymentsMode: USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api',
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/session', async (request, response, next) => {
  try {
    const uid = requiredString(request.body?.uid, 'uid');
    const username = requiredString(request.body?.username, 'username');
    const role = getSessionRole(uid, request.body || {});
    const user = await ensureUser(uid, username, role);

    return response.json({
      ok: true,
      user: serializeUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/services', async (request, response, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { status: { not: 'removed' } },
      include: SERVICE_INCLUDE,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    return response.json({ ok: true, services: services.map(serializeService) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services', async (request, response, next) => {
  try {
    const listing = normalizeServiceInput(request.body || {});
    const seller = await ensureUser(listing.sellerId, listing.sellerName, 'user');

    if (seller.sellerStatus === 'blocked') {
      return response.status(403).json({ ok: false, error: 'This seller is blocked from publishing services.' });
    }

    const service = await prisma.service.create({
      data: {
        id: listing.id,
        title: listing.title,
        category: listing.category,
        sellerId: seller.id,
        sellerHandle: listing.sellerHandle,
        pricePi: listing.pricePi,
        depositPi: listing.depositPi,
        rating: 0,
        reviewCount: 0,
        deliveryDays: listing.deliveryDays,
        status: 'pending',
        accent: listing.accent,
        icon: listing.icon,
        featured: false,
        summary: listing.summary,
        terms: listing.terms,
        portfolioUrl: listing.portfolioUrl,
        proofLink: listing.proofLink,
        experience: listing.experience,
        revisionPolicy: listing.revisionPolicy,
        requirementsFromBuyer: listing.requirementsFromBuyer,
        deliverablesJson: stringifyJson(listing.deliverables),
      },
      include: SERVICE_INCLUDE,
    });

    return response.status(201).json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services/:serviceId/status', requireAdmin, async (request, response, next) => {
  try {
    const nextStatus = String(request.body?.status || '').trim();
    if (!['approved', 'pending', 'rejected', 'blocked'].includes(nextStatus)) {
      return response.status(400).json({ ok: false, error: 'Unsupported service status.' });
    }

    const service = await prisma.service.update({
      where: { id: request.params.serviceId },
      data: { status: nextStatus },
      include: SERVICE_INCLUDE,
    });

    return response.json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/services/:serviceId/remove', requireAdmin, async (request, response, next) => {
  try {
    const service = await prisma.service.update({
      where: { id: request.params.serviceId },
      data: { status: 'removed' },
      include: SERVICE_INCLUDE,
    });

    return response.json({ ok: true, service: serializeService(service) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/users/:userId/seller-status', requireAdmin, async (request, response, next) => {
  try {
    const sellerStatus = String(request.body?.sellerStatus || '').trim();
    if (!['unverified', 'verified', 'blocked'].includes(sellerStatus)) {
      return response.status(400).json({ ok: false, error: 'Unsupported seller status.' });
    }

    const user = await prisma.user.update({
      where: { id: request.params.userId },
      data: { sellerStatus },
    });

    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/orders', async (request, response, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return response.json({ ok: true, orders: orders.map(serializeOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  try {
    const orderInput = normalizeOrderInput(request.body || {});
    const service = await prisma.service.findUnique({
      where: { id: orderInput.serviceId },
      include: { seller: true },
    });

    if (!service || service.status !== 'approved') {
      return response.status(404).json({ ok: false, error: 'Approved service was not found.' });
    }
    if (service.seller?.sellerStatus === 'blocked') {
      return response.status(403).json({ ok: false, error: 'This seller is currently blocked.' });
    }

    const buyer = await ensureUser(orderInput.buyerId, orderInput.buyerName, 'user');

    const order = await prisma.order.create({
      data: {
        id: orderInput.id,
        serviceId: service.id,
        buyerId: buyer.id,
        sellerId: service.sellerId,
        buyerName: buyer.username,
        sellerName: service.seller?.username || 'Pi seller',
        status: ORDER_STATUS.REQUESTED,
        buyerNote: orderInput.buyerNote,
        requestSourceText: orderInput.requestSourceText,
        requestReferenceLink: orderInput.requestReferenceLink,
        requestFileName: orderInput.requestFileName,
        requestFileSize: orderInput.requestFileSize,
        deliveryMessage: '',
        deliveryLink: '',
        deliveryFileName: '',
        deliveryFileSize: '',
      },
      include: ORDER_INCLUDE,
    });

    return response.status(201).json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/accept', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.REQUESTED) {
      return response.status(409).json({ ok: false, error: 'Only requested orders can be accepted by the seller.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.PENDING_PAYMENT },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/start', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (![ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.PAID].includes(order.status)) {
      return response.status(409).json({ ok: false, error: 'Only deposit-paid orders can move to In Progress.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.IN_PROGRESS },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/deliver', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.IN_PROGRESS) {
      return response.status(409).json({ ok: false, error: 'Only orders in progress can be delivered.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: {
        status: ORDER_STATUS.DELIVERED,
        deliveryMessage: String(request.body?.deliveryMessage || 'Delivery submitted by seller.').trim(),
        deliveryLink: String(request.body?.deliveryLink || '').trim(),
        deliveryFileName: String(request.body?.deliveryFileName || '').trim(),
        deliveryFileSize: String(request.body?.deliveryFileSize || '').trim(),
      },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/confirm', async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      return response.status(409).json({ ok: false, error: 'Only delivered orders can be confirmed.' });
    }
    if (calculateRemainingPi(order) > 0) {
      return response.status(409).json({ ok: false, error: 'Remaining balance must be paid before the order can be completed.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.COMPLETED },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/review', async (request, response, next) => {
  try {
    const rating = Number(request.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return response.status(400).json({ ok: false, error: 'Rating must be an integer from 1 to 5.' });
    }

    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.COMPLETED) {
      return response.status(409).json({ ok: false, error: 'Only completed orders can be reviewed.' });
    }

    await prisma.review.upsert({
      where: { orderId: order.id },
      update: {
        rating,
        comment: String(request.body?.comment || '').trim(),
      },
      create: {
        orderId: order.id,
        serviceId: order.serviceId,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        rating,
        comment: String(request.body?.comment || '').trim(),
      },
    });

    await refreshServiceRating(order.serviceId);
    const updatedOrder = await findOrderById(order.id);

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/cancel', async (request, response, next) => {
  try {
    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.CANCELLED },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/dispute', async (request, response, next) => {
  try {
    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.DISPUTED },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/refund', requireAdmin, async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DISPUTED) {
      return response.status(409).json({ ok: false, error: 'Only disputed orders can be refunded by admin.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.REFUNDED },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders/:orderId/release', requireAdmin, async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: request.params.orderId } });
    if (!order) {
      return response.status(404).json({ ok: false, error: 'Order was not found.' });
    }
    if (order.status !== ORDER_STATUS.DISPUTED) {
      return response.status(409).json({ ok: false, error: 'Only disputed orders can be released by admin.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: request.params.orderId },
      data: { status: ORDER_STATUS.COMPLETED },
      include: ORDER_INCLUDE,
    });

    return response.json({ ok: true, order: serializeOrder(updatedOrder) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/reports', async (request, response, next) => {
  try {
    const reports = await prisma.report.findMany({
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return response.json({ ok: true, reports: reports.map(serializeReport) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reports', async (request, response, next) => {
  try {
    const service = request.body?.serviceId
      ? await prisma.service.findUnique({ where: { id: request.body.serviceId } })
      : null;

    const reporterId = request.body?.reporterId || null;
    if (reporterId) {
      await ensureUser(reporterId, request.body?.reporterName || 'Pi reporter', 'user');
    }

    const report = await prisma.report.create({
      data: {
        serviceId: service?.id || null,
        reporterId,
        serviceTitle: String(request.body?.serviceTitle || service?.title || 'Reported service').trim(),
        reason: String(request.body?.reason || 'Buyer reported this digital service for admin review.').trim(),
        status: 'open',
      },
      include: REPORT_INCLUDE,
    });

    return response.status(201).json({ ok: true, report: serializeReport(report) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reports/:reportId/resolve', requireAdmin, async (request, response, next) => {
  try {
    const report = await prisma.report.update({
      where: { id: request.params.reportId },
      data: { status: 'resolved' },
      include: REPORT_INCLUDE,
    });

    return response.json({ ok: true, report: serializeReport(report) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/pi/payments/:paymentId/approve', async (request, response, next) => {
  try {
    const { paymentId } = request.params;
    const paymentRequest = normalizePaymentRequest(paymentId, request.body || {});

    if (!paymentRequest.paymentId || !paymentRequest.orderId) {
      return response.status(400).json({ ok: false, error: 'paymentId and orderId are required.' });
    }

    const orderForPayment = await findOrderById(paymentRequest.orderId);
    if (!orderForPayment) {
      return response.status(404).json({ ok: false, error: 'Order must be created before payment approval.' });
    }

    const serverPaymentRequest = resolveServerPaymentRequest(orderForPayment, paymentRequest);

    const useMockPayment = USE_MOCK_PAYMENTS || paymentRequest.demoMode;

    const piPayment = useMockPayment
      ? createMockPaymentDto({ ...serverPaymentRequest, phase: 'approved' })
      : await callPiPlatform(`/payments/${encodeURIComponent(paymentId)}/approve`);

    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { id: paymentId },
        create: {
          id: paymentId,
          orderId: serverPaymentRequest.orderId,
          serviceId: serverPaymentRequest.serviceId,
          amountPi: serverPaymentRequest.amountPi,
          mode: serverPaymentRequest.mode,
          status: 'approved',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
        update: {
          orderId: serverPaymentRequest.orderId,
          serviceId: serverPaymentRequest.serviceId,
          amountPi: serverPaymentRequest.amountPi,
          mode: serverPaymentRequest.mode,
          status: 'approved',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      return payment;
    });

    const storedOrder = await findOrderById(serverPaymentRequest.orderId);

    return response.json({
      ok: true,
      mock: useMockPayment,
      payment: serializePayment(payment),
      order: serializeOrder(storedOrder),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/pi/payments/:paymentId/complete', async (request, response, next) => {
  try {
    const { paymentId } = request.params;
    const { orderId, txid } = request.body || {};

    if (!paymentId || !orderId || !txid) {
      return response.status(400).json({ ok: false, error: 'paymentId, orderId, and txid are required.' });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            service: true,
            payments: true,
          },
        },
      },
    });

    if (!existingPayment) {
      return response.status(404).json({ ok: false, error: 'Payment was not approved by this server.' });
    }

    if (existingPayment.orderId !== orderId) {
      return response.status(409).json({ ok: false, error: 'Payment does not belong to this order.' });
    }

    if (!['approved', 'completed'].includes(existingPayment.status)) {
      return response.status(409).json({ ok: false, error: 'Payment must be approved before completion.' });
    }

    const useMockPayment = USE_MOCK_PAYMENTS || existingPayment.mock;

    const piPayment = useMockPayment
      ? createMockPaymentDto({
          paymentId,
          orderId,
          serviceId: existingPayment.serviceId,
          amountPi: existingPayment.amountPi,
          mode: existingPayment.mode,
          txid,
          phase: 'completed',
        })
      : await callPiPlatform(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid });

    const nextStatus = resolveStatusAfterPayment(existingPayment.order, existingPayment);
    const nextPaidTotal = calculatePaidTotal(existingPayment.order, existingPayment);

    const { order, payment } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          txid,
          status: 'completed',
          mock: useMockPayment,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          paidAt: new Date(),
          paymentMode: normalizePaymentMode(existingPayment.mode),
          amountPi: nextPaidTotal,
          platformFeePi: calculatePlatformFee(nextPaidTotal),
        },
      });

      return { order, payment };
    });

    const storedOrder = await findOrderById(order.id);

    return response.json({
      ok: true,
      mock: useMockPayment,
      payment: serializePayment(payment),
      order: serializeOrder(storedOrder),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/orders/:orderId/status', async (request, response, next) => {
  try {
    const order = await findOrderById(request.params.orderId);

    if (!order) {
      return response.status(404).json({
        ok: false,
        error: 'Order status is not available on the payment server yet.',
      });
    }

    return response.json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);

  return response.status(error.statusCode || 500).json({
    ok: false,
    error: error.message || 'Unexpected PiDeal server error.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`PiDeal backend listening on http://127.0.0.1:${PORT}`);
  console.log(`Pi payments mode: ${USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api'}`);
});

process.once('SIGINT', () => shutdown(server));
process.once('SIGTERM', () => shutdown(server));

function normalizeServiceInput(body) {
  const pricePi = positiveNumber(body.pricePi, 'pricePi');
  const depositPi = positiveNumber(body.depositPi, 'depositPi');
  const deliveryDays = positiveInteger(body.deliveryDays, 'deliveryDays');

  if (depositPi > pricePi) {
    badRequest('depositPi must be equal to or lower than pricePi.');
  }

  const title = requiredString(body.title, 'title');
  const summary = requiredString(body.summary, 'summary');
  const terms = requiredString(body.terms, 'terms');
  const category = requiredString(body.category, 'category');
  const sellerId = requiredString(body.sellerId, 'sellerId');
  const sellerName = requiredString(body.sellerName, 'sellerName');
  const portfolioUrl = optionalUrl(body.portfolioUrl, 'portfolioUrl');
  const proofLink = optionalUrl(body.proofLink, 'proofLink');
  const experience = optionalString(body.experience);
  const revisionPolicy = requiredString(body.revisionPolicy, 'revisionPolicy');
  const requirementsFromBuyer = requiredString(body.requirementsFromBuyer, 'requirementsFromBuyer');

  assertNoExternalContact({
    title,
    summary,
    terms,
    experience,
    revisionPolicy,
    requirementsFromBuyer,
  });
  assertSafePortfolioUrl(portfolioUrl, 'portfolioUrl');
  assertSafePortfolioUrl(proofLink, 'proofLink');

  return {
    id: body.id || createId('service'),
    title,
    category,
    sellerId,
    sellerName,
    sellerHandle: body.sellerHandle || `@${sellerName}`,
    pricePi,
    depositPi,
    deliveryDays,
    accent: body.accent || '#f5b84b',
    icon: String(body.icon || category.slice(0, 2)).toUpperCase().slice(0, 3),
    summary,
    terms,
    portfolioUrl,
    proofLink,
    experience,
    revisionPolicy,
    requirementsFromBuyer,
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables
      : ['Digital delivery message or link', 'Buyer confirmation required', 'Pi payment placeholder'],
  };
}

function normalizeOrderInput(body) {
  return {
    id: body.id || createId('order'),
    serviceId: requiredString(body.serviceId, 'serviceId'),
    buyerId: requiredString(body.buyerId, 'buyerId'),
    buyerName: requiredString(body.buyerName, 'buyerName'),
    buyerNote: String(body.buyerNote || '').trim(),
    requestSourceText: String(body.requestSourceText || '').trim(),
    requestReferenceLink: String(body.requestReferenceLink || '').trim(),
    requestFileName: String(body.requestFileName || '').trim(),
    requestFileSize: String(body.requestFileSize || '').trim(),
  };
}

async function findOrderById(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
}

function resolveServerPaymentRequest(order, paymentRequest) {
  if (!order.service) {
    badRequest('Order service is required before payment.');
  }

  const mode = ['deposit', 'full', 'balance'].includes(paymentRequest.mode)
    ? paymentRequest.mode
    : 'deposit';
  const servicePrice = Number(order.service.pricePi || 0);
  const depositPi = Number(order.service.depositPi || 0);
  const remainingPi = calculateRemainingPi(order);

  if (mode === 'deposit') {
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      badRequest('Deposit can only be paid after seller acceptance.');
    }
    return {
      ...paymentRequest,
      serviceId: order.serviceId,
      amountPi: Number(Math.min(depositPi, servicePrice).toFixed(2)),
      mode,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
    };
  }

  if (mode === 'full') {
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      badRequest('Full payment can only be paid before work starts.');
    }
    return {
      ...paymentRequest,
      serviceId: order.serviceId,
      amountPi: Number(servicePrice.toFixed(2)),
      mode,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
    };
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    badRequest('Remaining balance can only be paid after seller delivery.');
  }
  if (remainingPi <= 0) {
    badRequest('No remaining balance is due for this order.');
  }

  return {
    ...paymentRequest,
    serviceId: order.serviceId,
    amountPi: remainingPi,
    mode,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    sellerId: order.sellerId,
    sellerName: order.sellerName,
  };
}

function resolveStatusAfterPayment(order, payment) {
  const paidTotal = calculatePaidTotal(order, payment);
  const servicePrice = Number(order.service?.pricePi || 0);
  const isFullyPaid = servicePrice > 0 && paidTotal + 0.00001 >= servicePrice;

  if (payment.mode === 'balance') {
    return isFullyPaid ? ORDER_STATUS.COMPLETED : ORDER_STATUS.DELIVERED;
  }

  if (payment.mode === 'full') {
    return order.status === ORDER_STATUS.DELIVERED ? ORDER_STATUS.COMPLETED : ORDER_STATUS.PAID;
  }

  return isFullyPaid ? ORDER_STATUS.PAID : ORDER_STATUS.DEPOSIT_PAID;
}

function calculatePaidTotal(order, currentPayment = null) {
  const paidFromOtherPayments = (order.payments || [])
    .filter((payment) => payment.status === 'completed' && payment.id !== currentPayment?.id)
    .reduce((sum, payment) => sum + Number(payment.amountPi || 0), 0);

  const currentPaymentAmount = currentPayment ? Number(currentPayment.amountPi || 0) : 0;

  return Number((paidFromOtherPayments + currentPaymentAmount).toFixed(2));
}

function calculateRemainingPi(order) {
  const servicePrice = Number(order.service?.pricePi || 0);
  const paidTotal = calculatePaidTotal(order);
  return Number(Math.max(servicePrice - paidTotal, 0).toFixed(2));
}

async function requireAdmin(request, response, next) {
  try {
    const actorUserId = getActorUserId(request);

    if (!actorUserId) {
      return response.status(401).json({ ok: false, error: 'Admin user id is required.' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
    });

    if (actor?.role !== 'admin') {
      return response.status(403).json({ ok: false, error: 'Only admins can moderate services and reports.' });
    }

    request.actor = actor;
    return next();
  } catch (error) {
    return next(error);
  }
}

function getActorUserId(request) {
  return (
    request.get('x-pideal-user-id') ||
    request.body?.actorUserId ||
    request.query?.actorUserId ||
    ''
  ).trim();
}

function serializeUser(user) {
  return {
    uid: user.id,
    username: user.username,
    role: user.role,
    sellerStatus: user.sellerStatus,
  };
}

function getSessionRole(uid, body) {
  const isDemoAdmin = body.demoMode === true && DEMO_ADMIN_IDS.includes(uid);

  if (USE_MOCK_PAYMENTS && isDemoAdmin) {
    return 'admin';
  }

  return 'user';
}

async function refreshServiceRating(serviceId) {
  if (!serviceId) return;

  const aggregate = await prisma.review.aggregate({
    where: { serviceId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
      reviewCount: aggregate._count.rating,
    },
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requiredString(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    badRequest(`${fieldName} is required.`);
  }
  return text;
}

function positiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    badRequest(`${fieldName} must be a positive number.`);
  }
  return number;
}

function positiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    badRequest(`${fieldName} must be a positive integer.`);
  }
  return number;
}

function optionalString(value) {
  return String(value || '').trim();
}

function optionalUrl(value, fieldName) {
  const text = optionalString(value);
  if (!text) return '';

  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol)) {
      badRequest(`${fieldName} must be an http or https URL.`);
    }
    return url.toString();
  } catch {
    badRequest(`${fieldName} must be a valid URL.`);
  }
}

function assertNoExternalContact(fields) {
  const contactPattern =
    /(@[\w.-]+\.\w{2,}|[\w.%+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|\b(?:whatsapp|telegram|instagram|facebook|snapchat|tiktok|discord|wechat|line|signal|email|gmail|phone|mobile|call me|dm me|contact me)\b|(?:wa\.me|t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.com|discord\.gg))/i;

  for (const [fieldName, value] of Object.entries(fields)) {
    if (contactPattern.test(String(value || ''))) {
      badRequest(`${fieldName} cannot include external contact methods.`);
    }
  }
}

function assertSafePortfolioUrl(value, fieldName) {
  if (!value) return;

  const blockedDomains = [
    'wa.me',
    't.me',
    'telegram.me',
    'instagram.com',
    'facebook.com',
    'fb.com',
    'discord.gg',
    'snapchat.com',
    'tiktok.com',
  ];
  const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase();

  if (blockedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    badRequest(`${fieldName} cannot point to external messaging or social profiles.`);
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}
