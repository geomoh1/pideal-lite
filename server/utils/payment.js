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
    memo: `PiDeal ${getPaymentMemoMode(mode)} for order ${orderId}`,
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
  if (mode === 'full') return 'Full payment';
  if (mode === 'balance') return 'Remaining balance';
  return 'Deposit';
}

function getPaymentMemoMode(mode) {
  if (mode === 'full') return 'full payment';
  if (mode === 'balance') return 'remaining balance';
  return 'deposit';
}

export function calculatePlatformFee(amountPi) {
  if (!Number.isFinite(Number(amountPi))) return null;
  return Number((Number(amountPi) * getPlatformFeeRate()).toFixed(2));
}

export function getPlatformFeeRate() {
  const rate = Number(process.env.PLATFORM_FEE_RATE ?? 0.05);
  if (!Number.isFinite(rate) || rate < 0) return 0.05;
  return rate;
}

export function getPlatformFeePercentLabel() {
  return `${Number((getPlatformFeeRate() * 100).toFixed(2))}%`;
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
    sellerStatus: service.seller?.sellerStatus || 'unverified',
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
    portfolioUrl: service.portfolioUrl || '',
    proofLink: service.proofLink || '',
    experience: service.experience || '',
    revisionPolicy: service.revisionPolicy || '',
    requirementsFromBuyer: service.requirementsFromBuyer || '',
    deliverables: parseJson(service.deliverablesJson) || [
      'Digital delivery message or link',
      'Buyer confirmation required',
      'Pi escrow payment',
    ],
  };
}

export function serializeOrder(order, viewer = null) {
  if (!order) return null;

  const completedPayments = Array.isArray(order.payments)
    ? order.payments.filter((payment) => payment.status === 'completed')
    : [];
  const paidTotal = Number(
    completedPayments.reduce((sum, payment) => sum + Number(payment.amountPi || 0), 0).toFixed(2),
  );
  const orderPrice = Number(order.service?.pricePi ?? order.amountPi ?? 0);
  const remainingPi = Number(Math.max(orderPrice - paidTotal, 0).toFixed(2));
  const escrowStatus = order.escrowStatus || inferEscrowStatus(order, paidTotal, remainingPi);
  const storedEscrowFeePi = Number(order.escrowFeePi ?? 0);
  const escrowFeePi = storedEscrowFeePi || Number(order.platformFeePi ?? calculatePlatformFee(paidTotal) ?? 0);
  const storedSellerPayoutPi = Number(order.sellerPayoutPi ?? 0);
  const canHaveSellerPayout =
    ['holding_full', 'release_pending', 'released'].includes(escrowStatus) ||
    (!['refunded', 'disputed'].includes(escrowStatus) && paidTotal > 0 && remainingPi === 0);
  const sellerPayoutPi = storedSellerPayoutPi || (canHaveSellerPayout ? Math.max(paidTotal - escrowFeePi, 0) : 0);
  const storedEscrowHeldPi = Number(order.escrowHeldPi ?? 0);
  const escrowHeldPi = storedEscrowHeldPi > 0 || ['released', 'refunded'].includes(escrowStatus)
    ? storedEscrowHeldPi
    : paidTotal;
  const latestCompletedPayment = completedPayments[0];
  const viewerId = viewer?.id || viewer?.uid || '';
  const isAdminViewer = viewer?.role === 'admin' || viewer?.appRole === 'admin';
  const isSellerViewer = viewerId && viewerId === order.sellerId;
  const isBuyerViewer = viewerId && viewerId === order.buyerId;
  const canViewDeliveryAssets = isAdminViewer || isSellerViewer || (isBuyerViewer && remainingPi === 0);
  const canPayRemaining = isBuyerViewer && order.status === 'Delivered' && remainingPi > 0;

  return {
    id: order.id,
    orderId: order.id,
    serviceId: order.serviceId,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    sellerId: order.sellerId,
    sellerName: order.sellerName,
    status: order.status,
    paymentMode: order.paymentMode || (latestCompletedPayment ? normalizePaymentMode(latestCompletedPayment.mode) : null),
    amountPi: order.amountPi,
    paidPi: paidTotal,
    remainingPi,
    platformFeePi: order.platformFeePi ?? calculatePlatformFee(paidTotal) ?? 0,
    platformFeeRate: getPlatformFeeRate(),
    platformFeePercent: getPlatformFeePercentLabel(),
    escrowStatus,
    escrowHeldPi: Number(escrowHeldPi.toFixed(2)),
    escrowFeePi: Number(escrowFeePi.toFixed(2)),
    sellerPayoutPi: Number(Math.max(sellerPayoutPi, 0).toFixed(2)),
    refundedPi: Number(order.refundedPi || 0),
    escrowFundedAt: formatDateTime(order.escrowFundedAt),
    disputeOpenedAt: formatDateTime(order.disputeOpenedAt),
    disputeResolvedAt: formatDateTime(order.disputeResolvedAt),
    disputeWindowEndsAt: formatDateTime(order.disputeWindowEndsAt),
    releaseEligibleAt: formatDateTime(order.releaseEligibleAt),
    releasedAt: formatDateTime(order.releasedAt),
    refundRecordedAt: formatDateTime(order.refundRecordedAt),
    sellerPayoutTxid: order.sellerPayoutTxid || '',
    refundTxid: order.refundTxid || '',
    paidAt: order.paidAt,
    buyerNote: order.buyerNote || '',
    requestSourceText: order.requestSourceText || '',
    requestReferenceLink: order.requestReferenceLink || '',
    requestFileName: order.requestFileName || '',
    requestFileSize: order.requestFileSize || '',
    deliveryMessage: order.deliveryMessage || '',
    deliveryLink: canViewDeliveryAssets ? order.deliveryLink || '' : '',
    deliveryFileName: canViewDeliveryAssets ? order.deliveryFileName || '' : '',
    deliveryFileSize: canViewDeliveryAssets ? order.deliveryFileSize || '' : '',
    deliveryAssetsLocked: Boolean(order.deliveryLink || order.deliveryFileName) && !canViewDeliveryAssets,
    canPayRemaining,
    rating: order.review?.rating ?? null,
    createdAt: formatDate(order.createdAt),
    payments: order.payments?.map(serializePayment) || [],
    escrowEvents: order.escrowEvents?.map(serializeEscrowEvent) || [],
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

export function serializeEscrowEvent(event) {
  if (!event) return null;

  return {
    id: event.id,
    orderId: event.orderId,
    actorId: event.actorId || '',
    type: event.type,
    amountPi: event.amountPi,
    status: event.status || '',
    note: event.note || '',
    txid: event.txid || '',
    createdAt: formatDateTime(event.createdAt),
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

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function inferEscrowStatus(order, paidTotal, remainingPi) {
  if (order.status === 'Refunded') return 'refunded';
  if (order.status === 'Disputed') return 'disputed';
  if (order.status === 'Completed') return order.releasedAt ? 'released' : 'release_pending';
  if (paidTotal > 0 && remainingPi <= 0) return 'holding_full';
  if (paidTotal > 0) return 'holding_deposit';
  return 'not_funded';
}
