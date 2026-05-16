const PI_API_BASE_URL = (process.env.PI_API_BASE_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
const PI_API_KEY = process.env.PI_NETWORK_API_KEY || process.env.PI_API_KEY;

export async function verifyPiAccessToken(accessToken) {
  if (!accessToken) {
    const error = new Error('Pi access token is required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`${PI_API_BASE_URL}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || 'Pi access token could not be verified.');
    error.statusCode = 401;
    throw error;
  }

  const piUser = data?.user || data;
  const uid = String(piUser?.uid || piUser?.id || '').trim();
  const username = String(piUser?.username || '').trim();

  if (!uid || !username) {
    const error = new Error('Pi /me response did not include uid and username.');
    error.statusCode = 401;
    throw error;
  }

  return { uid, username };
}

export async function callPiPlatform(path, body) {
  if (!PI_API_KEY) {
    const error = new Error('PI_NETWORK_API_KEY or PI_API_KEY is required when mock payments are disabled.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${PI_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${PI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Pi Platform API returned ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}
