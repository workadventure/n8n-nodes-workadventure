import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class WorkAdventureApi implements ICredentialType {
	name = 'workAdventureApi';

	displayName = 'WorkAdventure API';

	icon: Icon = {
		light: 'file:../icons/workadventure.svg',
		dark: 'file:../icons/workadventure.dark.svg',
	};

	documentationUrl =
		'https://github.com/workadventure/n8n-nodes-workadventure?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Admin URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://admin.workadventu.re',
			required: true,
			description:
				'URL of your WorkAdventure admin. Keep the default unless your WorkAdventure is self-hosted.',
		},
		{
			displayName: 'World Slug',
			name: 'worldSlug',
			type: 'string',
			default: '',
			required: true,
			description:
				'Find it in the <a href="https://admin.workadventu.re/_/api-settings">WorkAdventure admin</a>, under Developers > API keys / Zapier',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one in the <a href="https://admin.workadventu.re/_/api-settings">WorkAdventure admin</a>, under Developers > API keys / Zapier',
		},
	];

	// The Inbound API takes the raw token, without "Bearer".
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '=/api/v1/worlds/{{encodeURIComponent($credentials.worldSlug)}}',
		},
	};
}
