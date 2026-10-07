// Run with `npm test` (builds first: it tests the compiled module that n8n loads).
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { verifySignature } = createRequire(import.meta.url)(
	'../dist/nodes/WorkAdventureTrigger/signature.js',
);

const secret = `whsec_${randomBytes(24).toString('base64')}`;
const now = 1_790_000_000;
const id = '7f2c9b8e-4d1a-4c2e-9f3b-0a1b2c3d4e5f';
// Unescaped slashes and non-ASCII, as WorkAdventure sends them: re-serializing would change the bytes.
const body = Buffer.from(
	'{"type":"ping","world":{"url":"https://play.workadventu.re/@/a/b/"},"name":"Zoé"}',
);

function sign(key, timestamp, payload) {
	const raw = Buffer.from(key.slice('whsec_'.length), 'base64');
	return `v1,${createHmac('sha256', raw).update(`${id}.${timestamp}.${payload}`).digest('base64')}`;
}

const headers = (signature, timestamp = String(now)) => ({ id, timestamp, signature });

test('verifySignature', () => {
	const valid = sign(secret, now, body);
	assert.equal(verifySignature(secret, headers(valid), body, now), true, 'valid');

	const tampered = Buffer.from(body.toString().replace('ping', 'pong'));
	assert.equal(verifySignature(secret, headers(valid), tampered, now), false, 'tampered body');

	const otherSecret = `whsec_${randomBytes(24).toString('base64')}`;
	assert.equal(verifySignature(otherSecret, headers(valid), body, now), false, 'wrong secret');

	const stale = now - 301;
	assert.equal(
		verifySignature(secret, headers(sign(secret, stale, body), String(stale)), body, now),
		false,
		'stale timestamp',
	);

	const several = `v1,${randomBytes(32).toString('base64')} ${valid}`;
	assert.equal(verifySignature(secret, headers(several), body, now), true, 'several signatures');

	assert.equal(verifySignature(secret, headers(undefined), body, now), false, 'missing header');
});
