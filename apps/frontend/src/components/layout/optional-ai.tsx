'use client';

import { ComponentProps, ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotTextarea } from '@copilotkit/react-textarea';
import { useLaunchCapabilities, useVariables } from '@gitroom/react/helpers/variable.context';

/** Do not mount the runtime client when hosted AI is disabled. */
export function OptionalAiProvider({ children }: { children: ReactNode }) {
  const { hostedAi } = useLaunchCapabilities();
  const { backendUrl } = useVariables();
  if (!hostedAi) return <>{children}</>;
  return <CopilotKit credentials="include" runtimeUrl={backendUrl + '/copilot/chat'} showDevConsole={false}>{children}</CopilotKit>;
}

/** Ordinary editing remains available without autosuggestion/model requests. */
export function OptionalAiTextarea(props: ComponentProps<typeof CopilotTextarea>) {
  const { hostedAi } = useLaunchCapabilities();
  if (hostedAi) return <CopilotTextarea {...props} />;
  return <textarea className={props.className} value={props.value} onChange={props.onChange}
    placeholder={props.placeholder} name={props.name} id={props.id}
    disabled={props.disabled} onBlur={props.onBlur} aria-label={props['aria-label']} />;
}
