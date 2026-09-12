export type AgentGuide = {
  title: string;
  description: string;
  eyebrow: string;
  sections: { heading: string; body: string; items?: string[]; code?: string }[];
};

const availability = {
  heading: 'Before you connect',
  body: 'These guides describe the implemented workspace protocols. Customer access and live platform publishing remain subject to launch availability. Use the endpoint from your own PostDelegate workspace, not the public marketing website. Examples use a placeholder origin.',
};
const firstDraft = {
  heading: 'Start with one draft',
  body: 'Use list_accounts to discover the connected accounts your client can access. If the list is empty, connect a supported account in the web workspace first.',
  code: 'List the accounts I can access and their capabilities. Ask which one to use. Turn my brief into one draft using create_draft. Do not schedule or publish. Return the post ID so I can review it in PostDelegate.',
};
const reviewAndSchedule = {
  heading: 'Review, then schedule the same post',
  body: 'Complete required approval stages in the web workspace. Scheduling requires both create_posts and publish_directly. An approval requirement still applies when the actor has scheduling permission.',
  items: [
    'Use schedule_draft with the existing post_id and an ISO 8601 scheduled_at timestamp, including its timezone offset or Z for UTC.',
    'schedule_post creates a new scheduled post. Do not use it as a substitute for scheduling an existing draft.',
    'Use get_post to inspect per-channel results. Scheduled means queued, not published.',
    'If the social platform’s outcome is uncertain, review the account before making another publishing attempt.',
  ],
};

// Client references checked 12 September 2026. These describe supported client
// protocols, not a verified PostDelegate connector installation or certification:
// https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
// https://developers.openai.com/codex/mcp/
export const agentPages: Record<string, AgentGuide> = {
  mcp: {
    title: 'Connect through MCP',
    description: 'Give a compatible AI client access to PostDelegate drafts, media and scheduling tools.',
    eyebrow: 'MCP SETUP',
    sections: [
      availability,
      {
        heading: 'Use the workspace endpoint',
        body: 'PostDelegate exposes a Streamable HTTP MCP server. Copy its URL from Settings → API Keys. The MCP path has no trailing slash.',
        code: 'https://YOUR-WORKSPACE-HOST/api/v1/mcp',
      },
      {
        heading: 'Choose how the client authenticates',
        body: 'MCP accepts a scoped API-key bearer token or an OAuth authorization supported by your client. OAuth acts with the signed-in user’s current permissions; it is not automatically draft-only.',
        items: [
          'For an API key, select the intended workspace and connected-account allowlist.',
          'Begin with create_posts. Add upload_media or view_analytics only for workflows that need them.',
          'Leave publish_directly disabled for a draft-only API key. Keep credentials in client credential settings, not prompts or shared files.',
          'A client-side tool allowlist is an extra control; it does not replace workspace permissions.',
        ],
      },
      firstDraft,
      reviewAndSchedule,
      {
        heading: 'Attach media and recover carefully',
        body: 'Attach workspace MediaAsset IDs. For uploads, use upload_media for supported small payloads, or request_media_upload, upload bytes to the returned URL, then finalize_media_upload. Follow the returned size and validation requirements.',
        items: [
          'Do not use arbitrary media URLs where a media_asset_ids list is expected.',
          'MCP create_draft does not currently accept an idempotency_key. If its response is lost, check the web workspace before creating another draft.',
          'If you need retryable create requests with an idempotency key, use the documented REST create endpoint.',
          'Connecting MCP does not include an AI generation service or install a PostDelegate CLI.',
        ],
      },
    ],
  },
  api: {
    title: 'Build with the REST API',
    description: 'Create drafts, upload media and schedule reviewed posts using scoped bearer access.',
    eyebrow: 'REST API',
    sections: [
      availability,
      {
        heading: 'Check the reference and your access',
        body: 'The API reference is at /api/v1/docs on your workspace origin. REST requests use an API key in the Authorization header. GET /me/ reports the caller’s scope; GET /accounts/ lists permitted social accounts and their capabilities.',
        code: 'curl "https://YOUR-WORKSPACE-HOST/api/v1/me/" \\\n  -H "Authorization: Bearer $POSTDELEGATE_API_KEY"\n\ncurl "https://YOUR-WORKSPACE-HOST/api/v1/accounts/" \\\n  -H "Authorization: Bearer $POSTDELEGATE_API_KEY"',
      },
      {
        heading: 'Create a draft',
        body: 'Choose a social_account_id returned by /accounts/. Grant create_posts and send action: draft. Replace the example account ID and caption. Use a fresh idempotency key for each new logical post, then retain it for retries of that exact request.',
        code: 'curl -X POST "https://YOUR-WORKSPACE-HOST/api/v1/posts/" \\\n  -H "Authorization: Bearer $POSTDELEGATE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: YOUR-UNIQUE-REQUEST-ID" \\\n  --data \'{"social_account_id":"ACCOUNT-UUID","caption":"Draft for review","action":"draft"}\'',
      },
      {
        heading: 'Schedule the reviewed draft',
        body: 'Keep the returned post ID. After required review, an actor with create_posts and publish_directly can POST to /api/v1/posts/{post_id}/schedule with scheduled_at as an ISO 8601 timestamp. GET /api/v1/posts/{post_id} returns its current state. POST /api/v1/posts/{post_id}/cancel cancels a scheduled post back to draft.',
        code: '{"scheduled_at":"2030-01-15T09:30:00+04:00"}',
        items: ['Replace the sample time with your intended future publishing time.', 'The v1 API has no post-delete endpoint; manage draft deletion in the web workspace.'],
      },
      {
        heading: 'Handle errors without creating duplicates',
        body: 'REST POST /posts/ accepts Idempotency-Key or the idempotency_key JSON field. Reuse the same key and identical payload when retrying a lost creation response. That replay protection does not make every API operation idempotent.',
        items: [
          '401: check or reissue credentials. 403: check workspace membership, account allowlist and permissions.',
          '422: correct the input or workflow state; inspect the returned detail.',
          '409 for an identical creation in flight: wait before retrying with the same key.',
          '429: respect Retry-After. Do not assume rate-limit headers appear on every successful response.',
          'A social-platform publish timeout is different from a lost draft-creation response. Review uncertain publication before sending a new post.',
        ],
      },
    ],
  },
  'claude-cowork': {
    title: 'Use PostDelegate with Claude Cowork',
    description: 'Connect a remote MCP workspace, prepare a draft in Claude and review it in PostDelegate.',
    eyebrow: 'CLIENT GUIDE',
    sections: [
      availability,
      {
        heading: 'Add a remote connector',
        body: 'Claude’s official documentation describes custom remote MCP connectors for Claude and Cowork. Use the custom-connector flow available to your account and supply the workspace MCP URL. Team policies can affect whether you can add a connector. Exact screens and availability may change; this guide does not claim a tested PostDelegate listing or installation.',
        code: 'https://YOUR-WORKSPACE-HOST/api/v1/mcp',
      },
      {
        heading: 'Authorize the right workspace',
        body: 'When offered, complete PostDelegate OAuth in the browser and inspect the authorization before continuing. The connection uses the signed-in user’s permissions. A request to “only draft” is an instruction, not a replacement for a restricted account or grant.',
        items: [
          'Claude’s remote connector reaches the server from Anthropic infrastructure. A loopback URL on your laptop is not a reachable remote deployment.',
          'Do not paste API keys, social tokens or passwords into the task conversation.',
          'Confirm that the client can discover list_accounts and create_draft before requesting a write.',
        ],
      },
      firstDraft,
      reviewAndSchedule,
      {
        heading: 'If connection or creation fails',
        body: 'Check endpoint reachability, account authorization and discovered tools. If create_draft loses its response, inspect the workspace before repeating it. Do not invent an idempotency_key argument for this MCP tool. Content generation uses your Claude tools; PostDelegate supplies the publishing workspace.',
      },
    ],
  },
  codex: {
    title: 'Connect Codex. Plan your social posts.',
    description: 'Bring social drafts into your Codex workflow, then review and schedule them in PostDelegate.',
    eyebrow: 'CLIENT GUIDE',
    sections: [
      availability,
      {
        heading: 'Configure an HTTP MCP server',
        body: 'Add the server below to your Codex config.toml. Replace the workspace hostname and make POSTDELEGATE_API_KEY available securely to the process running Codex. Your organization may manage these settings for you.',
        code: '[mcp_servers.postdelegate]\nurl = "https://YOUR-WORKSPACE-HOST/api/v1/mcp"\nbearer_token_env_var = "POSTDELEGATE_API_KEY"',
      },
      {
        heading: 'Start with restricted access',
        body: 'Issue a PostDelegate API key for the intended workspace and accounts. Grant create_posts, and add upload_media only when needed. Leave publish_directly disabled for a draft-only connection. Do not commit the token to config.toml, a repository or a prompt.',
        items: [
          'For a client using OAuth instead, follow its supported authorization flow. PostDelegate OAuth inherits the signed-in user’s authority.',
          'An MCP endpoint must be reachable from the environment executing the connection. Remote environments cannot use your laptop’s loopback address.',
          'No PostDelegate-specific Codex plugin, skill package or CLI installation is required by this protocol guide.',
        ],
      },
      firstDraft,
      reviewAndSchedule,
      {
        heading: 'Verify the result, not just the tool call',
        body: 'Have Codex return the post ID, selected account and draft status. Check that draft in the web workspace before enabling scheduling. A successful connector configuration does not establish that platform permissions or live publishing have been qualified for this deployment.',
        code: 'Create one draft for the account I select. Return its post ID and account. Do not schedule or publish. If the create response is uncertain, stop and tell me to check the workspace before retrying.',
      },
    ],
  },
};
