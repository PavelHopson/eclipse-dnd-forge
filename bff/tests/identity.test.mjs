import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import test from 'node:test';
import { JwksVerifier } from '../src/identity.mjs';

function jwt(privateKey, kid, claims, header = { alg: 'EdDSA', kid, typ: 'JWT' }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const input = `${encodedHeader}.${encodedPayload}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString('base64url')}`;
}

test('verifies a fixed EdDSA issuer, audience and bounded lifetime', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const kid = 'chat-key-v1';
  const exported = publicKey.export({ format: 'jwk' });
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [{
    kty: 'OKP', crv: 'Ed25519', x: exported.x, use: 'sig', alg: 'EdDSA', kid,
  }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const verifier = new JwksVerifier({
    jwksUrl: 'https://chat.example.test/jwks.json',
    issuer: 'https://chat.example.test',
    audience: 'eclipse-dnd-forge',
    fetchImpl,
  });
  const now = 1_800_000_000;
  const token = jwt(privateKey, kid, {
    iss: 'https://chat.example.test',
    aud: 'eclipse-dnd-forge',
    sub: 'user-123',
    name: 'Pavel',
    iat: now,
    exp: now + 300,
    jti: randomUUID(),
  });
  const identity = await verifier.verify(token, now);
  assert.equal(identity.subject, 'user-123');
  assert.equal(identity.displayName, 'Pavel');
});

test('rejects algorithm confusion, attacker supplied keys and cross-audience tokens', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const exported = publicKey.export({ format: 'jwk' });
  const verifier = new JwksVerifier({
    jwksUrl: 'https://chat.example.test/jwks.json',
    issuer: 'https://chat.example.test',
    audience: 'eclipse-dnd-forge',
    fetchImpl: async () => new Response(JSON.stringify({ keys: [{
      kty: 'OKP', crv: 'Ed25519', x: exported.x, use: 'sig', alg: 'EdDSA', kid: 'known',
    }] }), { status: 200 }),
  });
  const now = 1_800_000_000;
  const claims = {
    iss: 'https://chat.example.test', aud: 'eclipse-ai-hub', sub: 'user-1',
    iat: now, exp: now + 300, jti: randomUUID(),
  };
  await assert.rejects(
    verifier.verify(jwt(privateKey, 'known', claims, {
      alg: 'EdDSA', kid: 'known', typ: 'JWT', jwk: exported,
    }), now),
    /unsupported signing header/,
  );
  await assert.rejects(verifier.verify(jwt(privateKey, 'known', claims), now), /claims are invalid/);
});
