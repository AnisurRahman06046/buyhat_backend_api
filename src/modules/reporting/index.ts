/**
 * Public API of the `reporting` module. Orders/auth call the `record*` seams;
 * CMS reads `getBestSellers`. All one-way — reporting imports none of them.
 */
export { ReportingModule } from './reporting.module';
export { ReportingService } from './services/reporting.service';
export type {
  OrderCommittedInput,
  OrderLineFact,
} from './services/reporting.service';
