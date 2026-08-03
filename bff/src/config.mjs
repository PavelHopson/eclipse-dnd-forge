import { isAbsolute, normalize } from 'node:path';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function integer(value, fallback, { min, max, name }) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function exactOrigin(value) {
  const url = new URL(value || 'https://dnd.eclipse-forge.ru');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('DND_PUBLIC_ORIGIN must be an exact HTTPS origin without path, credentials, query or fragment');
  }
  return url.origin;
}

function endpoint(value, name, { allowPath = true } = {}) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  const url = new URL(value.trim());
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !loopback)) {
    throw new Error(`${name} must use HTTPS or loopback HTTP`);
  }
  if (url.username || url.password || url.hash || (!allowPath && url.pathname !== '/')) {
    throw new Error(`${name} must not contain credentials or a fragment`);
  }
  return url.toString().replace(/\/$/, '');
}

function redirectEndpoint(value) {
  const url = new URL(value || 'https://dnd.eclipse-forge.ru/');
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.hash) {
    throw new Error('DND_CHAT_REDIRECT_URI must use HTTPS (or loopback HTTP) without credentials or fragment');
  }
  return url.toString();
}

function absoluteDataFile(value, production) {
  if (!value?.trim()) {
    if (production) throw new Error('DND_BFF_BUDGET_FILE is required in production');
    return undefined;
  }
  const file = normalize(value.trim());
  if (!isAbsolute(file) || !/^[A-Za-z0-9._/\\:\- ]+$/.test(file)) {
    throw new Error('DND_BFF_BUDGET_FILE must be an absolute path without shell metacharacters');
  }
  return file;
}

export function loadBffConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const secureCookie = env.DND_BFF_SECURE_COOKIE === undefined
    ? production
    : env.DND_BFF_SECURE_COOKIE === 'true';
  if (production && !secureCookie) throw new Error('DND_BFF_SECURE_COOKIE cannot be disabled in production');

  const serviceToken = env.DND_AI_GATEWAY_SERVICE_TOKEN?.trim();
  if (!serviceToken || serviceToken.length < 32 || serviceToken.length > 512) {
    throw new Error('DND_AI_GATEWAY_SERVICE_TOKEN must contain 32..512 characters');
  }

  return Object.freeze({
    host: env.DND_BFF_HOST?.trim() || '127.0.0.1',
    port: integer(env.DND_BFF_PORT, 8820, { min: 1, max: 65_535, name: 'DND_BFF_PORT' }),
    publicOrigin: exactOrigin(env.DND_PUBLIC_ORIGIN),
    secureCookie,
    cookieName: secureCookie ? '__Host-eclipse_dnd_session' : 'eclipse_dnd_session_dev',
    sessionTtlSeconds: integer(env.DND_BFF_SESSION_TTL_SECONDS, 3_600, {
      min: 300,
      max: 86_400,
      name: 'DND_BFF_SESSION_TTL_SECONDS',
    }),
    chatTokenUrl: endpoint(env.DND_CHAT_TOKEN_URL, 'DND_CHAT_TOKEN_URL'),
    chatJwksUrl: endpoint(env.DND_CHAT_JWKS_URL, 'DND_CHAT_JWKS_URL'),
    chatIssuer: endpoint(env.DND_CHAT_ISSUER, 'DND_CHAT_ISSUER'),
    chatAudience: 'eclipse-dnd-forge',
    clientId: 'eclipse-dnd-forge',
    redirectUri: redirectEndpoint(env.DND_CHAT_REDIRECT_URI),
    aiGatewayBaseUrl: endpoint(env.DND_AI_GATEWAY_BASE_URL, 'DND_AI_GATEWAY_BASE_URL'),
    aiGatewayServiceToken: serviceToken,
    timeoutMs: integer(env.DND_BFF_TIMEOUT_MS, 60_000, {
      min: 1_000,
      max: 120_000,
      name: 'DND_BFF_TIMEOUT_MS',
    }),
    maxBodyBytes: integer(env.DND_BFF_MAX_BODY_BYTES, 262_144, {
      min: 16_384,
      max: 1_048_576,
      name: 'DND_BFF_MAX_BODY_BYTES',
    }),
    maxOutputTokens: integer(env.DND_BFF_MAX_OUTPUT_TOKENS, 2_048, {
      min: 64,
      max: 8_192,
      name: 'DND_BFF_MAX_OUTPUT_TOKENS',
    }),
    userRequestsPer15Minutes: integer(env.DND_BFF_USER_REQUESTS_PER_15_MINUTES, 60, {
      min: 1,
      max: 2_000,
      name: 'DND_BFF_USER_REQUESTS_PER_15_MINUTES',
    }),
    userDailyTokens: integer(env.DND_BFF_USER_DAILY_TOKENS, 250_000, {
      min: 1_000,
      max: 100_000_000,
      name: 'DND_BFF_USER_DAILY_TOKENS',
    }),
    productDailyTokens: integer(env.DND_BFF_PRODUCT_DAILY_TOKENS, 5_000_000, {
      min: 10_000,
      max: 1_000_000_000,
      name: 'DND_BFF_PRODUCT_DAILY_TOKENS',
    }),
    aiEnabled: env.DND_BFF_AI_ENABLED !== 'false',
    budgetFile: absoluteDataFile(env.DND_BFF_BUDGET_FILE, production),
  });
}
