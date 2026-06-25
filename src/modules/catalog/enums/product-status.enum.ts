/** Product publishing lifecycle. Public endpoints expose only ACTIVE products. */
export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
