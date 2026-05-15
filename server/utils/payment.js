export function normalizePaymentRequest(paymentId, body = {}) {
  const amountPi = Number(body.amountPi);

  if (body.amountPi !== undefined && !Number.isFinite(amountPi)) {
    const error = new Error('amountPi must be a number when provided.');
    error.statusCode = 400;
    throw error;
  }

  return {
    paymentId,
    orderId: body.orderId,
    serviceId: body.serviceId || null,
    amountPi: body.amountPi === undefined ? null : amountPi,
    mode: body.mode || 'deposit',
    buyerId: body.buyerId || null,
    buyerName: body.buyerName || null,
    sellerId: body.sellerId || null,
    sellerName: body.sellerName || null,
    demoMode: body.demoMode === true,
  };
}

export function createMockPaymentDto({ paymentId, orderId, serviceId, amountPi, mode, txid, phase }) {
  return {
    identifier: paymentId,
    amount: amountPi,
    memo: `PiDeal ${mode === 'full' ? 'full payment' : 'deposit'} for order ${orderId}`,
    metadata: { orderId, serviceId, mode },
    direction: 'user_to_app',
    created_at: new Date().toISOString(),
    network: 'Pi Testnet',
    status: {
      developer_approved: ['approved', 'completed'].includes(phase),
      transaction_verified: phase === 'completed',
      developer_completed: phase === 'completed',
      cancelled: false,
      user_cancelled: false,
    },
    transaction: txid ? { txid, verified: true, _link: '' } : null,
  };
}

export function normalizePaymentMode(mode) {
  return mode === 'full' ? 'Full payment' : 'Deposit';
}

export function calculatePlatformFee(amountPi) {
  if (!Number.isFinite(Number(amountPi))) return null;
  return Number((Number(amountPi) * 0.05).toFixed(2));
}

export function serializeService(service) {
  if (!service) return null;

  const reviewRecords = Array.isArray(service.reviews) ? service.reviews : [];
  const reviewCount = service.reviewCount ?? service._count?.reviews ?? reviewRecords.length ?? 0;
  const averageRating =
    service.rating ??
    (reviewRecords.length
      ? Number((reviewRecords.reduce((sum, review) => sum + review.rating, 0) / reviewRecords.length).toFixed(1))
      : 0);

  return {
    id: service.id,
    title: service.title,
    category: service.category,
    sellerId: service.sellerId,
    seller: service.seller?.username || service.sellerName || 'Pi seller',
    sellerHandle: service.sellerHandle || `@${service.seller?.username || 'seller'}`,
    pricePi: service.pricePi,
    depositPi: service.depositPi,
    rating: averageRating,
    reviews: reviewCount,
    deliveryDays: service.deliveryDays,
    status: service.status,
    accent: service.accent || '#f5b84b',
    icon: service.icon || service.category?.slice(0, 2).toUpperCase() || 'PI',
    featured: service.featured === true,
    createdAt: formatDate(service.createdAt),
    summary: service.summary || '',
    terms: service.terms || '',
    deliverables: parseJson(service.deliverablesJson) || [
      'Digital delivery message or link',
      'Buyer confirmation required',
      'Pi payment placeholder',
    ],
  };
}

export function serializeOrder(order) {
  if (!order) return null;

  return {
    id: order.id,
    orderId: order.id,
    serviceId: order.serviceId,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    sellerId: order.sellerId,
    sellerName: order.sellerName,
    status: order.status,
    paymentMode: order.paymentMode,
    amountPi: order.amountPi,
    paidPi: order.amountPi ?? 0,
    platformFeePi: order.platformFeePi ?? 0,
    paidAt: order.paidAt,
    buyerNote: order.buyerNote || '',
    requestSourceText: order.requestSourceText || '',
    requestReferenceLink: order.requestReferenceLink || '',
    requestFileName: order.requestFileName || '',
    requestFileSize: order.requestFileSize || '',
    deliveryMessage: order.deliveryMessage || '',
    deliveryLink: order.deliveryLink || '',
    deliveryFileName: order.deliveryFileName || '',
    deliveryFileSize: order.deliveryFileSize || '',
    rating: order.review?.rating ?? null,
    createdAt: formatDate(order.createdAt),
    payments: order.payments?.map(serializePayment) || [],
  };
}

export function serializePayment(payment) {
  if (!payment) return null;

  return {
    ...payment,
    paymentId: payment.id,
    piPayment: parseJson(payment.piPaymentJson),
  };
}

export function serializeReport(report) {
  if (!report) return null;

  return {
    id: report.id,
    serviceId: report.serviceId,
    serviceTitle: report.serviceTitle || report.service?.title || 'Reported service',
    reason: report.reason,
    status: report.status,
    reporterId: report.reporterId,
    createdAt: formatDate(report.createdAt),
  };
}

export function stringifyJson(value) {
  return value ? JSON.stringify(value) : null;
}

function parseJson(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}
