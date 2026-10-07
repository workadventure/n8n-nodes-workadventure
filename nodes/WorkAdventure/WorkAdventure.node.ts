import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { memberFields, memberOperations } from './MemberDescription';

export class WorkAdventure implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WorkAdventure',
		name: 'workAdventure',
		icon: {
			light: 'file:../../icons/workadventure.svg',
			dark: 'file:../../icons/workadventure.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage the members of a WorkAdventure world',
		defaults: {
			name: 'WorkAdventure',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'workAdventureApi', required: true }],
		requestDefaults: {
			baseURL:
				'={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1/worlds/{{encodeURIComponent($credentials.worldSlug)}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Member', value: 'member' }],
				default: 'member',
			},
			...memberOperations,
			...memberFields,
		],
	};
}
