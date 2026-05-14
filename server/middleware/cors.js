export function allowLocalDevCors(request, response, next) {
  const origin = request.headers.origin;
  const isLocalOrigin =
    origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:');

  if (isLocalOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204);
  }

  return next();
}
