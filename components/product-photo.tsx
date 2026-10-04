import { useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { productPhoto } from '../lib/product-photo';
export default function ProductPhoto({ variant, product, alt, preferProduct = false }: { variant?: { photo_url?: string | null }; product: { photo_url?: string | null }; alt: string; preferProduct?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const selected = productPhoto(variant, product, preferProduct);
  const fallback = preferProduct ? productPhoto(variant, {}) : productPhoto(undefined, product);
  const src = !failed.includes(selected) ? selected : !failed.includes(fallback) ? fallback : '';
  return src ? <img src={src} alt={alt} loading="lazy" onError={()=>setFailed(urls=>[...urls,src])}/> : <div role="img" aria-label="Foto belum tersedia"><PackageSearch size={28}/><span>Foto belum tersedia</span></div>;
}
