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

export function serializeOrder(order) {
  if (!order) return null;

  return {
    ...order,
    orderId: order.id,
    paidPi: order.amountPi,
    payments: order.payments?.map(serializePayment),
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
