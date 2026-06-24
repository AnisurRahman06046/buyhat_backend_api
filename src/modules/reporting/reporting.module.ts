import { Module } from '@nestjs/common';

/**
 * Reporting module — sales/analytics read models and exports. Owns schema
 * `reporting`, populated from domain events rather than live cross-module
 * queries, so analytics load never touches transactional tables.
 *
 * Skeleton only.
 */
@Module({})
export class ReportingModule {}
