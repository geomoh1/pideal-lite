import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:4000';
const startedAt = Date.now();
const paymentId = `smoke-payment-${startedAt}`;
const orderId = `smoke-order-${startedAt}`;
const serviceId = `smoke-service-${startedAt}`;
const txid = `smoke-tx-${startedAt}`;

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: '4000',
    PI_USE_MOCK_PAYMENTS: 'true',
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
  const health = await waitForHealth();
  const approval = await postJson(`/api/pi/payments/${paymentId}/approve`, {
    orderId,
    serviceId,
    amountPi: 5,
    mode: 'deposit',
    buyerId: 'smoke-buyer',
    buyerName: 'smoke.buyer',
    sellerId: 'smoke-seller',
    sellerName: 'smoke.seller',
  });

  assertEqual(approval.order.status, 'Pending Payment', 'Approval must not mark order as Paid.');

  const beforeCompletion = await getJson(`/api/orders/${orderId}/status`);
  assertEqual(beforeCompletion.order.status, 'Pending Payment', 'Stored order must remain Pending Payment before completion.');

  const completion = await postJson(`/api/pi/payments/${paymentId}/complete`, {
    orderId,
    txid,
  });

  assertEqual(completion.order.status, 'Paid', 'Completion must mark order as Paid.');

  const afterCompletion = await getJson(`/api/orders/${orderId}/status`);
  assertEqual(afterCompletion.order.status, 'Paid', 'Stored order must persist Paid after completion.');

  console.log(JSON.stringify({
    health: health.database,
    approvalStatus: approval.order.status,
    beforeCompletionStatus: beforeCompletion.order.status,
    completionStatus: completion.order.status,
    persistedStatus: afterCompletion.order.status,
  }, null, 2));
} finally {
  await stopServer();
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

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseResponse(response);
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
