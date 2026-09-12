'use client';
import { useState } from 'react';
export function CopySnippet({ code }: {code:string}) {
  const [status,setStatus]=useState('');
  return <div className="agent-terminal"><div className="agent-terminal-bar"><span>MCP configuration · replace the placeholder</span><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(code);setStatus('Copied.')}catch{setStatus('Select the example below and copy it manually.')}}}>Copy example</button></div><pre><code>{code}</code></pre><p role="status">{status || 'Use the server address from your PostDelegate workspace.'}</p></div>;
}
