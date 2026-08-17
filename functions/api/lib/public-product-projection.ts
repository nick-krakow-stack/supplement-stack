const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'name',
  'brand',
  'form',
  'price',
  'shop_link',
  'image_url',
  'moderation_status',
  'visibility',
  'created_at',
  'is_affiliate',
  'image_r2_key',
  'discontinued_at',
  'replacement_id',
  'serving_size',
  'serving_unit',
  'servings_per_container',
  'container_count',
  'source_user_product_id',
  'dosage_text',
  'warning_title',
  'warning_message',
  'warning_type',
  'alternative_note',
  'affiliate_owner_type',
  'affiliate_owner_user_id',
  'owner_party_id',
  'version',
] as const

export type PublicProductRow = {
  [Column in typeof PUBLIC_PRODUCT_COLUMNS[number]]: unknown
} & { id: number }

export function publicProductSelect(alias: 'p' | 'product' = 'p'): string {
  return PUBLIC_PRODUCT_COLUMNS.map((column) => `${alias}.${column}`).join(',\n      ')
}
