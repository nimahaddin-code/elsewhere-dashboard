import { useEffect, useMemo, useState } from "react";
import { calculatePrice, defaultMargin, isFashion, rupiah } from "../lib/pricing";

type CategoryOption = { name: string; default_margin_percent: number | null };

type Props = {
  country: string;
  currency: string;
  symbol: string;
  rate: number;
  fashionCargo: number;
  otherCargo: number;
  categories: CategoryOption[];
};

const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));

export function PriceCalculator({ country, currency, symbol, rate, fashionCargo, otherCargo, categories }: Props) {
  const [category, setCategory] = useState(categories[0]?.name ?? "Pakaian");
  const [price, setPrice] = useState("");
  const [grams, setGrams] = useState("");
  const [qty, setQty] = useState("1");
  const [margin, setMargin] = useState("");
  const [flatFee, setFlatFee] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!categories.some((c) => c.name === category) && categories[0]) setCategory(categories[0].name);
  }, [categories, category]);

  const categoryMargin = useMemo(
    () => categories.find((c) => c.name === category)?.default_margin_percent ?? defaultMargin(category),
    [categories, category],
  );
  const marginPct = margin === "" ? Number(categoryMargin) : num(margin);
  const quantity = Math.max(1, Math.floor(num(qty)) || 1);
  const cargoPerKg = isFashion(category) ? fashionCargo : otherCargo;

  const unit = calculatePrice({
    localPrice: num(price),
    grams: num(grams),
    category,
    margin: marginPct,
    rate,
    fashionCargo,
    otherCargo,
    flatFee: num(flatFee),
  });
  const ready = unit.sell > 0;
  const marginAmount = unit.capital * (marginPct / 100);

  const copy = async () => {
    const text = `${rupiah(unit.sell)}${quantity > 1 ? ` x${quantity} = ${rupiah(unit.sell * quantity)}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
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
        <small>Cargo {rupiah(cargoPerKg)}/kg</small>
      </div>

      <div className="pc-form">
        <label className="pc-wide">
          Kategori
          <select value={category} onChange={(e) => { setCategory(e.target.value); setMargin(""); }}>
            {categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Harga barang ({currency})
          <input type="number" inputMode="decimal" min={0} placeholder="200" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          Berat (gram)
          <input type="number" inputMode="numeric" min={0} placeholder="350" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </label>
        <label>
          Untung / fee jastip (%)
          <input type="number" inputMode="decimal" min={0} placeholder={String(categoryMargin)} value={margin} onChange={(e) => setMargin(e.target.value)} />
        </label>
        <label>
          Fee tambahan / pcs (Rp)
          <input type="number" inputMode="numeric" min={0} placeholder="0" value={flatFee} onChange={(e) => setFlatFee(e.target.value)} />
        </label>
        <label>
          Jumlah (pcs)
          <input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
      </div>

      <div className="pc-result" aria-live="polite">
        <span>Harga jual / pcs · dibulatkan Rp1.000</span>
        <strong>{ready ? rupiah(unit.sell) : "Rp0"}</strong>
        {ready && quantity > 1 && <p>{quantity} pcs = <b>{rupiah(unit.sell * quantity)}</b></p>}
        <button type="button" onClick={copy} disabled={!ready}>{copied ? "Tersalin ✓" : "Salin harga"}</button>
      </div>

      <dl className="pc-lines">
        <div><dt>Harga barang</dt><dd>{rupiah(unit.productCost)}</dd></div>
        <div><dt>Cargo {num(grams)}g</dt><dd>{rupiah(unit.cargo)}</dd></div>
        <div className="pc-sub"><dt>Modal</dt><dd>{rupiah(unit.capital)}</dd></div>
        <div><dt>Untung {marginPct}%</dt><dd>{rupiah(marginAmount)}</dd></div>
        <div><dt>Fee tambahan</dt><dd>{rupiah(num(flatFee))}</dd></div>
        <div><dt>Pembulatan</dt><dd>{rupiah(Math.max(0, unit.profit - marginAmount - num(flatFee)))}</dd></div>
        <div className="pc-sub"><dt>Total untung / pcs</dt><dd>{rupiah(unit.profit)}</dd></div>
        {quantity > 1 && <div className="pc-sub"><dt>Total untung {quantity} pcs</dt><dd>{rupiah(unit.profit * quantity)}</dd></div>}
      </dl>
    </section>
  );
}
