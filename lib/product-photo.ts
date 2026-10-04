export function productPhoto(variant: { photo_url?: string | null } | undefined, product: { photo_url?: string | null }, preferProduct = false): string {
  const allowed = (value?: string | null) => { const url = value?.trim() || ''; return /^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')) ? url : ''; };
  return preferProduct
    ? allowed(product.photo_url) || allowed(variant?.photo_url)
    : allowed(variant?.photo_url) || allowed(product.photo_url);
}
