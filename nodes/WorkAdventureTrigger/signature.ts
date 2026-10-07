import { createHmac, timingSafeEqual } from 'crypto';

const SECRET_PREFIX = 'whsec_';
const TOLERANCE_SECONDS = 5 * 60;

export interface SignatureHeaders {
	id?: string;
	timestamp?: string;
	signature?: string;
}

/**
 * Checks a Standard Webhooks signature (https://www.standardwebhooks.com/), as sent by WorkAdventure.
 *
 * The signature is `v1,` + base64 HMAC-SHA256 of `<id>.<timestamp>.<raw body>`, keyed with the
 * base64-decoded secret after `whsec_`. The header may carry several space-separated signatures
 * (secret rotation): one valid match is enough. `rawBody` must be the bytes received, never
 * re-serialized JSON.
 */
export function verifySignature(
	secret: string,
	headers: SignatureHeaders,
	rawBody: Buffer,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
	const { id, timestamp, signature } = headers;
	if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
	if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

	const key = Buffer.from(
		secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret,
		'base64',
	);
	const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();

	return signature.split(' ').some((entry) => {
		const [version, value] = entry.split(',');
		if (version !== 'v1' || !value) return false;
		const given = Buffer.from(value, 'base64');
		return given.length === expected.length && timingSafeEqual(given, expected);
	});
}
