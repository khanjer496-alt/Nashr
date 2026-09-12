export const comparisonPages: Record<
  string,
  {
    title: string;
    description: string;
    eyebrow: string;
    sections: { heading: string; body: string; items?: string[]; code?: string }[];
  }
> = {
  "compare/postiz": {
    title: "PostDelegate vs Postiz",
    description:
      "Compare agent access, channel coverage and approval workflows, with a clear distinction between implemented features and production readiness.",
    eyebrow: "Product comparison · Reviewed 12 September 2026",
    sections: [
      {
        heading: "Two approaches to agent-driven publishing",
        body:
          "Postiz advertises social publishing through AI agents, a CLI, MCP and a public API. PostDelegate is being built around scoped REST and MCP access, with a web workspace for review and scheduling. Connecting an AI agent is a shared capability; it is not a feature unique to PostDelegate.",
      },
      {
        heading: "Channel coverage matters",
        body:
          "Postiz advertises more than 30 networks, including X and Reddit. PostDelegate’s current implementation covers a smaller set and does not include X or Reddit. Provider code alone does not establish production availability: account permissions and real publishing still need qualification for each launch channel.",
      },
      {
        heading: "Keep human review in the workflow",
        body:
          "PostDelegate implements workspace roles, internal and client review stages, change requests and holds. Its scheduling checks require valid approval for the content being scheduled in approval-required workspaces. Postiz advertises team collaboration and automation; this comparison does not establish an equivalent level of client approval coverage in Postiz.",
      },
      {
        heading: "Creative and automation tools",
        body:
          "Postiz advertises AI content tools, an image editor, recurring posts and RSS automation. PostDelegate implements recurrence and basic media editing, but does not currently offer an enabled creative studio comparable to those advertised tools. An optional AI integration should not be mistaken for an included, configured service.",
      },
      {
        heading: "Evaluate the workflow you need",
        body:
          "If broad channel coverage or Postiz’s advertised creative tools are essential, include them in your evaluation. When evaluating PostDelegate, test an agent-created draft, human review, scheduling and failure recovery on your required channels. Local tests demonstrate implementation behavior; they do not establish hosted reliability or customer outcomes. We make no price or performance superiority claim.",
      },
      {
        heading: "Sources and scope",
        body:
          "Competitor statements reflect official product descriptions reviewed on 12 September 2026, not an independent hands-on benchmark. PostDelegate statements describe its reviewed implementation; production publishing qualification remains separate. Features and plans can change.",
        items: [
          "Postiz product and agent capabilities: https://postiz.com/",
          "Postiz current plans: https://postiz.com/pricing",
        ],
      },
    ],
  },
  "compare/post-bridge": {
    title: "PostDelegate vs Post Bridge",
    description:
      "Compare agent integration, creator workflows and human approval controls without treating advertised features or local tests as production guarantees.",
    eyebrow: "Product comparison · Reviewed 12 September 2026",
    sections: [
      {
        heading: "Agent access is available in both",
        body:
          "Post Bridge advertises a developer API and MCP access alongside its social scheduler. PostDelegate implements REST and MCP access with scoped API keys and workspace permissions. Both can belong in an agent publishing workflow; the useful comparison is how well each supports your channels, review process and recovery needs.",
      },
      {
        heading: "Creator workflows and channel fit",
        body:
          "Post Bridge lists ten supported platforms, including X, and advertises bulk video scheduling and a content studio on selected plans. PostDelegate does not currently include X or an equivalent bulk video studio. Its current code includes drafts, scheduling, recurrence and basic image and video editing. Confirm real account support before choosing either product for a particular channel.",
      },
      {
        heading: "Review before scheduling",
        body:
          "PostDelegate implements internal review, a separate client sign-off stage, change requests and holds. Approved posts can be scheduled through REST or MCP while retaining the required approval checks. Post Bridge advertises team invitations; we have not established whether its client approval workflow matches these controls. An unverified feature is not necessarily absent.",
      },
      {
        heading: "Understand PostDelegate’s current limits",
        body:
          "PostDelegate’s API and MCP workflows have local regression coverage. That is implementation evidence, not a production service guarantee. Live channel authorization, scheduled publishing, media storage and recovery still require deployment qualification. A general publishing subscription and its entitlements should not be inferred from optional AI billing code.",
      },
      {
        heading: "Compare the complete job",
        body:
          "For a video-heavy creator workflow, evaluate Post Bridge’s advertised batch and studio tools. For PostDelegate, exercise the agent-to-review-to-schedule path with your own approval requirements. Check current account limits, API access, support and plan terms directly. We have not established that PostDelegate is cheaper, faster or more reliable.",
      },
      {
        heading: "Sources and scope",
        body:
          "Reviewed on 12 September 2026 using official competitor descriptions and PostDelegate’s current implementation review. This is a feature comparison, not a customer outcome study or an independent production benchmark. Availability and plans can change.",
        items: [
          "Post Bridge product, supported platforms and agent access: https://www.post-bridge.com/",
          "Post Bridge current plans: https://www.post-bridge.com/pricing",
        ],
      },
    ],
  },
};
