import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type IHttpRequestMethods,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';
import { verifySignature } from './signature';

interface ApiResponse {
	statusCode: number;
	body: IDataObject;
}

/** Calls the WorkAdventure webhook-management API. HTTP errors are returned, not thrown. */
async function webhooksApi(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	path = '',
	body?: IDataObject,
): Promise<ApiResponse> {
	const credentials = await this.getCredentials('workAdventureApi');
	const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');
	const worldSlug = encodeURIComponent(String(credentials.worldSlug));
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'workAdventureApi',
		{
			method,
			url: `${baseUrl}/api/v1/worlds/${worldSlug}/webhooks${path}`,
			headers: { Accept: 'application/json' },
			body,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		},
	)) as { statusCode: number; body: unknown };
	const responseBody =
		typeof response.body === 'object' && response.body !== null
			? (response.body as IDataObject)
			: { message: String(response.body ?? '') };
	return { statusCode: response.statusCode, body: responseBody };
}

function assertOk(this: IHookFunctions, { statusCode, body }: ApiResponse): void {
	if (statusCode < 400) return;
	// Validation errors are {"errors": {"url": ["…"], "events": ["…"]}}: show them as they are.
	const errors = body.errors as Record<string, string[]> | undefined;
	const message = errors
		? Object.values(errors).flat().join(' ')
		: typeof body.message === 'string'
			? body.message
			: undefined;
	throw new NodeApiError(this.getNode(), body as JsonObject, {
		httpCode: String(statusCode),
		message,
	});
}

/** Deletes an endpoint in WorkAdventure. An endpoint that is already gone counts as deleted. */
async function deleteEndpoint(this: IHookFunctions, id: unknown): Promise<void> {
	const response = await webhooksApi.call(this, 'DELETE', `/${encodeURIComponent(String(id))}`);
	if (response.statusCode !== 404) assertOk.call(this, response);
}

function forgetEndpoint(staticData: IDataObject): void {
	delete staticData.webhookId;
	delete staticData.webhookSecret;
}

function sameEvents(actual: unknown, expected: string[]): boolean {
	return (
		Array.isArray(actual) &&
		actual.length === expected.length &&
		expected.every((event) => actual.includes(event))
	);
}

function header(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value.join(' ') : value;
}

export class WorkAdventureTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WorkAdventure Trigger',
		name: 'workAdventureTrigger',
		icon: {
			light: 'file:../../icons/workadventure.svg',
			dark: 'file:../../icons/workadventure.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when events happen in a WorkAdventure world',
		defaults: {
			name: 'WorkAdventure Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'workAdventureApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: '={{$parameter["responseMode"]}}',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				description: 'The events to receive. Each delivery is one event, routed on its "type".',
				options: [
					{
						name: 'Analytics (Experimental)',
						value: 'analytics',
						description:
							'Every analytics event of the world, batched as analytics.batch (up to 100 per delivery). High volume, and event names and properties may still change.',
					},
					{
						name: 'Consent Changed',
						value: 'consent',
						description:
							'Someone gave, refused or withdrew their consent for a purpose (consent.changed)',
					},
					{
						name: 'Member Connecting',
						value: 'auth',
						description:
							"A member is logging in (member.connecting). Sent synchronously: access waits up to 5 seconds. Carries the member's OAuth access tokens.",
					},
					{
						name: 'Recording Completed',
						value: 'recording',
						description: 'A meeting recording is ready to download (recording.completed)',
					},
					{
						name: 'Visitor Registered',
						value: 'visitor',
						description: 'A visitor account became usable (visitor.registered)',
					},
				],
			},
			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				default: 'onReceived',
				description: 'When to answer WorkAdventure',
				options: [
					{
						name: 'Immediately',
						value: 'onReceived',
						description: 'As soon as the event is received',
					},
					{
						name: 'When Last Node Finishes',
						value: 'lastNode',
						description:
							"After the workflow ends. With Member Connecting, the workflow can update the member's tags with the WorkAdventure node before access is granted. WorkAdventure waits 5 seconds at most.",
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId === undefined) return false;

				const response = await webhooksApi.call(this, 'GET', `/${staticData.webhookId}`);
				if (response.statusCode !== 404) {
					assertOk.call(this, response);
					const { url, events, enabled } = response.body;
					const upToDate =
						url === this.getNodeWebhookUrl('default') &&
						enabled === true &&
						sameEvents(events, this.getNodeParameter('events') as string[]);
					if (upToDate) return true;
					// Outdated, or disabled by WorkAdventure after repeated failures: start afresh.
					await deleteEndpoint.call(this, staticData.webhookId);
				}
				forgetEndpoint(staticData);
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];

				// An endpoint left behind for this URL (n8n stopped while listening, lost static data)
				// would keep sending events signed with a secret we no longer have.
				const existing = await webhooksApi.call(this, 'GET');
				assertOk.call(this, existing);
				for (const endpoint of (existing.body.data as IDataObject[] | undefined) ?? []) {
					if (endpoint.url === url) await deleteEndpoint.call(this, endpoint.id);
				}

				const response = await webhooksApi.call(this, 'POST', '', { url, events });
				assertOk.call(this, response);
				if (response.body.id === undefined || typeof response.body.secret !== 'string') {
					throw new NodeApiError(this.getNode(), response.body as JsonObject, {
						message: 'WorkAdventure did not return the id and secret of the new webhook',
					});
				}
				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookId = response.body.id;
				staticData.webhookSecret = response.body.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId !== undefined) {
					await deleteEndpoint.call(this, staticData.webhookId);
				}
				forgetEndpoint(staticData);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const headers = this.getHeaderData();
		const secret = this.getWorkflowStaticData('node').webhookSecret;

		// n8n keeps the bytes it received in rawBody: the signature covers them, not re-serialized JSON.
		if (!request.rawBody) await request.readRawBody();
		const authentic =
			typeof secret === 'string' &&
			verifySignature(
				secret,
				{
					id: header(headers['webhook-id']),
					timestamp: header(headers['webhook-timestamp']),
					signature: header(headers['webhook-signature']),
				},
				request.rawBody,
			);
		if (!authentic) {
			this.getResponseObject().status(401).json({ message: 'Invalid webhook signature' });
			return { noWebhookResponse: true };
		}

		const event = this.getBodyData();
		// Deliveries from the admin's "Test" button only run "Listen for test event" executions.
		if (event.test === true && this.getMode() !== 'manual') {
			return { webhookResponse: { message: 'Test delivery ignored by the active workflow' } };
		}
		return { workflowData: [this.helpers.returnJsonArray(event)] };
	}
}
