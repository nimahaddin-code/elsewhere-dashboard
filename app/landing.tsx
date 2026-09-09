import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type PublicProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  photo_url: string;
  product_type: string;
  currency_code: string;
  currency_symbol: string;
  fashion_cargo_per_kg: number;
  nonfashion_cargo_per_kg: number;
  product_variants: Array<{
    id: string;
    name: string;
    local_price: number;
    weight_grams: number;
    stock: number;
  }>;
};
const marginFor = (category: string) =>
  /makanan|food|snack|minuman/i.test(category) ? 20 : 25;
const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Landing() {
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("Semua");
  const [brand, setBrand] = useState("Semua");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select(
        "id,name,brand,category,photo_url,product_type,currency_code,currency_symbol,fashion_cargo_per_kg,nonfashion_cargo_per_kg,product_variants(id,name,local_price,weight_grams,stock)",
      )
      .eq("published", true)
      .order("approved_at", { ascending: false });
    setItems((data || []) as PublicProduct[]);
  };
  useEffect(() => {
    load();
    const channel = supabase
      .channel("public-catalogue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    const currencies = [...new Set(items.map((x) => x.currency_code))];
    Promise.all(
      currencies.map(async (code) => {
        try {
          const r = await fetch(`https://open.er-api.com/v6/latest/${code}`);
          const d: any = await r.json();
          return [code, Number(d.rates?.IDR) || 0] as const;
        } catch {
          return [code, 0] as const;
        }
      }),
    ).then((x) => setRates(Object.fromEntries(x)));
  }, [items]);
  const categories = useMemo(
    () => ["Semua", ...new Set(items.map((x) => x.category))],
    [items],
  );
  const brands = useMemo(
    () => [
      "Semua",
      ...new Set(
        items
          .filter((x) => category === "Semua" || x.category === category)
          .map((x) => x.brand)
          .filter(Boolean),
      ),
    ],
    [items, category],
  );
  const shown = items.filter(
    (x) =>
      (category === "Semua" || x.category === category) &&
      (brand === "Semua" || x.brand === brand) &&
      `${x.name} ${x.brand}`.toLowerCase().includes(query.toLowerCase()),
  );
  const price = (
    p: PublicProduct,
    v: PublicProduct["product_variants"][number],
  ) => {
    const goods = Number(v.local_price) * (rates[p.currency_code] || 0);
    const cargo =
      (Number(v.weight_grams) / 1000) *
      (p.category === "Fashion"
        ? Number(p.fashion_cargo_per_kg)
        : Number(p.nonfashion_cargo_per_kg));
    const capital = goods + cargo;
    return capital * (1 + marginFor(p.category) / 100);
  };
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
        <div className="store-actions">
          <Heart />
          <ShoppingBag />
        </div>
      </header>
      <nav className="store-nav">
        <button
          className={category === "Semua" ? "active" : ""}
          onClick={() => {
            setCategory("Semua");
            setBrand("Semua");
          }}
        >
          New In
        </button>
        {categories
          .filter((x) => x !== "Semua")
          .map((c) => (
            <div className="nav-category" key={c}>
              <button
                className={category === c ? "active" : ""}
                onClick={() => {
                  setCategory(c);
                  setBrand("Semua");
                }}
              >
                {c}
                <ChevronDown size={13} />
              </button>
              <div className="brand-menu">
                <b>Brands</b>
                {[
                  "Semua",
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
            <Sparkles size={14} /> MALAYSIA EDIT
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
          <strong>MY</strong>
          <span>2026</span>
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
              setBrand("Semua");
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
        {shown.length ? (
          <div className="product-grid">
            {shown.map((p) => {
              const variants = p.product_variants || [];
              const v =
                variants.find((x) => x.id === selected[p.id]) || variants[0];
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-photo">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} />
                    ) : (
                      <div>
                        <ShoppingBag />
                        <span>Photo coming soon</span>
                      </div>
                    )}
                    <button aria-label="Simpan">
                      <Heart size={17} />
                    </button>
                  </div>
                  <div className="product-copy">
                    <span>{p.brand || "Elsewhere find"}</span>
                    <h3>{p.name}</h3>
                    {variants.length > 0 && (
                      <select
                        value={v?.id || ""}
                        onChange={(e) =>
                          setSelected((x) => ({ ...x, [p.id]: e.target.value }))
                        }
                      >
                        {variants.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                            {x.weight_grams ? ` · ${x.weight_grams}g` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <div>
                      <strong>
                        {v && rates[p.currency_code]
                          ? rupiah(price(p, v))
                          : "Menghitung harga..."}
                      </strong>
                      <small>
                        {marginFor(p.category)}% margin · cargo included
                      </small>
                    </div>
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
              Produk baru akan muncul di sini setelah disetujui tim Elsewhere.
            </p>
          </div>
        )}
      </section>
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
