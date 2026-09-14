export type CatalogueStatus = 'all' | 'Draft' | 'Ready' | 'Archived' | 'published' | 'unpublished';
type SearchableProduct = { name: string; product_code: string; brand: string; category: string; status: string; published: boolean };
export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').trim();
export function filterCatalogue<T extends SearchableProduct>(products: T[], query: string, category: string, brand: string, status: CatalogueStatus, sort: 'default' | 'name' | 'code' = 'default'): T[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const result = products.filter(p => {
    const text = normalizeSearch([p.name, p.product_code, p.brand || 'Tanpa brand', p.category].join(' '));
    return words.every(word => text.includes(word))
      && (category === 'Semua kategori' || p.category === category)
      && (brand === 'Semua brand' || (p.brand || 'Tanpa brand') === brand)
      && (status === 'all' || (status === 'published' ? p.published : status === 'unpublished' ? !p.published : p.status === status));
  });
  if (sort !== 'default') result.sort((a, b) => (sort === 'name' ? a.name : a.product_code).localeCompare(sort === 'name' ? b.name : b.product_code, 'id-ID', { numeric: true, sensitivity: 'base' }));
  return result;
}
export function catalogueCategoryNames(products: SearchableProduct[], names: string[]): string[] {
  return [...new Set([...names, ...products.map(p => p.category)])];
}
