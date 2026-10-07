import type { INodeProperties } from 'n8n-workflow';

// "admin, speaker" -> ["admin", "speaker"]. PATCH only accepts an array.
const tagsToArray = '={{ $value.split(",").map((tag) => tag.trim()).filter((tag) => tag !== "") }}';

const firstName: INodeProperties = {
	displayName: 'First Name',
	name: 'firstName',
	type: 'string',
	default: '',
	description: 'First name of the member',
	routing: { send: { type: 'body', property: 'firstName' } },
};

const lastName: INodeProperties = {
	displayName: 'Last Name',
	name: 'lastName',
	type: 'string',
	default: '',
	description: 'Last name of the member',
	routing: { send: { type: 'body', property: 'lastName' } },
};

const phone: INodeProperties = {
	displayName: 'Phone Number',
	name: 'phone',
	type: 'string',
	default: '',
	description: 'Phone number of the member',
	routing: { send: { type: 'body', property: 'phone' } },
};

const jobTitle: INodeProperties = {
	displayName: 'Job Title',
	name: 'function',
	type: 'string',
	default: '',
	description: 'Position of the member in the company',
	routing: { send: { type: 'body', property: 'function' } },
};

const information: INodeProperties = {
	displayName: 'Information',
	name: 'information',
	type: 'string',
	typeOptions: { rows: 4 },
	default: '',
	description: "Additional information displayed on the member's business card",
	routing: { send: { type: 'body', property: 'information' } },
};

const trivia: INodeProperties = {
	displayName: 'Trivia',
	name: 'trivia',
	type: 'string',
	default: '',
	placeholder: 'I love WorkAdventure',
	description: 'A fun fact about the member',
	routing: { send: { type: 'body', property: 'trivia' } },
};

const address: INodeProperties = {
	displayName: 'Address',
	name: 'address',
	type: 'string',
	default: '',
	description: 'Address of the member, in any format',
	routing: { send: { type: 'body', property: 'address' } },
};

const memberIdentifier: INodeProperties = {
	displayName: 'Member UUID or Email',
	name: 'memberIdentifier',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'jane.doe@example.com',
	description:
		"UUID or email of the member, e.g. '05f932de-e444-4a13-8f04-61a69a90dba6' or 'jane.doe@example.com'",
	displayOptions: { show: { resource: ['member'], operation: ['delete', 'get', 'update'] } },
};

export const memberOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['member'] } },
		options: [
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a member',
				routing: { request: { method: 'POST', url: '/members' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a member (or visitor) of your world',
				action: 'Delete a member',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/members/{{encodeURIComponent($parameter.memberIdentifier)}}',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a member (or visitor) of your world by UUID or email',
				action: 'Get a member',
				routing: {
					request: {
						method: 'GET',
						url: '=/members/{{encodeURIComponent($parameter.memberIdentifier)}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the members (and/or visitors) of your world',
				action: 'Get many members',
				routing: {
					request: { method: 'GET', url: '/members' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a member of your world. Fields left empty are not changed.',
				action: 'Update a member',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/members/{{encodeURIComponent($parameter.memberIdentifier)}}',
					},
				},
			},
		],
		default: 'upsert',
	},
];

export const memberFields: INodeProperties[] = [
	memberIdentifier,

	// Create or Update
	{
		displayName: 'Full Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Full name of the member, displayed in WorkAdventure',
		displayOptions: { show: { resource: ['member'], operation: ['upsert'] } },
		routing: { send: { type: 'body', property: 'name' } },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description:
			'Email of the member. If a member with this email already exists, it is overwritten: fields left empty are cleared and tags are replaced. Use "Update" to change only some fields.',
		displayOptions: { show: { resource: ['member'], operation: ['upsert'] } },
		routing: { send: { type: 'body', property: 'email' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'Fields left out are cleared when the member already exists',
		displayOptions: { show: { resource: ['member'], operation: ['upsert'] } },
		options: [
			{
				displayName: 'Access Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					"Secret used in the member's private access links. Must be unique. If empty, a new member gets a generated one and an existing member keeps theirs.",
				routing: { send: { type: 'body', property: 'token' } },
			},
			address,
			firstName,
			information,
			jobTitle,
			lastName,
			phone,
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'admin, speaker',
				description:
					'Comma-separated tags. Tags decide what the member can access: see <a href="https://docs.workadventu.re/admin/members/">the documentation</a>. They replace the existing tags of the member.',
				routing: { send: { type: 'body', property: 'tags', value: tagsToArray } },
			},
			trivia,
		],
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['member'], operation: ['update'] } },
		options: [
			{
				displayName: 'Access Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					"New secret for the member's private access links. Must be unique. Changing it invalidates the member's current links.",
				routing: { send: { type: 'body', property: 'token' } },
			},
			address,
			firstName,
			{
				displayName: 'Full Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Full name of the member, displayed in WorkAdventure',
				routing: { send: { type: 'body', property: 'name' } },
			},
			information,
			jobTitle,
			lastName,
			phone,
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'admin, speaker',
				description:
					'Comma-separated tags. Tags decide what the member can access: see <a href="https://docs.workadventu.re/admin/members/">the documentation</a>. They replace the existing tags of the member. To remove all tags, enter "member".',
				routing: { send: { type: 'body', property: 'tags', value: tagsToArray } },
			},
			trivia,
		],
	},

	// Get Many
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{ name: 'Members', value: 'members' },
			{ name: 'Members and Visitors', value: 'all' },
			{ name: 'Visitors', value: 'visitors' },
		],
		default: 'members',
		description:
			'Visitors are people who registered themselves: see <a href="https://docs.workadventu.re/admin/visitors/">the documentation</a>',
		displayOptions: { show: { resource: ['member'], operation: ['getAll'] } },
		routing: { send: { type: 'query', property: 'type' } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['member'], operation: ['getAll'] } },
		routing: {
			send: { paginate: '={{ $value }}' },
			operations: {
				pagination: {
					type: 'offset',
					properties: {
						limitParameter: 'limit',
						offsetParameter: 'offset',
						pageSize: 100,
						type: 'query',
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['member'], operation: ['getAll'], returnAll: [false] } },
		routing: {
			send: { type: 'query', property: 'limit' },
			output: { maxResults: '={{$value}}' },
		},
	},
];
