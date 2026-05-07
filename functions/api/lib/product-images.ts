export const PRODUCT_IMAGE_MAX_UPLOAD_BYTES = 1024 * 1024

const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function getProductImageExtension(contentType: string): string | null {
  return PRODUCT_IMAGE_EXTENSIONS[contentType.toLowerCase()] ?? null
}

export function isSupportedProductImageType(contentType: string): boolean {
  return getProductImageExtension(contentType) !== null
}
