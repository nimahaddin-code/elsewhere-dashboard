import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

import type {
  CatalogueProduct as PublicProduct,
  CatalogueVariant,
} from '../lib/commerce';
import { rupiah } from '../lib/pricing';
import OrderForm from '../components/order-form';
import ProductPhoto from '../components/product-photo';

export default function Landing() {
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ordering, setOrdering] = useState<{
    product: PublicProduct;
    variant: CatalogueVariant;
  } | null>(null);
  const [category, setCategory] = useState('Semua');
  const [brand, setBrand] = useState('Semua');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, { option1?: string; option2?: string }>>({});
  const load = async () => {
    try {
      const { data, error } = await supabase.rpc('commerce_catalogue');
      if (error) throw error;
      setItems((data || []) as PublicProduct[]);
      setLoadError('');
    } catch {
      setLoadError('Katalog belum bisa dimuat. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // Public tables are private. Refresh the safe catalogue RPC instead of exposing raw rows.
    const refresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const categories = useMemo(
    () => ['Semua', ...new Set(items.map((x) => x.category))],
    [items],
  );
  const brands = useMemo(
    () => [
      'Semua',
      ...new Set(
        items
          .filter((x) => category === 'Semua' || x.category === category)
          .map((x) => x.brand)
          .filter(Boolean),
      ),
    ],
    [items, category],
  );
  const shown = items.filter(
    (x) =>
      (category === 'Semua' || x.category === category) &&
      (brand === 'Semua' || x.brand === brand) &&
      `${x.name} ${x.brand}`.toLowerCase().includes(query.toLowerCase()),
  );
  const countries = [...new Set(items.map((p) => p.country))];
  return (
    <div className="storefront">
      <div className="store-strip">
        JASTIP ASIA CURATED BY ELSEWHERE & CO. · GOOD THINGS, FOUND ELSEWHERE.
      </div>
      <header className="store-header">
        <a className="store-logo" href="/">
          <b>Elsewhere</b>
          <span>& Co.</span>
        </a>
        <div className="store-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk atau brand..."
          />
        </div>
        <a href="/dashboard" className="store-team-link">
          Area tim
        </a>
      </header>
      <nav className="store-nav">
        <button
          className={category === 'Semua' ? 'active' : ''}
          onClick={() => {
            setCategory('Semua');
            setBrand('Semua');
          }}
        >
          New In
        </button>
        {categories
          .filter((x) => x !== 'Semua')
          .map((c) => (
            <div className="nav-category" key={c}>
              <button
                className={category === c ? 'active' : ''}
                onClick={() => {
                  setCategory(c);
                  setBrand('Semua');
                }}
              >
                {c}
                <ChevronDown size={13} />
              </button>
              <div className="brand-menu">
                <b>Brands</b>
                {[
                  'Semua',
                  ...new Set(
                    items
                      .filter((x) => x.category === c)
                      .map((x) => x.brand)
                      .filter(Boolean),
                  ),
                ].map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setCategory(c);
                      setBrand(b);
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </nav>
      <section className="store-hero">
        <div>
          <span>
            <Sparkles size={14} />{' '}
            {countries.length
              ? countries.join(' · ').toUpperCase() + ' EDIT'
              : 'ELSEWHERE EDIT'}
          </span>
          <h1>
            Your Asia wishlist,
            <br />
            found elsewhere.
          </h1>
          <p>
            Curated finds, transparent pricing, and personal shopping made
            beautifully simple.
          </p>
          <a href="#catalogue">Shop the edit</a>
        </div>
        <div className="hero-stamp">
          <small>FIRST DROP</small>
          <strong>PO</strong>
          <span>OPEN EDIT</span>
        </div>
      </section>
      <section className="catalogue-section" id="catalogue">
        <div className="catalogue-title">
          <div>
            <span>THE LATEST EDIT</span>
            <h2>Good things we found</h2>
          </div>
          <p>{shown.length} produk tayang</p>
        </div>
        <div className="mobile-filters">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setBrand('Semua');
            }}
          >
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {brands.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <output>Memuat katalog…</output>
        ) : loadError ? (
          <div className="catalogue-empty" role="alert">
            <p>{loadError}</p>
            <button onClick={load}>Coba lagi</button>
          </div>
        ) : shown.length ? (
          <div className="product-grid">
            {shown.map((p) => {
              const variants = p.product_variants || [];
              const option1Values = [...new Set(variants.map((x) => x.option1_value).filter(Boolean))] as string[];
              const option2Values = [...new Set(variants.filter(x => !selected[p.id]?.option1 || x.option1_value === selected[p.id]?.option1).map((x) => x.option2_value).filter(Boolean))] as string[];
              const selection = selected[p.id];
              const v = variants.find((x) =>
                (!selection?.option1 || x.option1_value === selection.option1) &&
                (!selection?.option2 || x.option2_value === selection.option2),
              ) || variants[0];
              const setOption = (key: 'option1' | 'option2', value: string) => {
                const next = { ...selection, [key]: value };
                if (key === 'option1') {
                  const nextOption2 = variants.find(x => x.option1_value === value)?.option2_value || undefined;
                  next.option2 = nextOption2;
                }
                setSelected((current) => ({ ...current, [p.id]: next }));
              };
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-photo">
                    <ProductPhoto key={`${p.id}-${v?.id || 'default'}`} product={p} variant={v} alt={`${p.name}${v ? ` — ${v.name}` : ''}`}/>

                  </div>
                  <div className="product-copy">
                    <span>{p.brand || 'Elsewhere find'}</span>
                    <h3>{p.name}</h3>
                    {option1Values.length > 0 ? (
                      <div className="product-options">
                        <label>{p.option1_label || 'Pilihan 1'}<select value={selection?.option1 || option1Values[0]} onChange={e => setOption('option1', e.target.value)}>{option1Values.map(value => <option key={value}>{value}</option>)}</select></label>
                        {option2Values.length > 0 && <label>{p.option2_label || 'Pilihan 2'}<select value={selection?.option2 || option2Values[0]} onChange={e => setOption('option2', e.target.value)}>{option2Values.map(value => <option key={value}>{value}</option>)}</select></label>}
                      </div>
                    ) : variants.length > 0 && (
                      <select
                        value={v?.id || ''}
                        onChange={(e) =>
                          setSelected((x) => ({ ...x, [p.id]: { option1: variants.find(variant => variant.id === e.target.value)?.option1_value || undefined, option2: variants.find(variant => variant.id === e.target.value)?.option2_value || undefined } }))
                        }
                      >
                        {variants.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                            {x.available === null ? ' · Preorder tersedia' : ` · ${x.available} ${x.sale_mode === 'stock' ? 'stok' : 'kuota PO'}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <div>
                      <strong>
                        {v?.unit_price_idr
                          ? rupiah(Number(v.unit_price_idr))
                          : 'Harga belum tersedia'}
                      </strong>
                      <small>Termasuk kargo internasional</small>
                    </div>
                    <p className="commerce-help">
                      {p.trip_name}
                      {p.return_date
                        ? ` · Perkiraan kembali ${new Date(p.return_date + 'T00:00:00').toLocaleDateString('id-ID')}`
                        : ''}
                    </p>
                    <button
                      className="commerce-primary"
                      disabled={
                        !!loadError ||
                        !v?.unit_price_idr ||
                        Number(v.unit_price_idr) <= 0 ||
                        (v.available !== null && v.available < 1)
                      }
                      onClick={() => setOrdering({ product: p, variant: v })}
                    >
                      {!v?.unit_price_idr
                        ? 'Menunggu harga'
                        : (v.available !== null && v.available < 1)
                          ? 'Kuota habis'
                          : v.sale_mode === 'stock'
                            ? 'Pesan sekarang'
                            : 'Pesan preorder'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalogue-empty">
            <ShoppingBag />
            <h3>Produknya sedang dikurasi</h3>
            <p>
              Produk tersedia saat trip membuka preorder. Coba kategori lain
              atau kembali lagi nanti.
            </p>
          </div>
        )}
      </section>
      {ordering && (
        <OrderForm
          product={ordering.product}
          variant={ordering.variant}
          onClose={() => setOrdering(null)}
          onSaved={load}
        />
      )}
      <footer><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Kurs oleh ExchangeRate-API</a>
        <div className="store-logo">
          <b>Elsewhere</b>
          <span>& Co.</span>
        </div>
        <p>International personal shopping, starting from Asia.</p>
      </footer>
    </div>
  );
}
