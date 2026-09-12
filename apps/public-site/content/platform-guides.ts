/** Based on the BrightBean fork's provider implementations, not platform approval.
 * Source: providers/{instagram,instagram_login,linkedin*,facebook,tiktok,youtube,
 * bluesky,threads,pinterest,google_business,mastodon,devto}.py.
 */
export const platformPages: Record<string, {
  title: string;
  description: string;
  eyebrow: string;
  sections: { heading: string; body: string; items?: string[]; code?: string }[];
}> = {
  'instagram-scheduler': {
    title: 'Instagram scheduler for posts that need a second look',
    description: 'Plan Instagram images, carousels and video with an AI-assisted draft workflow, account checks and human review. PostDelegate is in preview.',
    eyebrow: 'Platform guide · Instagram',
    sections: [
      {
        heading: 'Start with the right Instagram account',
        body: 'The implementation has two connection routes: Facebook-linked Instagram and direct Instagram Login. Direct login targets professional accounts, including Business and Creator accounts, without requiring a linked Facebook Page. Choose the route configured for your account; a personal account is not an interchangeable publishing destination.',
      },
      {
        heading: 'Prepare the media and the caption together',
        body: 'The provider includes image, carousel, Reel and Story publishing paths. Use the post type deliberately: a single video follows the Reel path. Keep the caption within the integration’s 2,200-character limit and check the order and crop of every carousel item. Route-specific Story behavior still needs verification on the intended account.',
        items: ['Upload the actual media before reviewing the post.', 'Check image order, caption and any first comment as one package.', 'Allow for platform media processing; reaching the scheduled time is not proof the post is live.'],
      },
      {
        heading: 'Give your agent a reviewable brief',
        body: 'In a connected workspace, the intended workflow is to have your agent prepare a draft, review the account and media in PostDelegate, complete any required approval, then choose a publishing time. Avoid asking for an immediate publish when assets or permissions are still missing.',
        code: 'Draft an Instagram carousel from these uploaded images. Keep their order, write a concise caption, and leave it for review without scheduling.',
      },
      {
        heading: 'Instagram availability',
        body: 'This is a public product preview. Customer Instagram connections and hosted publishing are not open. The selected login route, app permissions and real publishing tests must be verified before this channel is enabled; the presence of a provider implementation is not Instagram approval.',
      },
    ],
  },
  'linkedin-scheduler': {
    title: 'LinkedIn scheduling for personal voices and company updates',
    description: 'A practical LinkedIn planning guide covering personal profiles, company Pages, post formats and review before scheduling. Public preview.',
    eyebrow: 'Platform guide · LinkedIn',
    sections: [
      {
        heading: 'Choose the author before writing',
        body: 'Personal-member publishing and Company Page publishing use separate connectors. A Page connection requires the relevant organization permissions and an account that can administer the selected Page. A personal connection does not automatically grant access to every company you work with.',
      },
      {
        heading: 'Match the format to the message',
        body: 'The shared LinkedIn provider includes text, image, video, link, article-style shares and polls. An article-style share is not a promise of creating a native LinkedIn newsletter or long-form article. Keep the main post within the integration’s 3,000-character limit; polls need their own options rather than a question pasted into ordinary text.',
        items: ['Use a personal draft for a named person’s perspective.', 'Check the selected Page for product announcements and company news.', 'Review the link destination and media alongside the copy.'],
      },
      {
        heading: 'Keep the agent’s scope specific',
        body: 'The intended connected workflow lets an agent draft for a particular destination while the team retains the review and approval step. Prepare distinct versions for the founder profile and company Page instead of assuming that one post should go to both.',
        code: 'Create two LinkedIn drafts from this release note: one for the founder profile and one for the company Page. Keep both unscheduled and identify the intended author.',
      },
      {
        heading: 'LinkedIn availability',
        body: 'PostDelegate is in public preview; customer LinkedIn connections and hosted scheduling are not available yet. Personal and Company Page permissions must each be checked, and real publishing must be demonstrated for the route being enabled. No LinkedIn partner status or approval is claimed.',
      },
    ],
  },
  'facebook-scheduler': {
    title: 'Facebook Page scheduling with clear destination checks',
    description: 'Plan Facebook Page text, links, photos and video with explicit Page selection and review. Learn what is implemented and what remains preview-only.',
    eyebrow: 'Platform guide · Facebook',
    sections: [
      {
        heading: 'A Page publishing workflow',
        body: 'This connector publishes to a selected Facebook Page. It needs the Page identifier and appropriate Page access from the connected account. It does not turn a personal Facebook profile or a Group into a supported destination merely because the same person manages them.',
      },
      {
        heading: 'Plan the whole post, not just the text',
        body: 'The implementation includes text, link, photo and video paths, plus multi-photo posts with a limit of ten photos in that path. Check the Page, link destination and image selection before scheduling. A successful content draft does not prove that the connected Page token has the permissions needed to publish.',
        items: ['Confirm the Page name and identity before approval.', 'Use a dedicated link post when the destination matters.', 'Keep first-comment review separate from whether the main post succeeded.'],
      },
      {
        heading: 'Ask for a bounded announcement',
        body: 'Once a workspace connection is enabled, the planned agent workflow is to prepare the announcement from approved material, show the media and destination, and wait for review. If publishing returns an uncertain result, check the Page before attempting it again.',
        code: 'Prepare a Facebook Page draft announcing the event. Use the approved image and registration link. Do not publish or schedule until I review the Page and final wording.',
      },
      {
        heading: 'Facebook availability',
        body: 'This site is a product preview. Customer Page connections and hosted publishing remain closed while PostDelegate’s own platform access and real publishing tests are pending. These implementation details do not establish Meta approval or permission to post to a particular Page.',
      },
    ],
  },
  'tiktok-scheduler': {
    title: 'TikTok video planning with visibility checked first',
    description: 'Prepare TikTok video drafts with account-specific privacy and duration checks. Understand the current upload limit and preview availability.',
    eyebrow: 'Platform guide · TikTok',
    sections: [
      {
        heading: 'Video is the supported starting point',
        body: 'The current TikTok provider implements video publishing. It does not advertise photo posts or carousels. Prepare the finished video, a caption within the integration’s 2,200-character limit, and the intended visibility before asking an agent to schedule anything.',
      },
      {
        heading: 'The account decides which privacy options are allowed',
        body: 'The integration consults creator information for available privacy choices and maximum video duration. Those checks depend on the information TikTok returns. An unaudited client can be restricted to self-only visibility; connecting an account does not prove that public posting is available.',
        items: ['Choose visibility explicitly and verify it against the account’s allowed options.', 'Check the actual video duration before uploading.', 'The current direct file-upload path is limited to 64,000,000 bytes; multi-chunk uploading is not implemented there.'],
      },
      {
        heading: 'Separate preparation from going live',
        body: 'An agent brief should identify the uploaded video, intended audience and desired review state. Keep the post as a draft until someone has checked the clip, disclosure settings and privacy choice. Platform processing may continue after an upload has been accepted.',
        code: 'Prepare a TikTok draft using this uploaded clip. Suggest a short caption, list the visibility choice for my review, and leave the post unscheduled.',
      },
      {
        heading: 'TikTok availability',
        body: 'PostDelegate is in preview. Customer TikTok connections and hosted publishing are not open, and no TikTok app audit or public-posting approval is claimed. Account eligibility and a real end-to-end publish must be verified before enabling this channel.',
      },
    ],
  },
  'youtube-scheduler': {
    title: 'YouTube scheduling that starts with a finished upload',
    description: 'Plan YouTube videos and Shorts with titles, descriptions, privacy and audience settings reviewed together. PostDelegate remains in preview.',
    eyebrow: 'Platform guide · YouTube',
    sections: [
      {
        heading: 'Prepare videos and Shorts, not Community posts',
        body: 'The YouTube provider accepts video and Short post types and requires a video file for its upload path. Community posts and live-stream management are not part of this publishing implementation. Choose the intended channel through its Google connection before preparing the upload.',
      },
      {
        heading: 'Review metadata as part of the release',
        body: 'The integration uses a title of up to 100 characters and a description of up to 5,000 characters. It also passes privacy, category, tags and the made-for-kids setting. The Short path adds a #Shorts tag when missing; that alone does not guarantee YouTube will classify a video as a Short.',
        items: ['Check the channel, title, description and thumbnail together.', 'Choose privacy and audience settings deliberately.', 'Allow for upload and processing time rather than treating the planned time as a guaranteed public release.'],
      },
      {
        heading: 'Use an agent for preparation, with a human release decision',
        body: 'For an enabled workspace, an agent can be asked to prepare metadata from your approved outline and uploaded video. Review the final settings before scheduling, especially when an upload should remain private during checks.',
        code: 'Draft the YouTube title and description from this outline for the uploaded video. Leave it unscheduled and ask me to confirm the channel, privacy and audience settings.',
      },
      {
        heading: 'YouTube availability',
        body: 'This is a public preview, not an open YouTube publishing service. PostDelegate’s Google access, channel authorization and real upload behavior still need verification before customer connections are enabled. No verification or unrestricted publishing quota is claimed.',
      },
    ],
  },
  'bluesky-scheduler': {
    title: 'Bluesky scheduling for concise, reviewed updates',
    description: 'Plan Bluesky text and media drafts with app-password access, mention checks and a clear review step. Public preview availability explained.',
    eyebrow: 'Platform guide · Bluesky',
    sections: [
      {
        heading: 'Connect with an app password',
        body: 'The Bluesky implementation uses a handle and app password to create an AT Protocol session. It is not the same OAuth flow used for several other channels. Keep the app password out of chat messages and content briefs, and connect the exact account that should own the post.',
      },
      {
        heading: 'Keep the draft small and the media intentional',
        body: 'Text, image and video paths are implemented. The drafting limit is 300 characters, and the image path includes up to four images. The provider also constructs link, mention and hashtag facets. Review how those resolve; an unresolved handle should not be assumed to notify the intended person.',
        items: ['Check the complete handle, not only a display name.', 'Keep image selection within four items and review alternative text.', 'Use a separate draft when a longer announcement needs a different angle.'],
      },
      {
        heading: 'A short agent brief',
        body: 'The planned workspace workflow is to ask for a concise draft from an approved source, review the exact text and attached media, then schedule after approval. Do not assume a cross-platform paragraph will fit unchanged.',
        code: 'Turn this announcement into one Bluesky draft under 300 characters. Use the approved link, avoid unverified mentions, and leave it for review.',
      },
      {
        heading: 'Bluesky availability',
        body: 'Customer Bluesky connections and hosted scheduling are not yet open on PostDelegate. Session handling, account eligibility and real media publishing must be tested for the deployed service. An implemented connector does not mean every AT Protocol server or account configuration has been verified.',
      },
    ],
  },
  'threads-scheduler': {
    title: 'Threads scheduling for focused conversations',
    description: 'Prepare Threads text, image, video and carousel drafts with clear account selection and media checks. PostDelegate is a public preview.',
    eyebrow: 'Platform guide · Threads',
    sections: [
      {
        heading: 'Treat Threads as its own destination',
        body: 'Threads uses a dedicated OAuth connection and publishing permissions. An Instagram connection is not proof that Threads is authorized. Confirm the Threads account itself before handing a draft to an agent or reviewer.',
      },
      {
        heading: 'Keep the message within the format',
        body: 'The provider implements text, image, video and carousel publishing paths with a 500-character text limit. Media posts use a container-and-publish flow, and videos may need processing time. Do not treat a container being created as confirmation that the final post is visible.',
        items: ['Use a focused opening rather than pasting a longer caption unchanged.', 'Review every carousel item in order.', 'Check the final published result before retrying an uncertain submission.'],
      },
      {
        heading: 'Draft for a response, not just a broadcast',
        body: 'For a connected workspace, ask your agent for one clear idea and a question that follows from the approved material. Keep it in review until the account, wording and any attached media are correct.',
        code: 'Create a Threads draft from this product note. Keep it under 500 characters, end with a relevant question, and leave scheduling to me.',
      },
      {
        heading: 'Threads availability',
        body: 'PostDelegate’s public website is a preview. Customer Threads connections and hosted publishing remain closed pending the necessary platform access and real publishing checks. No Threads approval or production availability is implied by this guide.',
      },
    ],
  },
  'pinterest-scheduler': {
    title: 'Pinterest scheduling with the board and destination in view',
    description: 'Plan Pinterest Pins with a selected board, usable media and a reviewed destination link. Learn the integration limits before launch.',
    eyebrow: 'Platform guide · Pinterest',
    sections: [
      {
        heading: 'Every Pin needs a board',
        body: 'The Pinterest provider creates Pins for a specified board. A board identifier is required; connecting an account is not enough to choose where a Pin belongs. Review the board alongside the creative so an agent cannot infer the destination from a caption alone.',
      },
      {
        heading: 'Prepare the image, description and link together',
        body: 'The implementation includes image Pins and a separate video Pin path. It uses descriptions up to 500 characters and titles up to 100. The image path requires a hosted, fetchable image URL rather than directly submitting a local file. A normal workspace media upload can supply stored media for the publishing flow.',
        items: ['Check the board and the final destination link.', 'Make the image understandable without relying only on the description.', 'Review alternative text and whether the media URL remains usable when Pinterest fetches it.'],
      },
      {
        heading: 'A practical agent handoff',
        body: 'In an enabled workspace, use an agent to prepare a Pin draft from an approved article or product page. Review its visual, board and link before scheduling; title and description changes should not silently change the destination.',
        code: 'Prepare a Pinterest Pin draft for this approved article and uploaded image. Suggest a title and description, show the intended board, and wait for my review.',
      },
      {
        heading: 'Pinterest availability',
        body: 'This guide describes a preview implementation. Customer Pinterest connections and hosted Pin publishing are not open. App access, board permissions and real image/video publishing still need verification before this channel is enabled.',
      },
    ],
  },
  'google-business-scheduler': {
    title: 'Google Business Profile scheduling for the correct location',
    description: 'Plan business updates with explicit location selection, accurate copy and review. Google Business Profile publishing is preview-only in PostDelegate.',
    eyebrow: 'Platform guide · Google Business Profile',
    sections: [
      {
        heading: 'The location is part of the content',
        body: 'This provider uses Google authorization for business management and publishes local posts to a business location. Confirm the business name and address before scheduling. The implementation can fall back to the first location returned when no location is specified, so multi-location teams must verify the target explicitly.',
      },
      {
        heading: 'Prepare a useful local update',
        body: 'Text and image publishing are implemented, with a 1,500-character text limit. The provider also carries event or offer details when those topic types and their required data are supplied. That is not a promise that every Google Business feature is available in the composer.',
        items: ['Verify dates, location-specific details and any offer conditions.', 'Use an image that belongs to the selected business location.', 'Review structured event or offer information as carefully as the main text.'],
      },
      {
        heading: 'Tell the agent which business you mean',
        body: 'A good brief names the location and supplies the approved facts. Keep the post in review until a person has checked the business identity and any time-sensitive details. Do not let an agent invent opening hours, prices or promotional conditions.',
        code: 'Draft a Google Business update for our named branch using these confirmed details. Do not infer hours or prices. Leave it unscheduled until I verify the location.',
      },
      {
        heading: 'Google Business availability',
        body: 'PostDelegate is in public preview. Customer Google Business connections and hosted posting are not open. The deployment’s API access, business-management permissions, eligible location and a real local-post result must all be verified first.',
      },
    ],
  },
  'mastodon-scheduler': {
    title: 'Mastodon scheduling that respects the instance',
    description: 'Plan Mastodon posts with instance-specific account access, visibility, content warnings and review. Preview availability and limits explained.',
    eyebrow: 'Platform guide · Mastodon',
    sections: [
      {
        heading: 'Start with the account’s instance',
        body: 'Mastodon connects through instance-specific OAuth. The server URL matters as much as the account handle; a token from one instance is not a universal Mastodon credential. The implementation registers and resolves an application for the selected instance rather than using one shared destination.',
      },
      {
        heading: 'Review visibility and content warnings',
        body: 'The provider includes text, image, video and poll paths. It also passes visibility and content-warning text. It has a 500-character default and an instance-limit lookup, so check the actual server’s limits instead of treating the default as universal.',
        items: ['Choose visibility deliberately before scheduling.', 'Include a content warning when the material calls for it.', 'For polls, review options, duration and whether multiple choices are allowed.'],
      },
      {
        heading: 'Keep the draft appropriate for its community',
        body: 'In an enabled workspace, give the agent the instance, audience and approved source material. Ask it to prepare a draft with the requested visibility and content warning for review, not to assume that a public cross-post is always appropriate.',
        code: 'Prepare a Mastodon draft for this account using the approved text. Keep the requested content warning, show the visibility choice, and do not schedule yet.',
      },
      {
        heading: 'Mastodon availability',
        body: 'Customer Mastodon connections and hosted publishing are not open in PostDelegate’s public preview. Real authorization and publishing must be verified on the intended instance. This guide does not claim compatibility with every server, extension or federation configuration.',
      },
    ],
  },
  'devto-scheduler': {
    title: 'DEV.to scheduling for reviewed technical articles',
    description: 'Prepare DEV.to articles with a title, Markdown, tags and canonical link, then review before publishing. PostDelegate remains in preview.',
    eyebrow: 'Platform guide · DEV.to',
    sections: [
      {
        heading: 'Use the account’s API key securely',
        body: 'The DEV.to connector uses a personal API key rather than OAuth. Keep that key in the connection settings, not in an article, chat prompt or agent brief. Confirm the author account before preparing publication.',
      },
      {
        heading: 'An article needs more than a social caption',
        body: 'The provider creates an article with a required title and Markdown body. It limits titles to 128 characters and normalizes the tag list to at most four tags. A supplied link becomes the canonical URL, and a suitable hosted image can become the main image. It publishes the article when dispatched; it is not a remote draft-sync feature.',
        items: ['Check headings, code blocks and links in the Markdown.', 'Use the canonical URL only when it identifies the intended original source.', 'Verify technical claims and examples rather than publishing an unchecked AI draft.'],
      },
      {
        heading: 'Give the agent an editorial task',
        body: 'For a connected workspace, start from your outline and approved examples. Ask the agent to prepare an article draft and tag suggestions, then review the complete piece before choosing a time. PostDelegate review drafts and a published DEV.to article are different states.',
        code: 'Prepare a DEV.to article draft from this outline and verified code example. Include a title, Markdown sections and no more than four tags. Leave publication pending my review.',
      },
      {
        heading: 'DEV.to availability',
        body: 'This is a public product preview. Customer DEV.to connections and hosted article scheduling are not open. The intended account, API-key access and a real publishing test still need verification. The provider name does not establish support for every independent Forem deployment.',
      },
    ],
  },
};
