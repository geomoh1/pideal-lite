const PI_API_BASE_URL = (process.env.PI_API_BASE_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
const PI_API_KEY = process.env.PI_API_KEY;

export async function callPiPlatform(path, body) {
  if (!PI_API_KEY) {
    const error = new Error('PI_API_KEY is required when mock payments are disabled.');
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
