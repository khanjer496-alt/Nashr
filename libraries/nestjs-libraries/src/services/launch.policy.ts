import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { getLaunchCapabilities, isProviderEnabled } from '@gitroom/helpers/configuration/launch.capabilities';

export type LaunchFeature = 'hostedAi' | 'customAgents' | 'designer' | 'platformAnalytics';

export function assertLaunchFeature(feature: LaunchFeature): void {
  if (!getLaunchCapabilities()[feature]) {
    throw new ForbiddenException({
      code: 'FEATURE_DISABLED',
      message: 'This optional feature is not enabled for this deployment.',
    });
  }
}

export function assertLaunchProvider(provider: string): void {
  if (!isProviderEnabled(provider)) {
    throw new ForbiddenException({
      code: 'CHANNEL_DISABLED',
      message: 'This channel is not enabled for this deployment.',
    });
  }
}

@Injectable()
export class HostedAiGuard implements CanActivate {
  canActivate() { assertLaunchFeature('hostedAi'); return true; }
}

@Injectable()
export class CustomAgentsGuard implements CanActivate {
  canActivate() { assertLaunchFeature('customAgents'); return true; }
}
