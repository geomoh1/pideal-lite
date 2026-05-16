const BLOCKED_DOMAINS = [
  'wa.me',
  'whatsapp.com',
  'api.whatsapp.com',
  'web.whatsapp.com',
  't.me',
  'telegram.me',
  'telegram.org',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'm.me',
  'messenger.com',
  'discord.gg',
  'discord.com',
  'snapchat.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'paypal.com',
  'paypal.me',
  'stripe.com',
  'cash.app',
  'venmo.com',
  'wise.com',
  'buymeacoffee.com',
  'patreon.com',
  'ko-fi.com',
];

const SHORT_LINK_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'lnkd.in',
  'tiny.cc',
  'rb.gy',
];

const PORTFOLIO_DOMAINS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'behance.net',
  'dribbble.com',
  'figma.com',
  'canva.com',
  'docs.google.com',
  'drive.google.com',
  'dropbox.com',
  'notion.so',
  'notion.site',
  'medium.com',
  'codepen.io',
];

const REFERENCE_DOMAINS = [
  ...PORTFOLIO_DOMAINS,
  'raw.githubusercontent.com',
  'gist.github.com',
  'dropboxusercontent.com',
  'onedrive.live.com',
  'storage.googleapis.com',
  'res.cloudinary.com',
  'cloudinary.com',
  'supabase.co',
  'firebaseapp.com',
  'web.app',
];

const DELIVERY_DOMAINS = [
  ...REFERENCE_DOMAINS,
  'vercel.app',
  'netlify.app',
  'netlify.com',
  'github.io',
  'pages.dev',
  'workers.dev',
  'r2.dev',
  'codesandbox.io',
  'stackblitz.com',
  'replit.app',
  'replit.dev',
];

const URL_POLICIES = {
  portfolio: {
    allowedDomains: PORTFOLIO_DOMAINS,
    description: 'a trusted portfolio or work-sample site',
  },
  proof: {
    allowedDomains: PORTFOLIO_DOMAINS,
    description: 'a trusted proof or work-sample site',
  },
  requestReference: {
    allowedDomains: REFERENCE_DOMAINS,
    description: 'a trusted reference, document, design, or file-sharing site',
  },
  deliveryLink: {
    allowedDomains: DELIVERY_DOMAINS,
    description: 'a trusted delivery, file-sharing, repository, or demo-hosting site',
  },
};

export function normalizePolicyUrl(value, policyName, fieldName) {
  const text = String(value || '').trim();
  if (!text) return '';

  const policy = URL_POLICIES[policyName];
  if (!policy) {
    throw new Error(`Unknown URL policy: ${policyName}`);
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    badRequest(`${fieldName} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== 'https:') {
    badRequest(`${fieldName} must use HTTPS.`);
  }

  if (url.username || url.password) {
    badRequest(`${fieldName} cannot include embedded username or password credentials.`);
  }

  const hostname = normalizeHostname(url.hostname);

  if (isLocalOrPrivateHost(hostname)) {
    badRequest(`${fieldName} cannot point to a local or private network address.`);
  }

  if (matchesDomain(hostname, BLOCKED_DOMAINS)) {
    badRequest(`${fieldName} cannot point to messaging, social contact, or external payment sites.`);
  }

  if (matchesDomain(hostname, SHORT_LINK_DOMAINS)) {
    badRequest(`${fieldName} cannot use short links. Use the original destination URL.`);
  }

  if (!matchesDomain(hostname, policy.allowedDomains)) {
    badRequest(`${fieldName} must use ${policy.description}.`);
  }

  return url.toString();
}

function normalizeHostname(hostname) {
  return hostname.replace(/\.$/, '').replace(/^www\./, '').toLowerCase();
}

function matchesDomain(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isLocalOrPrivateHost(hostname) {
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}
