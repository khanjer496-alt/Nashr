'use client';

import { useState } from 'react';

export function UtilityTool({ kind }: { kind: 'caption' | 'utm' }) {
  const [caption, setCaption] = useState('');
  const [limit, setLimit] = useState(2200);
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);
  const count = Array.from(caption).length;
  let result = '';
  let error = '';
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      if (!source.trim() || !campaign.trim()) error = 'Add a source and campaign to build your link.';
      else {
        parsed.searchParams.set('utm_source', source.trim());
        parsed.searchParams.set('utm_medium', medium.trim() || 'social');
        parsed.searchParams.set('utm_campaign', campaign.trim());
        result = parsed.toString();
      }
    } catch { error = 'Enter a complete http:// or https:// URL without a username or password.'; }
  }
  return <div className="utility-panel">
    {kind === 'caption' ? <>
      <div className="tool-action-row"><strong>Caption workspace</strong><button type="button" onClick={() => setCaption("A new idea, ready to share. What are you working on this week?")}>Try an example</button></div><label htmlFor="caption-text">Your caption</label>
      <textarea id="caption-text" rows={7} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Paste or write your caption here…" />
      <label htmlFor="caption-limit">Your character limit</label>
      <input id="caption-limit" type="number" min={1} max={100000} value={limit} onChange={e => setLimit(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} />
      <div className="tool-results" aria-live="polite"><strong>{count} characters</strong><span>{caption.trim() ? caption.trim().split(/\s+/u).length : 0} words</span><span>{count > limit ? `${count - limit} over your limit` : `${limit - count} remaining`}</span></div>
      <p>Counts Unicode characters, not bytes. Individual platforms may count emoji, links and formatting differently; confirm in the composer before publishing.</p>
    </> : <>
      <div className="tool-action-row"><strong>Campaign link</strong><button type="button" onClick={() => { setUrl("https://example.com/launch"); setSource("linkedin"); setMedium("social"); setCampaign("product-launch"); setCopied(false); }}>Try an example</button></div><label htmlFor="utm-url">Destination URL</label><input id="utm-url" type="url" value={url} placeholder="https://example.com/launch" onChange={e => { setUrl(e.target.value); setCopied(false); }} />
      <div className="tool-fields"><div><label htmlFor="utm-source">Source</label><input id="utm-source" value={source} placeholder="linkedin" onChange={e => { setSource(e.target.value); setCopied(false); }} /></div><div><label htmlFor="utm-medium">Medium</label><input id="utm-medium" value={medium} onChange={e => { setMedium(e.target.value); setCopied(false); }} /></div></div>
      <label htmlFor="utm-campaign">Campaign</label><input id="utm-campaign" value={campaign} placeholder="product-launch" onChange={e => { setCampaign(e.target.value); setCopied(false); }} />
      {error && <p role="status">{error}</p>}
      <label htmlFor="utm-result">Your tracking link</label><textarea id="utm-result" readOnly rows={3} value={result} />
      <button type="button" disabled={!result} onClick={async () => { try { await navigator.clipboard.writeText(result); setCopied(true); } catch { setCopied(false); document.getElementById('utm-result')?.focus(); } }}>Copy link</button>
      <span role="status">{copied ? 'Link copied.' : 'You can also select the link and copy it manually.'}</span>
      <p>Existing query parameters and the page fragment are preserved. Existing source, medium and campaign tags are replaced by the values above.</p>
    </>}
    <p className="tool-private-note">This tool runs in your browser. Your text and URLs are not sent to a server or saved.</p>
  </div>;
}
