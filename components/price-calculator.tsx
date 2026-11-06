import { useEffect, useMemo, useState } from "react";
import {
  SHIPPING_PER_10KG,
  calculatePrice,
  defaultMargin,
  rupiah,
  shippingPerKg,
  type ShippingMode,
} from "../lib/pricing";

type CategoryOption = { name: string; default_margin_percent: number | null };

type Props = {
  country: string;
  currency: string;
  symbol: string;
  rate: number;
  categories: CategoryOption[];
};

type OrderLine = {
  id: string;
  name: string;
  category: string;
  mode: ShippingMode;
  localPrice: number;
  grams: number;
  qty: number;
  unitCapital: number;
  unitSell: number;
};
type ManualOrder = { id: string | null; customer: string; lines: OrderLine[] };
type SavedOrder = { id: string; customer: string; lines: OrderLine[]; savedAt: string };

const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Calculator inputs and manual orders live in localStorage so they survive the
// PWA being killed in the background (sessionStorage does not).
function useStored<T>(key: string, read: (saved: unknown) => T, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? read(JSON.parse(saved)) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const orderTotals = (lines: OrderLine[]) =>
  lines.reduce(
    (t, l) => ({
      pcs: t.pcs + l.qty,
      grams: t.grams + l.grams * l.qty,
      sell: t.sell + l.unitSell * l.qty,
      profit: t.profit + (l.unitSell - l.unitCapital) * l.qty,
    }),
    { pcs: 0, grams: 0, sell: 0, profit: 0 },
  );

const emptyOrder: ManualOrder = { id: null, customer: "", lines: [] };

export function PriceCalculator({ country, currency, symbol, rate, categories }: Props) {
  const initialForm = {
    category: categories[0]?.name ?? "Pakaian",
    name: "",
    price: "",
    grams: "",
    qty: "1",
    margin: "",
    flatFee: "",
    mode: "paket" as ShippingMode,
  };
  const [form, setForm] = useStored("elsewhere-calculator", (s) => ({ ...initialForm, ...(s as object) }), initialForm);
  const [order, setOrder] = useStored("elsewhere-manual-order", (s) => ({ ...emptyOrder, ...(s as object) }), emptyOrder);
  const [savedOrders, setSavedOrders] = useStored<SavedOrder[]>("elsewhere-manual-orders", (s) => (Array.isArray(s) ? s : []), []);
  const [copied, setCopied] = useState<"price" | "order" | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const { category, name, price, grams, qty, margin, flatFee, mode } = form;

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.name === category)) setForm((f) => ({ ...f, category: categories[0].name }));
  }, [categories, category, setForm]);

  const categoryMargin = useMemo(
    () => categories.find((c) => c.name === category)?.default_margin_percent ?? defaultMargin(category),
    [categories, category],
  );
  const marginPct = margin === "" ? Number(categoryMargin) : num(margin);
  const quantity = Math.max(1, Math.floor(num(qty)) || 1);
  const cargoPerKg = rate > 0 ? shippingPerKg(mode, rate) : 0;

  const unit = calculatePrice({
    localPrice: num(price),
    grams: num(grams),
    category,
    margin: marginPct,
    rate,
    fashionCargo: 0,
    otherCargo: 0,
    flatFee: num(flatFee),
    cargoPerKg,
  });
  const ready = unit.sell > 0;
  const marginAmount = unit.capital * (marginPct / 100);
  const totals = orderTotals(order.lines);

  const copyText = async (text: string, what: "price" | "order") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const addToOrder = () => {
    if (!ready) return;
    const line: OrderLine = {
      id: newId(),
      name: name.trim() || `${category} ${order.lines.length + 1}`,
      category,
      mode,
      localPrice: num(price),
      grams: num(grams),
      qty: quantity,
      unitCapital: unit.capital,
      unitSell: unit.sell,
    };
    setOrder((o) => ({ ...o, lines: [...o.lines, line] }));
    set({ name: "", price: "", grams: "", qty: "1" });
  };
  const updateLine = (id: string, patch: Partial<OrderLine>) =>
    setOrder((o) => ({ ...o, lines: o.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id: string) => setOrder((o) => ({ ...o, lines: o.lines.filter((l) => l.id !== id) }));

  const orderText = () =>
    [
      `Order${order.customer.trim() ? ` ${order.customer.trim()}` : ""}`,
      ...order.lines.map((l, i) => `${i + 1}. ${l.name} x${l.qty} @ ${rupiah(l.unitSell)} = ${rupiah(l.unitSell * l.qty)}`),
      `Total ${totals.pcs} pcs: ${rupiah(totals.sell)}`,
    ].join("\n");

  const saveOrder = () => {
    if (!order.lines.length) return;
    const id = order.id ?? newId();
    const saved: SavedOrder = { id, customer: order.customer.trim(), lines: order.lines, savedAt: new Date().toISOString() };
    setSavedOrders((list) => [saved, ...list.filter((o) => o.id !== id)]);
    setOrder(emptyOrder);
  };
  const clearOrder = () => {
    if (!window.confirm(order.id ? "Tutup order ini? Perubahan yang belum disimpan hilang." : "Kosongkan order ini? Produk yang belum disimpan akan hilang.")) return;
    setOrder(emptyOrder);
  };
  const openSaved = (saved: SavedOrder) => {
    if (order.lines.length && order.id !== saved.id && !window.confirm("Order yang sedang dibuat belum disimpan. Ganti dengan order ini?")) return;
    setOrder({ id: saved.id, customer: saved.customer, lines: saved.lines });
  };
  const deleteSaved = (saved: SavedOrder) => {
    if (!window.confirm(`Hapus order ${saved.customer || "tanpa nama"}?`)) return;
    setSavedOrders((list) => list.filter((o) => o.id !== saved.id));
    if (order.id === saved.id) setOrder((o) => ({ ...o, id: null }));
  };

  return (
    <section className="pc">
      <header className="pc-head">
        <span>Kalkulator harga</span>
        <h2>Estimasi harga jual</h2>
        <p>Lihat barang di toko, isi harga &amp; berat, langsung tahu harga jual ke customer.</p>
      </header>

      <div className="pc-rate">
        <span>Kurs {country}</span>
        <b>{rate > 0 ? `${symbol}1 = Rp${rate.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "Memuat kurs…"}</b>
        <small>Ongkir {rupiah(cargoPerKg)}/kg</small>
      </div>

      <fieldset className="pc-mode" aria-label="Pengiriman">
        {(Object.keys(SHIPPING_PER_10KG) as ShippingMode[]).map((m) => {
          const s = SHIPPING_PER_10KG[m];
          return (
            <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? "active" : ""} onClick={() => set({ mode: m })}>
              <b>{s.label}</b>
              <small>{s.inLocalCurrency ? `${symbol}${s.amount}` : rupiah(s.amount)}/10kg</small>
            </button>
          );
        })}
      </fieldset>

      <div className="pc-form">
        <label className="pc-wide">
          Kategori
          <select value={category} onChange={(e) => set({ category: e.target.value, margin: "" })}>
            {categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="pc-wide">
          Nama barang
          <input type="text" placeholder="Opsional" value={name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          Harga barang ({currency})
          <input type="number" inputMode="decimal" min={0} placeholder="200" value={price} onChange={(e) => set({ price: e.target.value })} />
        </label>
        <label>
          Berat (gram)
          <input type="number" inputMode="numeric" min={0} placeholder="350" value={grams} onChange={(e) => set({ grams: e.target.value })} />
        </label>
        <label>
          Untung (%)
          <input type="number" inputMode="decimal" min={0} placeholder={String(categoryMargin)} value={margin} onChange={(e) => set({ margin: e.target.value })} />
        </label>
        <label>
          Fee tambahan (Rp)
          <input type="number" inputMode="numeric" min={0} placeholder="0" value={flatFee} onChange={(e) => set({ flatFee: e.target.value })} />
        </label>
        <label>
          Jumlah (pcs)
          <input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => set({ qty: e.target.value })} />
        </label>
      </div>

      <div className="pc-result" aria-live="polite">
        <span>Harga jual / pcs · dibulatkan Rp1.000</span>
        <strong>{ready ? rupiah(unit.sell) : "Rp0"}</strong>
        {ready && quantity > 1 && <p>{quantity} pcs = <b>{rupiah(unit.sell * quantity)}</b></p>}
        <div className="pc-actions">
          <button type="button" onClick={() => copyText(`${rupiah(unit.sell)}${quantity > 1 ? ` x${quantity} = ${rupiah(unit.sell * quantity)}` : ""}`, "price")} disabled={!ready}>
            {copied === "price" ? "Tersalin ✓" : "Salin harga"}
          </button>
          <button type="button" onClick={addToOrder} disabled={!ready}>+ Tambah ke order</button>
        </div>
      </div>

      <dl className="pc-lines">
        <div><dt>Harga barang</dt><dd>{rupiah(unit.productCost)}</dd></div>
        <div><dt>Ongkir {SHIPPING_PER_10KG[mode].label.toLowerCase()} {num(grams)}g</dt><dd>{rupiah(unit.cargo)}</dd></div>
        <div className="pc-sub"><dt>Modal</dt><dd>{rupiah(unit.capital)}</dd></div>
        <div><dt>Untung {marginPct}%</dt><dd>{rupiah(marginAmount)}</dd></div>
        <div><dt>Fee tambahan</dt><dd>{rupiah(num(flatFee))}</dd></div>
        <div><dt>Pembulatan</dt><dd>{rupiah(Math.max(0, unit.profit - marginAmount - num(flatFee)))}</dd></div>
        <div className="pc-sub"><dt>Total untung / pcs</dt><dd>{rupiah(unit.profit)}</dd></div>
        {quantity > 1 && <div className="pc-sub"><dt>Total untung {quantity} pcs</dt><dd>{rupiah(unit.profit * quantity)}</dd></div>}
      </dl>

      <section className="pc-order" aria-label="Order manual">
        <header>
          <h3>Order manual{order.id ? " · diedit" : ""}</h3>
          <small>{order.lines.length} produk</small>
        </header>
        <label className="pc-customer">
          Customer
          <input type="text" placeholder="Nama / no. WA" value={order.customer} onChange={(e) => setOrder((o) => ({ ...o, customer: e.target.value }))} />
        </label>
        {order.lines.length === 0 ? (
          <p className="pc-empty">Hitung harga di atas lalu tekan “Tambah ke order”. Satu order bisa banyak produk.</p>
        ) : (
          <ul className="pc-order-lines">
            {order.lines.map((l) => (
              <li key={l.id}>
                <div className="pc-line-head">
                  <input aria-label="Nama barang" value={l.name} onChange={(e) => updateLine(l.id, { name: e.target.value })} />
                  <button type="button" aria-label={`Hapus ${l.name}`} onClick={() => removeLine(l.id)}>×</button>
                </div>
                <small>{l.category} · {l.grams}g · {SHIPPING_PER_10KG[l.mode].label} · modal {rupiah(l.unitCapital)}</small>
                <div className="pc-line-edit">
                  <div className="pc-qty">
                    <button type="button" aria-label="Kurangi" onClick={() => updateLine(l.id, { qty: Math.max(1, l.qty - 1) })}>−</button>
                    <span>{l.qty}</span>
                    <button type="button" aria-label="Tambah" onClick={() => updateLine(l.id, { qty: l.qty + 1 })}>+</button>
                  </div>
                  <label>
                    Rp
                    <input type="number" inputMode="numeric" min={0} aria-label="Harga jual per pcs" value={l.unitSell || ""} onChange={(e) => updateLine(l.id, { unitSell: num(e.target.value) })} />
                  </label>
                  <b>{rupiah(l.unitSell * l.qty)}</b>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(order.lines.length > 0 || order.id) && (
          <>
            {order.lines.length > 0 && (
              <dl className="pc-lines">
                <div className="pc-sub"><dt>Total {totals.pcs} pcs · {(totals.grams / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</dt><dd>{rupiah(totals.sell)}</dd></div>
                <div><dt>Total untung</dt><dd>{rupiah(totals.profit)}</dd></div>
              </dl>
            )}
            <div className="pc-order-actions">
              <button type="button" onClick={() => copyText(orderText(), "order")} disabled={!order.lines.length}>{copied === "order" ? "Tersalin ✓" : "Salin rincian"}</button>
              <button type="button" className="primary" onClick={saveOrder} disabled={!order.lines.length}>Simpan order</button>
              <button type="button" className="ghost" onClick={clearOrder}>{order.id ? "Tutup" : "Kosongkan"}</button>
            </div>
          </>
        )}
      </section>

      {savedOrders.length > 0 && (
        <section className="pc-order" aria-label="Order tersimpan">
          <header><h3>Order tersimpan</h3><small>{savedOrders.length}</small></header>
          <ul className="pc-saved">
            {savedOrders.map((s) => {
              const t = orderTotals(s.lines);
              return (
                <li key={s.id} className={order.id === s.id ? "active" : ""}>
                  <button type="button" className="pc-saved-main" onClick={() => openSaved(s)}>
                    <b>{s.customer || "Tanpa nama"}</b>
                    <small>{t.pcs} pcs · {new Date(s.savedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                  </button>
                  <span>{rupiah(t.sell)}</span>
                  <button type="button" aria-label={`Hapus order ${s.customer || "tanpa nama"}`} onClick={() => deleteSaved(s)}>×</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
