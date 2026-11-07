import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { parseDecimal } from "../lib/pricing";
import {
  SHIPPING_RATES,
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
  tripCode: string;
  onOrderPlaced: (orderId: string) => void;
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
// `id` is set when a legacy device-only draft is reopened; `requestId` makes a
// retried save idempotent and is renewed whenever the draft changes.
type ManualOrder = { id: string | null; requestId: string; customer: string; phone: string; address: string; extraShipping: number; lines: OrderLine[] };
type SavedOrder = { id: string; customer: string; lines: OrderLine[]; savedAt: string };

const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Calculator inputs and manual orders live in localStorage so they survive the
// PWA being killed in the background (sessionStorage does not). Writes happen in
// the setter, not an effect. A plain value is written immediately, so it lands even
// when the calculator unmounts in the same render (saving switches to the Orders tab).
function useStored<T>(key: string, read: (saved: unknown) => T, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? read(JSON.parse(saved)) : initial;
    } catch {
      return initial;
    }
  });
  const write = (next: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const setStored = (update: T | ((prev: T) => T)) => {
    if (typeof update !== "function") {
      write(update);
      setValue(update);
      return;
    }
    setValue((prev) => {
      const next = (update as (prev: T) => T)(prev);
      write(next);
      return next;
    });
  };
  return [value, setStored] as const;
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

const newOrder = (): ManualOrder => ({ id: null, requestId: crypto.randomUUID(), customer: "", phone: "", address: "", extraShipping: 0, lines: [] });
const MAX_QTY = 20;

export function PriceCalculator({ country, currency, symbol, rate, categories, tripCode, onOrderPlaced }: Props) {
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
  const [order, setStoredOrder] = useStored("elsewhere-manual-order", (s) => ({ ...newOrder(), ...(s as object) }), newOrder());
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const setOrder = (fn: (o: ManualOrder) => ManualOrder) => setStoredOrder((o) => ({ ...fn(o), requestId: crypto.randomUUID() }));
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
    localPrice: parseDecimal(price),
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
  // Domestic shipping outside Bali, entered by hand; passed through at cost (no margin).
  const extraShipping = order.extraShipping || 0;
  const grandTotal = totals.sell + extraShipping;

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
      localPrice: parseDecimal(price),
      grams: num(grams),
      qty: Math.min(MAX_QTY, quantity),
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
      ...(extraShipping > 0 ? [`Ongkir luar Bali: ${rupiah(extraShipping)}`] : []),
      `Total ${totals.pcs} pcs: ${rupiah(grandTotal)}`,
    ].join("\n");

  const phoneDigits = order.phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length === 0 || (phoneDigits.length >= 9 && phoneDigits.length <= 15);
  const canPlace = order.lines.length > 0 && order.customer.trim().length >= 2 && phoneOk && order.lines.every((l) => l.unitSell > 0 && l.name.trim());
  const placeOrder = async () => {
    if (!canPlace || placing) return;
    setPlacing(true);
    setPlaceError("");
    const { data, error } = await supabase.rpc("commerce_place_manual_order", {
      p_request_id: order.requestId,
      p_trip_code: tripCode,
      p_items: [
        ...order.lines.map((l) => ({
          name: l.name.trim(),
          quantity: l.qty,
          unit_price: l.unitSell,
          snapshot: { category: l.category, shipping_mode: l.mode, local_price: l.localPrice, grams: l.grams, unit_capital: l.unitCapital, rate },
        })),
        ...(extraShipping > 0 ? [{ name: "Ongkir luar Bali", quantity: 1, unit_price: extraShipping, snapshot: { type: "domestic_shipping" } }] : []),
      ],
      p_name: order.customer.trim(),
      p_phone: order.phone,
      p_address: order.address,
    });
    setPlacing(false);
    if (error || !data?.order_id) {
      setPlaceError(error?.message || "Order belum tersimpan. Coba lagi.");
      return;
    }
    if (order.id) setSavedOrders(savedOrders.filter((o) => o.id !== order.id));
    // Ready for the next customer: clear the order and item inputs, keep category and shipping mode.
    setStoredOrder(newOrder());
    setForm({ ...initialForm, category, mode });
    onOrderPlaced(data.order_id);
  };
  const clearOrder = () => {
    if (order.lines.length && !window.confirm("Kosongkan order ini? Produk yang belum disimpan akan hilang.")) return;
    setStoredOrder(newOrder());
    setPlaceError("");
  };
  const openSaved = (saved: SavedOrder) => {
    if (order.lines.length && order.id !== saved.id && !window.confirm("Order yang sedang dibuat belum disimpan. Ganti dengan order ini?")) return;
    setOrder(() => ({ ...newOrder(), id: saved.id, customer: saved.customer, lines: saved.lines }));
  };
  const deleteSaved = (saved: SavedOrder) => {
    if (!window.confirm(`Hapus order ${saved.customer || "tanpa nama"}?`)) return;
    setSavedOrders((list) => list.filter((o) => o.id !== saved.id));
    if (order.id === saved.id) setStoredOrder((o) => ({ ...o, id: null }));
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
        {(Object.keys(SHIPPING_RATES) as ShippingMode[]).map((m) => {
          const s = SHIPPING_RATES[m];
          return (
            <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? "active" : ""} onClick={() => set({ mode: m })}>
              <b>{s.label}</b>
              <small>{s.inLocalCurrency ? `${symbol}${s.amount}` : rupiah(s.amount)}/{s.perKg === 1 ? "kg" : `${s.perKg}kg`}</small>
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
          <input type="text" inputMode="decimal" placeholder="14,90" value={price} onChange={(e) => set({ price: e.target.value })} />
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
        <div><dt>Ongkir {SHIPPING_RATES[mode].label.toLowerCase()} {num(grams)}g</dt><dd>{rupiah(unit.cargo)}</dd></div>
        <div className="pc-sub"><dt>Modal</dt><dd>{rupiah(unit.capital)}</dd></div>
        <div><dt>Untung {marginPct}%</dt><dd>{rupiah(marginAmount)}</dd></div>
        <div><dt>Fee tambahan</dt><dd>{rupiah(num(flatFee))}</dd></div>
        <div><dt>Pembulatan</dt><dd>{rupiah(Math.max(0, unit.profit - marginAmount - num(flatFee)))}</dd></div>
        <div className="pc-sub"><dt>Total untung / pcs</dt><dd>{rupiah(unit.profit)}</dd></div>
        {quantity > 1 && <div className="pc-sub"><dt>Total untung {quantity} pcs</dt><dd>{rupiah(unit.profit * quantity)}</dd></div>}
      </dl>

      <section className="pc-order" aria-label="Order manual">
        <header>
          <h3>Order manual</h3>
          <small>{order.lines.length} produk</small>
        </header>
        <div className="pc-customer-fields">
          <label className="pc-customer">
            Nama customer
            <input type="text" autoComplete="off" placeholder="Bu Sari" value={order.customer} onChange={(e) => setOrder((o) => ({ ...o, customer: e.target.value }))} />
          </label>
          <label className="pc-customer">
            No. WhatsApp (opsional)
            <input type="tel" inputMode="tel" autoComplete="off" placeholder="Opsional" value={order.phone} onChange={(e) => setOrder((o) => ({ ...o, phone: e.target.value }))} />
          </label>
          <label className="pc-customer pc-wide">
            Lokasi / alamat (opsional)
            <input type="text" autoComplete="off" placeholder="Ubud, Denpasar, atau alamat lengkap" value={order.address} onChange={(e) => setOrder((o) => ({ ...o, address: e.target.value }))} />
          </label>
        </div>
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
                <small>{l.category} · {l.grams}g · {SHIPPING_RATES[l.mode].label} · modal {rupiah(l.unitCapital)}</small>
                <div className="pc-line-edit">
                  <div className="pc-qty">
                    <button type="button" aria-label="Kurangi" onClick={() => updateLine(l.id, { qty: Math.max(1, l.qty - 1) })}>−</button>
                    <span>{l.qty}</span>
                    <button type="button" aria-label="Tambah" disabled={l.qty >= MAX_QTY} onClick={() => updateLine(l.id, { qty: Math.min(MAX_QTY, l.qty + 1) })}>+</button>
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
        {order.lines.length > 0 && (
          <>
            <label className="pc-customer">
              Ongkir tambahan luar Bali (Rp)
              <input type="number" inputMode="numeric" min={0} placeholder="0 — kosongkan kalau di Bali" value={order.extraShipping || ""} onChange={(e) => setOrder((o) => ({ ...o, extraShipping: num(e.target.value) }))} />
            </label>
            <dl className="pc-lines">
              {extraShipping > 0 && <div><dt>Subtotal barang</dt><dd>{rupiah(totals.sell)}</dd></div>}
              {extraShipping > 0 && <div><dt>Ongkir luar Bali</dt><dd>{rupiah(extraShipping)}</dd></div>}
              <div className="pc-sub"><dt>Total {totals.pcs} pcs · {(totals.grams / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</dt><dd>{rupiah(grandTotal)}</dd></div>
              <div><dt>Total untung</dt><dd>{rupiah(totals.profit)}</dd></div>
            </dl>
            {!canPlace && <p className="pc-hint">{phoneOk ? "Isi nama customer untuk menyimpan ke Orders." : "No. WhatsApp harus 9-15 digit, atau kosongkan."}</p>}
            {placeError && <p className="pc-error" role="alert">{placeError}</p>}
            <div className="pc-order-actions">
              <button type="button" onClick={() => copyText(orderText(), "order")}>{copied === "order" ? "Tersalin ✓" : "Salin rincian"}</button>
              <button type="button" className="primary" onClick={placeOrder} disabled={!canPlace || placing}>{placing ? "Menyimpan…" : "Simpan ke Orders"}</button>
              <button type="button" className="ghost" onClick={clearOrder}>Kosongkan</button>
            </div>
          </>
        )}
      </section>

      {savedOrders.length > 0 && (
        <section className="pc-order" aria-label="Order tersimpan">
          <header><h3>Draft lama di HP ini</h3><small>Buka lalu simpan ke Orders</small></header>
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
