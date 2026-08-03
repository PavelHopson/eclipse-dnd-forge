import assert from 'node:assert/strict';
import test from 'node:test';
import { createDndBffServer } from '../src/server.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

function testConfig() {
  return {
    publicOrigin: 'https://dnd.example.test',
    secureCookie: true,
    cookieName: '__Host-eclipse_dnd_session',
    sessionTtlSeconds: 3600,
    chatTokenUrl: 'https://chat.example.test/token',
    chatJwksUrl: 'https://chat.example.test/jwks',
    chatIssuer: 'https://chat.example.test',
    chatAudience: 'eclipse-dnd-forge',
    clientId: 'eclipse-dnd-forge',
    redirectUri: 'https://dnd.example.test/',
    aiGatewayBaseUrl: 'https://ai.example.test',
    aiGatewayServiceToken: 's'.repeat(48),
    timeoutMs: 10_000,
    maxBodyBytes: 262_144,
    maxOutputTokens: 2_048,
    userRequestsPer15Minutes: 60,
    userDailyTokens: 250_000,
    productDailyTokens: 5_000_000,
    aiEnabled: true,
    budgetFile: undefined,
  };
}

test('exchanges PKCE for an HttpOnly session and keeps the AI service token server-side', async () => {
  const calls = [];
  const logs = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url === 'https://chat.example.test/token') {
      return new Response(JSON.stringify({ access_token: 'signed-identity-token' }), { status: 200 });
    }
    if (url === 'https://ai.example.test/v1/models') {
      return new Response(JSON.stringify({ object: 'list', data: [{ id: 'auto/best-chat' }] }), { status: 200 });
    }
    if (url === 'https://ai.example.test/v1/chat/completions') {
      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Safe answer' } }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  const verifier = {
    verify: async () => ({
      subject: 'user-123', displayName: 'Pavel', expiresAt: Math.floor(Date.now() / 1000) + 300, jti: '11111111-1111-4111-8111-111111111111',
    }),
  };
  const server = await createDndBffServer(testConfig(), {
    fetchImpl,
    verifier,
    logger: { info: (entry) => logs.push(entry), error: (entry) => logs.push(entry) },
  });
  const baseUrl = await listen(server);
  try {
    const rejectedOrigin = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(rejectedOrigin.status, 403);
    assert.equal(rejectedOrigin.headers.get('access-control-allow-origin'), null);

    const spoofedExchange = await fetch(`${baseUrl}/api/v1/auth/exchange`, {
      method: 'POST',
      headers: { Origin: 'https://dnd.example.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'c'.repeat(43),
        codeVerifier: 'v'.repeat(64),
        subject: 'another-user',
      }),
    });
    assert.equal(spoofedExchange.status, 400);
    assert.equal(calls.length, 0, 'identity must not be accepted from a client-controlled field');

    const exchange = await fetch(`${baseUrl}/api/v1/auth/exchange`, {
      method: 'POST',
      headers: { Origin: 'https://dnd.example.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'c'.repeat(43), codeVerifier: 'v'.repeat(64) }),
    });
    assert.equal(exchange.status, 200);
    const cookie = exchange.headers.get('set-cookie');
    assert.match(cookie, /__Host-eclipse_dnd_session=.*HttpOnly; SameSite=Lax;.*Secure/);
    const session = await exchange.json();
    assert.equal(session.user.displayName, 'Pavel');
    assert.match(session.csrfToken, /^[A-Za-z0-9_-]{43}$/);

    const models = await fetch(`${baseUrl}/api/v1/ai/models`, {
      headers: { Origin: 'https://dnd.example.test', Cookie: cookie.split(';')[0] },
    });
    assert.equal(models.status, 200);

    const noCsrf = await fetch(`${baseUrl}/api/v1/ai/chat/completions`, {
      method: 'POST',
      headers: { Origin: 'https://dnd.example.test', Cookie: cookie.split(';')[0], 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'auto/best-chat', messages: [{ role: 'user', content: 'PRIVATE PROMPT' }] }),
    });
    assert.equal(noCsrf.status, 403);

    const spoofedCompletion = await fetch(`${baseUrl}/api/v1/ai/chat/completions`, {
      method: 'POST',
      headers: {
        Origin: 'https://dnd.example.test', Cookie: cookie.split(';')[0],
        'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({
        model: 'auto/best-chat',
        messages: [{ role: 'user', content: 'PRIVATE PROMPT' }],
        userId: 'another-user',
      }),
    });
    assert.equal(spoofedCompletion.status, 400);
    assert.equal(
      calls.filter((call) => call.url === 'https://ai.example.test/v1/chat/completions').length,
      0,
      'BFF must derive the budget subject from the server-side session',
    );

    const completion = await fetch(`${baseUrl}/api/v1/ai/chat/completions`, {
      method: 'POST',
      headers: {
        Origin: 'https://dnd.example.test', Cookie: cookie.split(';')[0],
        'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({ model: 'auto/best-chat', messages: [{ role: 'user', content: 'PRIVATE PROMPT' }] }),
    });
    assert.equal(completion.status, 200);
    assert.equal((await completion.json()).choices[0].message.content, 'Safe answer');

    const aiCalls = calls.filter((call) => call.url.startsWith('https://ai.example.test'));
    assert.ok(aiCalls.every((call) => call.init.headers.Authorization === `Bearer ${'s'.repeat(48)}`));
    assert.doesNotMatch(JSON.stringify(logs), /PRIVATE PROMPT|Safe answer|ssssssss/);
  } finally {
    await close(server);
  }
});
