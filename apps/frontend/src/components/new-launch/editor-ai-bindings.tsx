'use client';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';

// These children mount only inside the optional AI provider. The ordinary
// editor/selector must remain usable without any model-runtime context.
export function EditorAiBindings({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }): null {
  useCopilotReadable({ description: 'Current content of posts', value });
  useCopilotAction({
    name: 'setPosts', description: 'a thread of posts',
    parameters: [{ name: 'content', type: 'string[]', description: 'a thread of posts' }],
    handler: async ({ content }) => { onChange(content); },
  }, [onChange]);
  return null;
}

export function PlatformAiBindings({ integrations, isMain, handler }: {
  integrations: unknown; isMain: boolean;
  handler: (value: { integrationsId: string[] }) => Promise<void>;
}): null {
  useCopilotReadable({
    description: isMain ? 'All available platforms channels' : 'Possible platforms channels to edit',
    value: JSON.stringify(integrations),
  });
  useCopilotAction({
    name: isMain ? 'addOrRemovePlatform' : 'setSelectedIntegration',
    description: isMain ? 'Add or remove channels to schedule your post to, pass all the ids as array' : 'Set selected integrations',
    parameters: [{ name: 'integrationsId', type: 'string[]', description: 'List of integrations id to set as selected', required: true }],
    handler,
  }, [handler]);
  return null;
}
