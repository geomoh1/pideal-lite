/*
  Official Pi SDK integration layer for PiDeal Lite.

  The Pi SDK is loaded from the official script in index.html, and this
  module can also load it dynamically for local one-off SDK tests:
  https://sdk.minepi.com/pi-sdk.js

  Keep every direct Pi SDK call in this file. React components should import
  these wrapper functions only.

  Important payment note:
  Official Pi payments require server-side approval and server-side completion.
  PiDeal routes those callbacks through the backend, and the frontend only treats
  an order as paid only after the backend completion endpoint advances escrow state.
*/

const PI_SDK_SCRIPT_SRC = 'https://sdk.minepi.com/pi-sdk.js';
let piSdkInitialized = false;
let piSdkLoadPromise = null;
let piSdkInitPromise = null;

function getPiSdk() {
  if (!isPiSdkAllowedRuntime()) {
    return null;
  }

  return typeof window !== 'undefined' && window.Pi ? window.Pi : null;
}

function isLocalDevelopmentHost() {
  if (typeof window === 'undefined') return false;

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function isPiSdkAllowedRuntime() {
  if (typeof window === 'undefined') return false;
  if (isLocalDevelopmentHost()) return window.location.search.includes('pi_sdk=1');
  if (import.meta.env.VITE_ENABLE_PI_SDK === 'true') return true;
  if (window.Pi?.authenticate) return true;
  return window.location.search.includes('pi_sdk=1');
}

function isDeployedStaticFrontend() {
  if (typeof window === 'undefined') return false;

  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function isPiSdkAvailable() {
  const pi = getPiSdk();
  return Boolean(pi?.authenticate && pi?.createPayment);
}

async function initializePiSdkIfEnabled() {
  if (piSdkInitialized || typeof window === 'undefined') return;
  if (!window.Pi?.init) return;
  if (piSdkInitPromise) return piSdkInitPromise;

  piSdkInitPromise = (async () => {
    await window.Pi.init({ version: '2.0' });
    piSdkInitialized = true;
  })();

  return piSdkInitPromise;
}

async function ensurePiSdkReady() {
  if (!isPiSdkAllowedRuntime()) return null;
  if (typeof window === 'undefined') return null;

  if (!window.Pi) {
    await loadPiSdkScript();
  }

  await initializePiSdkIfEnabled();
  return window.Pi || null;
}

function loadPiSdkScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Pi) return Promise.resolve();
  if (piSdkLoadPromise) return piSdkLoadPromise;

  piSdkLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${PI_SDK_SCRIPT_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PI_SDK_SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Official Pi SDK script could not be loaded.'));
    document.head.appendChild(script);
  });

  return piSdkLoadPromise;
}

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
    throw new Error(data?.error || `PiDeal backend request failed: ${response.status}`);
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
    demoMode: true,
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
  if (!isPiSdkAllowedRuntime()) {
    return {
      sdkAvailable: false,
      mode: 'demo-no-pi-sdk',
    };
  }

  return {
    sdkAvailable: isPiSdkAvailable(),
    mode: isPiSdkAvailable() ? 'official-pi-sdk' : 'local-mock-fallback',
  };
}

export function shouldAutoAuthenticateWithPi() {
  if (typeof window === 'undefined') return false;
  if (isLocalDevelopmentHost()) return false;
  return import.meta.env.VITE_ENABLE_PI_SDK === 'true' || Boolean(window.Pi?.authenticate);
}

export async function authenticateWithPi() {
  const pi = await ensurePiSdkReady();

  if (!pi?.authenticate) {
    if (isPiSdkAllowedRuntime()) {
      throw new Error('Official Pi SDK authentication is not available in this browser.');
    }

    return {
      uid: 'pi-user-placeholder',
      username: 'pioneer.demo',
      accessToken: 'local-placeholder-access-token',
      walletStatus: 'Local Pi SDK fallback',
      authProvider: 'local-fallback',
      demoMode: true,
    };
  }

  const scopes = ['username', 'payments'];

  function onIncompletePaymentFound(payment) {
    void completeIncompletePiPayment(payment).catch((error) => {
      console.error('Incomplete Pi payment could not be completed by the backend.', error);
    });
  }

  const auth = await pi.authenticate(scopes, onIncompletePaymentFound);

  return {
    uid: auth.user.uid,
    username: auth.user.username,
    accessToken: auth.accessToken,
    walletStatus: 'Official Pi SDK connected',
    authProvider: 'pi-sdk',
    demoMode: false,
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
  demoMode = false,
}) {
  const pi = await ensurePiSdkReady();

  if (demoMode || !pi?.createPayment) {
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
        memo: `PiDeal ${getPaymentMemoMode(mode)} for order ${orderId}`,
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

function getPaymentMemoMode(mode) {
  if (mode === 'full') return 'full payment';
  if (mode === 'balance') return 'remaining balance';
  return 'deposit';
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
  demoMode = false,
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
    demoMode,
  });
}

export async function completePiPayment({ paymentId, txid, orderId }) {
  return postJson(`/api/pi/payments/${encodeURIComponent(paymentId)}/complete`, {
    orderId,
    txid,
  });
}

export async function completeIncompletePiPayment(payment) {
  const paymentId = getPiPaymentId(payment);

  if (!paymentId) {
    throw new Error('Incomplete Pi payment did not include a payment identifier.');
  }

  const transaction = payment?.transaction || {};
  const metadata = payment?.metadata || {};

  return postJson('/api/pi/payments/incomplete', {
    paymentId,
    txid: payment?.txid || transaction.txid || '',
    orderId: payment?.orderId || metadata.orderId || '',
    serviceId: payment?.serviceId || metadata.serviceId || '',
    mode: payment?.mode || metadata.mode || '',
    piPayment: payment,
  });
}

export async function confirmPiDeliveryPayment({ orderId }) {
  return postJson(`/api/orders/${encodeURIComponent(orderId)}/confirm`, {});
}

function getPiPaymentId(payment) {
  return String(payment?.identifier || payment?.paymentId || payment?.id || '').trim();
}
