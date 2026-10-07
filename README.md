# @workadventure/n8n-nodes-workadventure

This is an n8n community node package. It lets you use [WorkAdventure](https://workadventu.re) in your n8n workflows.

WorkAdventure is a virtual office and collaboration platform for remote and hybrid teams. This package manages the
members of your world through the [Inbound API](https://docs.workadventu.re/developer/inbound-api) and starts
workflows from [WorkAdventure webhooks](https://docs.workadventu.re/developer/hook-api).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Trigger](#trigger)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community
nodes documentation and install `@workadventure/n8n-nodes-workadventure`.

## Credentials

The Inbound API and webhooks need a **premium** world: requests for other worlds are refused (403).

1. In the WorkAdventure admin, open your world and go to _Developers > API keys / Zapier_.
2. Create an API token and copy it, along with the world slug shown on that page.
3. In n8n, create a **WorkAdventure API** credential:
   - **Admin URL**: keep `https://admin.workadventu.re` unless your WorkAdventure is self-hosted.
   - **World Slug**: the slug of your world (the last part of its URL: `bar` in `https://play.workadventu.re/@/foo/bar`).
   - **API Token**: the token you created.

n8n checks the credential with `GET /api/v1/worlds/{worldSlug}`.

## Operations

All operations work on the **Member** resource.

| Operation        | What it does                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create or Update | Creates a member. If a member with this email already exists, it is overwritten: fields left empty are cleared and tags are replaced. Use _Update_ to change only some fields. |
| Update           | Updates a member, found by UUID or email. Fields left empty are not changed.                                                                                                   |
| Delete           | Deletes a member (or visitor).                                                                                                                                                 |
| Get              | Gets a member (or visitor) by UUID or email.                                                                                                                                   |
| Get Many         | Lists members, visitors, or both. Turn on _Return All_ to page through all of them, or set a _Limit_ (100 at most).                                                            |

Notes:

- **Tags** are comma-separated, e.g. `admin, speaker`. They decide what the member can access (see
  [the documentation](https://docs.workadventu.re/admin/members/)) and **replace** the existing tags of the member.
  With _Update_, enter `member` to remove all tags.
- **Access Token** is the secret used in the member's private access links. It must be unique. On _Create or Update_,
  leave it empty and a new member gets a generated one while an existing member keeps theirs. Changing it invalidates
  the member's current links.
- Visitors (self-registered accounts) can be read and deleted, not created or updated. The `type` field of a member
  (`member` or `visitor`) tells them apart.

## Trigger

**WorkAdventure Trigger** starts a workflow when events happen in your world. Pick the events:

| Event                    | Delivery `type`       | Notes                                   |
| ------------------------ | --------------------- | --------------------------------------- |
| Recording Completed      | `recording.completed` | `data.downloadUrl` is valid for 7 days. |
| Visitor Registered       | `visitor.registered`  |                                         |
| Consent Changed          | `consent.changed`     |                                         |
| Member Connecting        | `member.connecting`   | Synchronous, see below.                 |
| Analytics (Experimental) | `analytics.batch`     | High volume, see below.                 |

Each execution receives one delivery: the WorkAdventure envelope (`deliveryId`, `apiVersion`, `type`, `timestamp`,
`world`, `data`). Retries reuse the same `deliveryId`: deduplicate on it if a duplicate would hurt. The
[webhook documentation](https://docs.workadventu.re/developer/hook-api) describes every payload.

### Registration

You do not need to configure anything in the WorkAdventure admin. When you activate the workflow, or click
_Listen for test event_, the node registers its URL in WorkAdventure through the API, and removes it when the workflow
is deactivated or the test ends. The endpoint shows up in _Developers > Webhook settings_ while it exists. If
WorkAdventure disabled the endpoint (after repeated failed deliveries, for instance while n8n was down), re-enable it
on its page in the admin, or deactivate and reactivate the workflow. Restarting n8n is not enough: n8n keeps the
registrations of active workflows across restarts without asking WorkAdventure again.

WorkAdventure only delivers to public HTTPS URLs: your n8n instance must be reachable from the internet over HTTPS.

### Signature check

Every delivery is signed ([Standard Webhooks](https://www.standardwebhooks.com/)) with a secret WorkAdventure returns
when the node registers its URL. The node checks the signature over the raw request body and refuses deliveries whose
timestamp is more than 5 minutes off. Anything that fails the check is answered `401` and does not start the
workflow.

### Test deliveries

The _Test_ button on the endpoint page in the WorkAdventure admin sends a sample marked `"test": true`. The node lets
these through while you _Listen for test event_ in the editor, and ignores them (answering `200`, without starting an
execution) in an active workflow.

### Member Connecting (`auth`)

This event is sent **synchronously** while a member logs in: WorkAdventure waits up to 5 seconds for the answer
before granting access, and never blocks access when the call fails or times out. Set **Respond** to
**When Last Node Finishes** to update the member (their tags, typically) with the WorkAdventure node _before_ access
is granted. Keep that workflow short.

The payload carries `data.accessTokens`: the OAuth access tokens of the member, for the OpenID Connect providers you
set to expose them. Treat them as secrets, and do not keep execution data you do not need (see the workflow's
_Save successful production executions_ setting).

### Analytics (`analytics`)

Experimental: event names and properties may change without notice. A busy world sends a lot of events (one
video-quality sample every 5 seconds per user in a meeting), batched up to 100 per delivery in `data.events`.
Expect many executions.

## Compatibility

Built and tested with n8n 2.42 (`n8n-workflow` 2.42) and `@n8n/node-cli` 0.51.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [WorkAdventure Inbound API](https://docs.workadventu.re/developer/inbound-api)
- [WorkAdventure webhooks](https://docs.workadventu.re/developer/hook-api)

## License

[MIT](LICENSE.md)
