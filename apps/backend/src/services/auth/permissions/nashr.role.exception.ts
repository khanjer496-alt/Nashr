import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  NashrAction,
  NashrResource,
} from '@gitroom/nashr-permissions/role.matrix';

/**
 * Nashr (نشر) addition.
 *
 * 403, deliberately distinct from upstream's `SubscriptionException` (402).
 * Upgrading a plan cannot fix a role denial, so it must not be routed to
 * /billing the way SubscriptionExceptionFilter routes tier denials.
 */
export class NashrRoleException extends HttpException {
  constructor(message: {
    resource: NashrResource | string;
    action: NashrAction | string;
    role: string;
  }) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'NashrRoleForbidden',
        message: `Your role (${message.role}) is not allowed to ${message.action} ${message.resource}.`,
        ...message,
      },
      HttpStatus.FORBIDDEN
    );
  }
}
