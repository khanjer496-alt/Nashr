import { agentPages } from './agent-guides';
import { platformPages } from './platform-guides';
import { comparisonPages } from './comparison-guides';

export type GuidePage = { title: string; description: string; eyebrow: string; sections: { heading: string; body: string; items?: string[]; code?: string }[]; tool?: 'caption' | 'utm' };
export const pages: Record<string, GuidePage> = {
  ...agentPages, ...platformPages, ...comparisonPages,
  'tools/caption-checker': { title: 'Social media caption checker', description: 'Count characters and words, and check your caption against a limit before you schedule.', eyebrow: 'FREE TOOL', tool: 'caption', sections: [{ heading: 'A quick check before you post', body: 'Paste your caption and set the limit you want to check. Use the result as a drafting aid; platform-specific limits and counting rules still apply.' }] },
  'tools/utm-builder': { title: 'Social media UTM link builder', description: 'Create campaign tracking links for your social posts. No login or upload required.', eyebrow: 'FREE TOOL', tool: 'utm', sections: [{ heading: 'Know where your visits came from', body: 'Add a source, medium and campaign to your destination URL, then use the generated link in your post. Your analytics service must support UTM attribution to report those visits.' }] },
};
export const directoryPages: Record<string, {title:string;description:string;paths:string[]}> = {
  'agents': {title:'Publish with your AI agent',description:'Connect through MCP or REST, prepare drafts and keep publishing permissions clear.',paths:['mcp','api','claude-cowork','codex']},
  'platforms': {title:'Plan content for your social channels',description:'Explore account requirements and supported workflows. Public connections are not open yet.',paths:Object.keys(platformPages)},
  'tools': {title:'Free tools for your social posts',description:'Check your caption. Build your campaign link. Get the small jobs done before your next post.',paths:['tools/caption-checker','tools/utm-builder']},
  'compare': {title:'Find the right social publishing tool',description:'Compare actual capabilities and launch availability—not promises or invented savings.',paths:Object.keys(comparisonPages)},
};
