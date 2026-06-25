/**
 * Attribute data types. Only SELECT/MULTISELECT attributes (which have
 * predefined options) may be `is_variant_defining`.
 */
export enum AttributeType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
}
