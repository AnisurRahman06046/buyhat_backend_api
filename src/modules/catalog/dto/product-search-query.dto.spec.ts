import { ProductSearchQueryDto } from './product-search-query.dto';

describe('ProductSearchQueryDto.toAttributeFilters', () => {
  const make = (attr?: string[]): ProductSearchQueryDto => {
    const dto = new ProductSearchQueryDto();
    dto.attr = attr;
    return dto;
  };

  it('groups option ids by attribute id', () => {
    const filters = make(['a1:o1', 'a1:o2', 'a2:o3']).toAttributeFilters();
    expect(filters).toEqual([
      { attributeId: 'a1', optionIds: ['o1', 'o2'] },
      { attributeId: 'a2', optionIds: ['o3'] },
    ]);
  });

  it('dedupes repeated pairs and ignores malformed ones', () => {
    const filters = make([
      'a1:o1',
      'a1:o1',
      'bad',
      'a1:',
      ':o9',
    ]).toAttributeFilters();
    expect(filters).toEqual([{ attributeId: 'a1', optionIds: ['o1'] }]);
  });

  it('returns [] when no attr filters are present', () => {
    expect(make(undefined).toAttributeFilters()).toEqual([]);
  });
});
