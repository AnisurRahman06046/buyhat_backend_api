import { Injectable, Logger } from '@nestjs/common';
import { ProductSearchResult, SearchProvider } from './search.types';

/**
 * Deferred Elasticsearch/OpenSearch adapter (D72). Scaffolded behind the same
 * `SEARCH_PROVIDER` token so production can flip `SEARCH_DRIVER=elasticsearch`
 * with no caller change. Implementation steps when adopting:
 *   1. add the ES client dependency + a `search` config block (node/index);
 *   2. implement `search` (bool query: filters + multi_match + aggregations for
 *      facets + `search_after` for keyset paging) mapping to `ProductSearchResult`;
 *   3. implement `index`/`remove`, fed by an indexer consuming the existing
 *      catalog outbox (`catalog-events`), to keep the index in sync.
 * Only constructed when the driver is `elasticsearch`, so the default PG path is
 * unaffected.
 */
@Injectable()
export class ElasticsearchSearchProvider implements SearchProvider {
  private readonly logger = new Logger(ElasticsearchSearchProvider.name);

  search(): Promise<ProductSearchResult> {
    return Promise.reject(
      new Error(
        'Elasticsearch search adapter is not implemented yet — set SEARCH_DRIVER=pg',
      ),
    );
  }

  index(productId: string): Promise<void> {
    this.logger.debug(`(noop) index product ${productId}`);
    return Promise.resolve();
  }

  remove(productId: string): Promise<void> {
    this.logger.debug(`(noop) remove product ${productId}`);
    return Promise.resolve();
  }
}
