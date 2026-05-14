import 'dotenv/config';
import express from 'express';

import { allowLocalDevCors } from './middleware/cors.js';
import { prisma, ensureUser, ensureServiceSnapshot, shutdown } from './utils/db.js';
import { callPiPlatform } from './utils/piClient.js';
import {
  normalizePaymentRequest,
  createMockPaymentDto,
  normalizePaymentMode,
  calculatePlatformFee,
  serializeOrder,
  serializePayment,
  stringifyJson,
} from './utils/payment.js';

const app = express();

const PORT = Number(process.env.PORT || 4000);
const USE_MOCK_PAYMENTS =
  process.env.PI_USE_MOCK_PAYMENTS === 'true' ||
  (!process.env.PI_API_KEY && process.env.NODE_ENV !== 'production');

const ORDER_STATUS = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
};

app.use(express.json({ limit: '64kb' }));
app.use(allowLocalDevCors);

app.get('/api/health', async (request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return response.json({
      ok: true,
      service: 'pideal-lite-payments',
      database: 'sqlite-prisma',
      piPaymentsMode: USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api',
    });
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

    const buyer = await ensureUser(
      paymentRequest.buyerId || `buyer-${paymentRequest.orderId}`,
      paymentRequest.buyerName || 'Pi buyer',
      'buyer',
    );
    const seller = await ensureUser(
      paymentRequest.sellerId || `seller-${paymentRequest.serviceId || paymentRequest.orderId}`,
      paymentRequest.sellerName || 'Pi seller',
      'seller',
    );

    await ensureServiceSnapshot({
      serviceId: paymentRequest.serviceId,
      sellerId: seller.id,
      amountPi: paymentRequest.amountPi,
    });

    const piPayment = USE_MOCK_PAYMENTS
      ? createMockPaymentDto({ ...paymentRequest, phase: 'approved' })
      : await callPiPlatform(`/payments/${encodeURIComponent(paymentId)}/approve`);

    const { order, payment } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.upsert({
        where: { id: paymentRequest.orderId },
        create: {
          id: paymentRequest.orderId,
          serviceId: paymentRequest.serviceId,
          buyerId: buyer.id,
          sellerId: seller.id,
          buyerName: buyer.username,
          sellerName: seller.username,
          status: ORDER_STATUS.PENDING_PAYMENT,
          amountPi: paymentRequest.amountPi,
          platformFeePi: calculatePlatformFee(paymentRequest.amountPi),
        },
        update: {
          serviceId: paymentRequest.serviceId,
          buyerId: buyer.id,
          sellerId: seller.id,
          buyerName: buyer.username,
          sellerName: seller.username,
          amountPi: paymentRequest.amountPi,
          platformFeePi: calculatePlatformFee(paymentRequest.amountPi),
        },
      });

      const payment = await tx.payment.upsert({
        where: { id: paymentId },
        create: {
          id: paymentId,
          orderId: paymentRequest.orderId,
          serviceId: paymentRequest.serviceId,
          amountPi: paymentRequest.amountPi,
          mode: paymentRequest.mode,
          status: 'approved',
          mock: USE_MOCK_PAYMENTS,
          piPaymentJson: stringifyJson(piPayment),
        },
        update: {
          orderId: paymentRequest.orderId,
          serviceId: paymentRequest.serviceId,
          amountPi: paymentRequest.amountPi,
          mode: paymentRequest.mode,
          status: 'approved',
          mock: USE_MOCK_PAYMENTS,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      return { order, payment };
    });

    return response.json({
      ok: true,
      mock: USE_MOCK_PAYMENTS,
      payment: serializePayment(payment),
      order: serializeOrder(order),
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
      include: { order: true },
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

    const piPayment = USE_MOCK_PAYMENTS
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

    const { order, payment } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          txid,
          status: 'completed',
          mock: USE_MOCK_PAYMENTS,
          piPaymentJson: stringifyJson(piPayment),
        },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: ORDER_STATUS.PAID,
          paidAt: new Date(),
          paymentMode: normalizePaymentMode(existingPayment.mode),
          amountPi: existingPayment.amountPi,
          platformFeePi: calculatePlatformFee(existingPayment.amountPi),
        },
      });

      return { order, payment };
    });

    return response.json({
      ok: true,
      mock: USE_MOCK_PAYMENTS,
      payment: serializePayment(payment),
      order: serializeOrder(order),
      piPayment,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/orders/:orderId/status', async (request, response, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: request.params.orderId },
      include: {
        payments: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

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
    error: error.message || 'Unexpected payment server error.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`PiDeal payment backend listening on http://127.0.0.1:${PORT}`);
  console.log(`Pi payments mode: ${USE_MOCK_PAYMENTS ? 'mock' : 'pi-platform-api'}`);
});

process.once('SIGINT', () => shutdown(server));
process.once('SIGTERM', () => shutdown(server));
