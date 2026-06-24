import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for domain/business-rule violations. Carries a stable machine
 * `code` (for the frontend to switch on) plus optional structured details.
 *
 * Example:
 *   throw new BusinessException(
 *     'Insufficient stock for the requested quantity',
 *     'INSUFFICIENT_STOCK',
 *     HttpStatus.CONFLICT,
 *     { productId, requested, available },
 *   );
 */
export class BusinessException extends HttpException {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    code = 'BUSINESS_RULE_VIOLATION',
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    details?: unknown,
  ) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
