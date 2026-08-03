import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { AtomicBudgetStore, BudgetExceededError } from './budget.mjs';
import { IdentityValidationError, JwksVerifier } from './identity.mjs';

class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

class KeyedFixedWindowLimiter {
  constructor(limit, windowMs, maxKeys = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
    this.windows = new Map();
  }

  consume(key, now = Date.now()) {
    if (this.windows.size >= this.maxKeys) {
      for (const [entryKey, entry] of this.windows) {
        if (now - entry.startedAt >= this.windowMs) this.windows.delete(entryKey);
      }
      if (this.windows.size >= this.maxKeys && !this.windows.has(key)) return false;
    }
    let entry = this.windows.get(key);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      entry = { startedAt: now, count: 0 };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}

function sendJson(response, status, payload, requestId, origin, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Request-Id': requestId,
    ...(origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    } : {}),
    ...extraHeaders,
  });
  response.end(body);
}

function sendError(response, error, requestId, origin) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'internal_error';
  const message = error instanceof HttpError ? error.message : 'DnD service request failed';
  const headers = error instanceof HttpError ? error.headers : {};
  sendJson(response, status, { error: { code, message, requestId } }, requestId, origin, headers);
}

async function readJson(request, maxBytes) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON');
  }
}

async function readResponseJson(response, maxBytes = 4_194_304) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes || !response.body) {
    throw new HttpError(502, 'invalid_upstream_response', 'Upstream returned an invalid response');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(502, 'invalid_upstream_response', 'Upstream returned an invalid response');
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(502, 'invalid_upstream_response', 'Upstream returned an invalid response');
  }
}

function parseCookies(header) {
  const cookies = new Map();
  if (typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return cookies;
}

function tokenHash(value) {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

function clientAddress(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const candidate = typeof forwarded === 'string'
    ? forwarded.split(',')[0]?.trim()
    : request.socket.remoteAddress;
  return typeof candidate === 'string' && /^[A-Fa-f0-9:.]{1,64}$/.test(candidate)
    ? candidate
    : 'unknown';
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function exactFields(body, fields) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).every((field) => fields.includes(field));
}

function validateCompletion(body, config) {
  if (!exactFields(body, ['model', 'messages', 'temperature', 'max_tokens', 'stream'])) {
    throw new HttpError(400, 'invalid_request', 'Request contains unsupported fields');
  }
  if (typeof body.model !== 'string' || body.model.length < 1 || body.model.length > 200) {
    throw new HttpError(400, 'invalid_model', 'Choose a model exposed by the gateway');
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 64) {
    throw new HttpError(400, 'invalid_messages', 'Messages must contain between 1 and 64 items');
  }
  const roles = new Set(['system', 'user', 'assistant']);
  let contentCharacters = 0;
  for (const message of body.messages) {
    if (!exactFields(message, ['role', 'content']) || !roles.has(message.role) || typeof message.content !== 'string') {
      throw new HttpError(400, 'invalid_message', 'Every message must contain a supported role and text content');
    }
    contentCharacters += message.content.length;
    if (message.content.length > 40_000 || contentCharacters > 100_000) {
      throw new HttpError(400, 'invalid_message', 'Message content is too large');
    }
  }
  if (body.stream === true) throw new HttpError(400, 'stream_not_supported', 'Streaming is not available yet');
  if (body.temperature !== undefined &&
    (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    throw new HttpError(400, 'invalid_temperature', 'temperature must be between 0 and 2');
  }
  const maxTokens = body.max_tokens ?? Math.min(1024, config.maxOutputTokens);
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > config.maxOutputTokens) {
    throw new HttpError(400, 'invalid_max_tokens', `max_tokens must be between 1 and ${config.maxOutputTokens}`);
  }
  return {
    body: { ...body, max_tokens: maxTokens, stream: false },
    estimatedTokens: Math.ceil(contentCharacters / 4) + maxTokens,
  };
}

function validateModelList(payload) {
  if (!payload || payload.object !== 'list' || !Array.isArray(payload.data) || payload.data.length > 100) {
    throw new HttpError(502, 'invalid_upstream_response', 'AI gateway returned an invalid model list');
  }
  const data = payload.data.map((model) => {
    if (!model || typeof model.id !== 'string' || model.id.length > 200) {
      throw new HttpError(502, 'invalid_upstream_response', 'AI gateway returned an invalid model list');
    }
    return { id: model.id, object: 'model', owned_by: 'eclipse-ai-hub' };
  });
  return { object: 'list', data };
}

async function upstreamFetch(config, path, init, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetchImpl(`${config.aiGatewayBaseUrl}${path}`, {
      ...init,
      redirect: 'error',
      signal: controller.signal,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${config.aiGatewayServiceToken}`,
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new HttpError(504, 'upstream_timeout', 'AI gateway timed out');
    throw new HttpError(502, 'upstream_unavailable', 'AI gateway is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export async function createDndBffServer(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console;
  const verifier = options.verifier ?? new JwksVerifier({
    jwksUrl: config.chatJwksUrl,
    issuer: config.chatIssuer,
    audience: config.chatAudience,
    fetchImpl,
    timeoutMs: Math.min(config.timeoutMs, 10_000),
  });
  const budgets = options.budgets ?? await AtomicBudgetStore.create(config);
  const sessions = new Map();
  const usedIdentityJtis = new Map();
  const exchangeLimiter = new KeyedFixedWindowLimiter(30, 5 * 60_000);
  const MAX_SESSIONS = 100_000;

  function clearExpired(now = Date.now()) {
    for (const [hash, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(hash);
    }
    for (const [jti, expiresAt] of usedIdentityJtis) {
      if (expiresAt * 1000 <= now) usedIdentityJtis.delete(jti);
    }
  }

  function sessionFor(request) {
    clearExpired();
    const raw = parseCookies(request.headers.cookie).get(config.cookieName);
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
    return sessions.get(tokenHash(raw)) || null;
  }

  function requireSession(request) {
    const session = sessionFor(request);
    if (!session) throw new HttpError(401, 'authentication_required', 'Войдите через Eclipse Chat');
    return session;
  }

  function requireCsrf(request, session) {
    const supplied = request.headers['x-csrf-token'];
    if (!safeEqual(supplied, session.csrfToken)) {
      throw new HttpError(403, 'csrf_rejected', 'Защитный токен устарел. Обновите страницу.');
    }
  }

  const server = createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    let origin;
    try {
      const url = new URL(request.url || '/', 'http://dnd-bff.local');
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { ok: true, service: 'eclipse-dnd-bff', aiEnabled: config.aiEnabled }, requestId, null);
        return;
      }

      const requestOrigin = request.headers.origin;
      if (requestOrigin !== config.publicOrigin) {
        throw new HttpError(403, 'origin_rejected', 'Request origin is not allowed');
      }
      origin = config.publicOrigin;
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': config.publicOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        });
        response.end();
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/auth/exchange') {
        if (!exchangeLimiter.consume(clientAddress(request))) {
          throw new HttpError(429, 'exchange_rate_limited', 'Слишком много попыток входа. Попробуйте позже.', { 'Retry-After': '300' });
        }
        const body = await readJson(request, 16_384);
        if (!exactFields(body, ['code', 'codeVerifier']) ||
          typeof body.code !== 'string' ||
          typeof body.codeVerifier !== 'string') {
          throw new HttpError(400, 'invalid_request', 'Authorization code and PKCE verifier are required');
        }
        let tokenResponse;
        const identityController = new AbortController();
        const identityTimer = setTimeout(
          () => identityController.abort(),
          Math.min(config.timeoutMs, 10_000),
        );
        try {
          tokenResponse = await fetchImpl(config.chatTokenUrl, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: identityController.signal,
            body: JSON.stringify({
              grantType: 'authorization_code',
              clientId: config.clientId,
              redirectUri: config.redirectUri,
              code: body.code,
              codeVerifier: body.codeVerifier,
            }),
          });
        } catch {
          throw new HttpError(502, 'identity_provider_unavailable', 'Eclipse Chat identity is unavailable');
        } finally {
          clearTimeout(identityTimer);
        }
        if (!tokenResponse.ok) {
          await tokenResponse.body?.cancel();
          throw new HttpError(401, 'identity_exchange_failed', 'Ссылка входа недействительна или уже использована');
        }
        const tokenPayload = await readResponseJson(tokenResponse, 65_536);
        const identity = await verifier.verify(tokenPayload?.access_token);
        clearExpired();
        if (usedIdentityJtis.has(identity.jti)) {
          throw new HttpError(401, 'identity_replayed', 'Ссылка входа уже использована');
        }
        usedIdentityJtis.set(identity.jti, identity.expiresAt);

        clearExpired();
        if (sessions.size >= MAX_SESSIONS) {
          throw new HttpError(503, 'session_capacity_exhausted', 'Новые сессии временно недоступны');
        }

        const rawSession = randomBytes(32).toString('base64url');
        const csrfToken = randomBytes(32).toString('base64url');
        const expiresAt = Date.now() + config.sessionTtlSeconds * 1000;
        sessions.set(tokenHash(rawSession), {
          subject: identity.subject,
          displayName: identity.displayName,
          csrfToken,
          expiresAt,
        });
        const cookie = `${config.cookieName}=${rawSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionTtlSeconds}${config.secureCookie ? '; Secure' : ''}`;
        logger.info({ event: 'dnd_session_started', requestId, subject: identity.subject });
        sendJson(response, 200, {
          authenticated: true,
          csrfToken,
          user: { displayName: identity.displayName },
        }, requestId, origin, { 'Set-Cookie': cookie });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/v1/auth/session') {
        const session = sessionFor(request);
        sendJson(response, 200, session ? {
          authenticated: true,
          csrfToken: session.csrfToken,
          user: { displayName: session.displayName },
        } : { authenticated: false }, requestId, origin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
        const session = requireSession(request);
        requireCsrf(request, session);
        const raw = parseCookies(request.headers.cookie).get(config.cookieName);
        if (raw) sessions.delete(tokenHash(raw));
        const cookie = `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secureCookie ? '; Secure' : ''}`;
        sendJson(response, 200, { ok: true }, requestId, origin, { 'Set-Cookie': cookie });
        return;
      }

      const session = requireSession(request);
      if (!config.aiEnabled) throw new HttpError(503, 'ai_disabled', 'AI временно отключён оператором');

      if (request.method === 'GET' && url.pathname === '/api/v1/ai/models') {
        const upstream = await upstreamFetch(config, '/v1/models', {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Request-Id': requestId },
        }, fetchImpl);
        if (!upstream.ok) {
          await upstream.body?.cancel();
          throw new HttpError(upstream.status === 429 ? 429 : 502, 'upstream_rejected', 'AI gateway rejected the request');
        }
        const models = validateModelList(await readResponseJson(upstream, 262_144));
        sendJson(response, 200, models, requestId, origin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/ai/chat/completions') {
        requireCsrf(request, session);
        const requestBody = await readJson(request, config.maxBodyBytes);
        const completion = validateCompletion(requestBody, config);
        let reservation;
        try {
          reservation = await budgets.reserve(session.subject, completion.estimatedTokens);
        } catch (error) {
          if (error instanceof BudgetExceededError) {
            const retrySeconds = Math.max(1, Math.ceil((error.retryAt - Date.now()) / 1000));
            throw new HttpError(429, error.code, error.message, { 'Retry-After': String(retrySeconds) });
          }
          throw new HttpError(503, 'budget_store_unavailable', 'AI budget storage is unavailable');
        }
        const upstream = await upstreamFetch(config, '/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Request-Id': requestId,
            'X-Eclipse-Client': 'eclipse-dnd-forge',
          },
          body: JSON.stringify(completion.body),
        }, fetchImpl);
        if (!upstream.ok) {
          await upstream.body?.cancel();
          const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 400;
          throw new HttpError(status, 'upstream_rejected', 'AI gateway rejected the request');
        }
        const payload = await readResponseJson(upstream);
        if (!Array.isArray(payload?.choices) || payload.choices.length < 1) {
          throw new HttpError(502, 'invalid_upstream_response', 'AI gateway returned no completion');
        }
        const actualTokens = payload.usage?.total_tokens;
        if (Number.isSafeInteger(actualTokens) && actualTokens >= 0) {
          await budgets.reconcile(reservation, actualTokens).catch(() => undefined);
        }
        logger.info({
          event: 'dnd_ai_completion',
          requestId,
          subject: session.subject,
          model: completion.body.model,
          status: 200,
          latencyMs: Date.now() - startedAt,
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
        });
        sendJson(response, 200, payload, requestId, origin);
        return;
      }

      throw new HttpError(404, 'not_found', 'Route not found');
    } catch (error) {
      if (error instanceof IdentityValidationError) {
        sendError(response, new HttpError(401, error.code, 'Eclipse Chat identity token is invalid'), requestId, origin);
        return;
      }
      if (!(error instanceof HttpError)) {
        logger.error({ event: 'dnd_bff_failed', requestId, error: error instanceof Error ? error.name : 'unknown' });
      }
      sendError(response, error, requestId, origin);
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 75_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  return server;
}
