export function productPhoto(variant: { photo_url?: string | null } | undefined, product: { photo_url?: string | null }): string {
  const allowed = (value?: string | null) => { const url = value?.trim() || ''; return /^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')) ? url : ''; };
  return allowed(variant?.photo_url) || allowed(product.photo_url);
}
