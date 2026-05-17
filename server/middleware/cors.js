const configuredOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_ORIGINS || '').split(','),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

export function allowLocalDevCors(request, response, next) {
  const origin = request.headers.origin;

  if (isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', getAllowedHeaders(request));
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Max-Age', '86400');
  }

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204);
  }

  return next();
}

function isAllowedOrigin(origin) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1';
    const isConfigured = configuredOrigins.includes(origin);
    const isVercelPreview = url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');

    return isLocal || isConfigured || isVercelPreview;
  } catch {
    return false;
  }
}

function getAllowedHeaders(request) {
  const requestedHeaders = request.headers['access-control-request-headers'];

  if (requestedHeaders) {
    return requestedHeaders;
  }

  return 'Content-Type, Authorization';
}
