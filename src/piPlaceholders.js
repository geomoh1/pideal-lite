/*
  Official Pi SDK integration layer for PiDeal Lite.

  The Pi SDK is loaded in index.html using the official script:
  https://sdk.minepi.com/pi-sdk.js

  Keep every direct Pi SDK call in this file. React components should import
  these wrapper functions only.

  Important payment note:
  Official Pi payments require server-side approval and server-side completion.
  PiDeal routes those callbacks through the backend, and the frontend only treats
  an order as paid after the backend completion endpoint returns Paid.
*/

function getPiSdk() {
  if (isLocalDevelopmentHost()) {
    return null;
  }

  return typeof window !== 'undefined' && window.Pi ? window.Pi : null;
}

function isLocalDevelopmentHost() {
  if (typeof window === 'undefined') return false;

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function isPiSdkAvailable() {
  const pi = getPiSdk();
  return Boolean(pi?.authenticate && pi?.createPayment);
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

function apiPath(path) {
  return `${getApiBaseUrl()}${path}`;
}

async function postJson(path, body) {
  const response = await fetch(apiPath(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Payment backend request failed: ${response.status}`);
  }

  return data;
}

async function createLocalMockPayment({
  orderId,
  serviceId,
  amountPi,
  mode,
  buyerId,
  buyerName,
  sellerId,
  sellerName,
}) {
  const paymentId = `pi-local-${serviceId}-${Date.now()}`;
  const txid = `pi-local-tx-${orderId}-${Date.now()}`;
  const approval = await approvePiPayment({
    paymentId,
    orderId,
    serviceId,
    amountPi,
    mode,
    buyerId,
    buyerName,
    sellerId,
    sellerName,
  });
  const completion = await completePiPayment({ paymentId, txid, orderId });

  return {
    payment: {
      paymentId,
      orderId,
      serviceId,
      amountPi,
      mode,
      status: 'local_payment_placeholder_created',
    },
    approval,
    completion,
    order: completion.order,
  };
}

export function getPiIntegrationStatus() {
  return {
    sdkAvailable: isPiSdkAvailable(),
    mode: isPiSdkAvailable() ? 'official-pi-sdk' : 'local-mock-fallback',
  };
}

export async function authenticateWithPi() {
  const pi = getPiSdk();

  if (!pi?.authenticate) {
    return {
      uid: 'pi-user-placeholder',
      username: 'pioneer.demo',
      accessToken: 'local-placeholder-access-token',
      walletStatus: 'Local Pi SDK fallback',
    };
  }

  const scopes = ['username', 'payments'];

  function onIncompletePaymentFound(payment) {
    console.warn('Incomplete Pi payment found', payment);
  }

  const auth = await pi.authenticate(scopes, onIncompletePaymentFound);

  return {
    uid: auth.user.uid,
    username: auth.user.username,
    accessToken: auth.accessToken,
    walletStatus: 'Official Pi SDK connected',
  };
}

export async function createPiDepositPayment({
  orderId,
  serviceId,
  amountPi,
  mode,
  buyerId,
  buyerName,
  sellerId,
  sellerName,
}) {
  const pi = getPiSdk();

  if (!pi?.createPayment) {
    return createLocalMockPayment({
      orderId,
      serviceId,
      amountPi,
      mode,
      buyerId,
      buyerName,
      sellerId,
      sellerName,
    });
  }

  return new Promise((resolve, reject) => {
    const paymentState = {
      payment: null,
      approval: null,
      completion: null,
    };
    let settled = false;

    function fail(error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }

    pi.createPayment(
      {
        amount: amountPi,
        memo: `PiDeal ${mode === 'full' ? 'full payment' : 'deposit'} for order ${orderId}`,
        metadata: {
          orderId,
          serviceId,
          mode,
        },
      },
      {
        onReadyForServerApproval: async function onReadyForServerApproval(paymentId) {
          try {
            paymentState.payment = {
              paymentId,
              orderId,
              serviceId,
              amountPi,
              mode,
              status: 'ready_for_server_approval',
            };

            paymentState.approval = await approvePiPayment({
              paymentId,
              orderId,
              serviceId,
              amountPi,
              mode,
              buyerId,
              buyerName,
              sellerId,
              sellerName,
            });
          } catch (error) {
            fail(error);
          }
        },
        onReadyForServerCompletion: async function onReadyForServerCompletion(paymentId, txid) {
          try {
            paymentState.completion = await completePiPayment({ paymentId, txid, orderId });

            if (!settled) {
              settled = true;
              resolve({
                payment: {
                  paymentId,
                  orderId,
                  serviceId,
                  amountPi,
                  mode,
                  txid,
                  status: 'server_completion_acknowledged',
                },
                approval: paymentState.approval,
                completion: paymentState.completion,
                order: paymentState.completion.order,
              });
            }
          } catch (error) {
            fail(error);
          }
        },
        onCancel: function onCancel(paymentId) {
          fail(new Error(`Pi payment cancelled: ${paymentId}`));
        },
        onError: function onError(error) {
          fail(error);
        },
      },
    );
  });
}

export async function approvePiPayment({
  paymentId,
  orderId,
  serviceId,
  amountPi,
  mode,
  buyerId,
  buyerName,
  sellerId,
  sellerName,
}) {
  return postJson(`/api/pi/payments/${encodeURIComponent(paymentId)}/approve`, {
    orderId,
    serviceId,
    amountPi,
    mode,
    buyerId,
    buyerName,
    sellerId,
    sellerName,
  });
}

export async function completePiPayment({ paymentId, txid, orderId }) {
  return postJson(`/api/pi/payments/${encodeURIComponent(paymentId)}/complete`, {
    orderId,
    txid,
  });
}

export async function confirmPiDeliveryPayment({ orderId }) {
  return {
    orderId,
    status: 'delivery_confirmation_recorded',
    confirmedAt: new Date().toISOString(),
  };
}
