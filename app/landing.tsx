import { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

import type {
  CatalogueProduct as PublicProduct,
} from '../lib/commerce';
import { rupiah } from '../lib/pricing';
import ProductPhoto from '../components/product-photo';
import { CartButton, CartDialog, ProductDetail, CheckoutDialog, type CartItem } from '../components/storefront-commerce';

export default function Landing() {
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [detailProduct, setDetailProduct] = useState<PublicProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const [cartFeedback, setCartFeedback] = useState('');
  const [category, setCategory] = useState('Semua');
  const [brand, setBrand] = useState('Semua');
  const [query, setQuery] = useState('');
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const addToCart = (item: CartItem) => {
    setCart((current) => {
      const existing = current.findIndex((value) => value.variant.id === item.variant.id);
      if (existing < 0) return [...current, item];
      return current.map((value, index) => index === existing ? { ...value, quantity: value.quantity + item.quantity } : value);
    });
    setCartPulse(true);
    setCartFeedback(`${item.product.name} masuk ke keranjang`);
    window.setTimeout(() => setCartPulse(false), 650);
    window.setTimeout(() => setCartFeedback(''), 2400);
  };
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
  return (
    <div className="storefront">
      <div className="store-strip">CURATED FINDS FROM ASIA · PERSONAL SHOPPING, MADE SIMPLE</div>
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
        <CartButton count={cartCount} pulse={cartPulse} onClick={() => setCartOpen(true)} />
      </header>
      {cartFeedback && <div className="cart-feedback" role="status"><ShoppingBag size={15} /> {cartFeedback}</div>}
      <section className="store-hero">
        <div>
          <span>
            <span className="malaysia-flag" role="img" aria-label="Bendera Malaysia">🇲🇾</span>
            KUALA LUMPUR, MALAYSIA
          </span>
          <h1>
            Finds worth
            <br />
            bringing home.
          </h1>
          <p>
            Temukan produk pilihan dari perjalanan kami, dengan harga yang jelas
            dan proses pemesanan yang mudah.
          </p>
          <a href="#catalogue">Jelajahi katalog</a>
        </div>
        <div className="hero-visual" aria-label="Pilihan produk dari Kuala Lumpur">
          {items.slice(0, 3).map((product, index) => (
            <div className={`hero-product hero-product-${index + 1}`} key={product.id}>
              <ProductPhoto product={product} variant={product.product_variants?.[0]} alt="" />
            </div>
          ))}
          <span className="hero-visual-label">KUALA LUMPUR<br /><b>FIELD NOTES 01</b></span>
        </div>
      </section>
      <section className="catalogue-section" id="catalogue">
        <div className="catalogue-title">
          <div>
            <span>THE CATALOGUE</span>
            <h2>Good things, found elsewhere</h2>
          </div>
          <p>{shown.length} produk tersedia</p>
        </div>
        <div className="catalogue-filters-public">
          <div className="filter-heading"><SlidersHorizontal size={16} /><span>Filter produk</span></div>
          <label>Kategori<select value={category} onChange={(e) => { setCategory(e.target.value); setBrand('Semua'); }}>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Brand<select value={brand} onChange={(e) => setBrand(e.target.value)}>{brands.map((x) => <option key={x}>{x}</option>)}</select></label>
          {(category !== 'Semua' || brand !== 'Semua' || query) && <button className="clear-filters" onClick={() => { setCategory('Semua'); setBrand('Semua'); setQuery(''); }}><X size={14} /> Hapus filter</button>}
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
              const v = variants[0];
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-photo">
                    <ProductPhoto key={`${p.id}-${v?.id || 'default'}`} product={p} variant={v} alt={`${p.name}${v ? ` — ${v.name}` : ''}`}/>

                  </div>
                  <div className="product-copy">
                    <span>{p.brand || 'Elsewhere find'}</span>
                    <h3>{p.name}</h3>
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
                      onClick={() => setDetailProduct(p)}
                    >
                      {!v?.unit_price_idr
                        ? 'Menunggu harga'
                        : (v.available !== null && v.available < 1)
                          ? 'Kuota habis'
                          : v.sale_mode === 'stock'
                            ? 'Pesan sekarang'
                            : 'Pesan pre order'}
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
              Produk tersedia saat trip membuka pre order. Coba kategori lain
              atau kembali lagi nanti.
            </p>
          </div>
        )}
      </section>
      {detailProduct && <ProductDetail product={detailProduct} onClose={() => setDetailProduct(null)} onAdd={addToCart} />}
      {cartOpen && <CartDialog items={cart} onClose={() => setCartOpen(false)} onChange={setCart} onCheckout={() => { setCheckoutItems(cart); setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <CheckoutDialog items={checkoutItems} onClose={() => { setCheckoutOpen(false); setCheckoutItems([]); }} onComplete={() => { setCart([]); void load(); }} onFinished={() => setCheckoutItems([])} />}
      <footer>
        <div className="store-logo">
          <b>Elsewhere</b>
          <span>& Co.</span>
        </div>
        <p>International personal shopping, starting from Asia.</p>
      </footer>
    </div>
  );
}
