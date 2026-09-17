"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, Image as ImageIcon, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { contentPlanConfig, contentPlanSlots } from "../lib/content-plan-data";
import { findContentSlot, generateContent, type ContentPeriod, type ContentStatus, type GeneratedContent } from "../lib/content-generator";

type Product = {
  id: string; name: string; brand?: string | null; category: string; product_type?: string | null;
  color?: string | null; size?: string | null; material?: string | null; notes?: string | null;
  photo_url?: string | null; local_price: number; price_thb: number; weight_grams: number; margin_percent: number | null;
};
type Variant = { id: string; product_id: string; name: string; option1_value?: string | null; option2_value?: string | null; photo_url?: string | null; local_price: number; weight_grams: number; active: boolean };

const storageKey = "elsewhere-content-drafts-v1";
const statusOrder: ContentStatus[] = ["Planned", "Product Selected", "Generated", "Needs Review", "Ready", "Posted", "Skipped"];
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

export default function ContentPlanGenerator({ products, sellingPrice, tripCountry }: {
  products: Product[];
  sellingPrice: (product: Product, variant?: Variant) => number;
  tripCountry?: string;
}) {
  const [date, setDate] = useState<string>(contentPlanConfig.planStart);
  const [period, setPeriod] = useState<ContentPeriod>("Siang");
  const [times, setTimes] = useState<Record<ContentPeriod, string>>({ Siang: "12:00", Malam: "20:00" });
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantId, setVariantId] = useState("");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [saved, setSaved] = useState<Record<string, GeneratedContent>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      setSaved(parsed);
      const savedTimes = JSON.parse(localStorage.getItem("elsewhere-content-times") || "null");
      if (savedTimes) setTimes(savedTimes);
    } catch { /* ignore invalid local cache */ }
  }, []);

  useEffect(() => {
    if (!productId) { setVariants([]); setVariantId(""); return; }
    let live = true;
    void supabase.from("product_variants").select("id,product_id,name,option1_value,option2_value,photo_url,local_price,weight_grams,active").eq("product_id", productId).eq("active", true).order("created_at").then(({ data }) => {
      if (!live) return;
      const rows = (data || []) as Variant[];
      setVariants(rows);
      setVariantId(rows[0]?.id || "");
    });
    return () => { live = false; };
  }, [productId]);

  const slot = useMemo(() => findContentSlot(date, period), [date, period]);
  const product = products.find((item) => item.id === productId) || null;
  const variant = variants.find((item) => item.id === variantId) || null;
  const selectedPrice = product ? sellingPrice(product, variant || undefined) : 0;
  const eligibleProducts = useMemo(() => {
    if (!slot || slot.category === "Semua") return products;
    const q = slot.category.toLowerCase();
    const aliases: Record<string, RegExp> = { beauty: /beauty|skincare|makeup|kosmetik|kecantikan/, fashion: /fashion|pakaian|baju|hijab|shawl/, snacks: /snack|makanan|minuman/, accessories: /accessor|aksesor/, lifestyle: /lifestyle|rumah|home/ };
    return products.filter((item) => aliases[q]?.test(item.category.toLowerCase()) ?? item.category.toLowerCase().includes(q));
  }, [products, slot]);

  const persist = (next: Record<string, GeneratedContent>) => {
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const generate = (force = false) => {
    if (!slot || !product) return;
    const selected = variant || { id: null, name: "Default", option1_value: null, option2_value: null, photo_url: null, price_idr: selectedPrice };
    const draft = generateContent({
      slot,
      time: times[period],
      product: { ...product, description: product.notes, verified_short_fact: product.notes?.trim() || null },
      variant: { ...selected, id: selected.id, price_idr: selectedPrice },
    });
    const existing = saved[draft.generation_key];
    const finalResult = !force && existing ? existing : draft;
    if (!existing || force) persist({ ...saved, [draft.generation_key]: finalResult });
    setResult(finalResult);
  };
  const changeStatus = (status: ContentStatus) => {
    if (!result || status === "Posted" && !result.ready_to_publish) return;
    const nextResult = { ...result, status };
    setResult(nextResult);
    persist({ ...saved, [nextResult.generation_key]: nextResult });
  };
  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id); window.setTimeout(() => setCopied(""), 1600);
  };
  const copyImage = async () => {
    if (!result?.raw_product_image.reference) return;
    try {
      const blob = await fetch(result.raw_product_image.reference).then((response) => response.blob());
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied("image");
    } catch { window.open(result.raw_product_image.reference, "_blank", "noopener,noreferrer"); }
  };

  return <section className="content-studio">
    <div className="content-hero">
      <div><span>THREADS + X CONTENT ENGINE</span><h1>30 hari, 60 slot siap generate</h1><p>Copy persis dari workbook. Pilih produk nyata, lalu sistem mengisi harga jual dan foto RAW katalog.</p></div>
      <div className="content-plan-badge"><b>17 Sep–16 Okt 2026</b><span>Asia/Makassar · 2 slot/hari</span></div>
    </div>
    {tripCountry !== "Malaysia" && <p className="content-warning">Campaign ini khusus trip Malaysia. Ganti trip aktif ke Malaysia sebelum menandai konten Ready.</p>}
    <div className="content-grid">
      <article className="panel content-controls">
        <div className="content-step"><b>1</b><div><span>PILIH JADWAL</span><h2>{slot ? `${slot.id} · ${slot.angle}` : "Slot tidak ditemukan"}</h2></div></div>
        <div className="content-form two">
          <label>Tanggal<input type="date" min={contentPlanConfig.planStart} max={contentPlanConfig.planEnd} value={date} onChange={(e) => { setDate(e.target.value); setResult(null); }}/></label>
          <label>Slot<select value={period} onChange={(e) => { setPeriod(e.target.value as ContentPeriod); setResult(null); }}><option>Siang</option><option>Malam</option></select></label>
          <label>Jam {period}<input type="time" value={times[period]} onChange={(e) => { const next = { ...times, [period]: e.target.value }; setTimes(next); localStorage.setItem("elsewhere-content-times", JSON.stringify(next)); }}/></label>
          <label>Kategori rencana<input readOnly value={slot?.category || "-"}/></label>
        </div>
        <p className="content-guidance"><b>{formatDate(date)} · {period}</b><br/>{slot?.threadsGuidance}</p>
        <div className="content-step"><b>2</b><div><span>PILIH PRODUK</span><h2>Data katalog aktif</h2></div></div>
        <div className="content-form">
          <label>Produk<select value={productId} onChange={(e) => { setProductId(e.target.value); setResult(null); }}><option value="">Pilih produk…</option>{eligibleProducts.map((item) => <option key={item.id} value={item.id}>{item.brand ? `${item.brand} — ` : ""}{item.name}</option>)}</select></label>
          {productId && eligibleProducts.length !== products.length && !eligibleProducts.some((item) => item.id === productId) && <small>Produk terpilih tidak sesuai kategori slot; hasil akan memakai fallback netral.</small>}
          {variants.length > 0 && <label>Varian<select value={variantId} onChange={(e) => { setVariantId(e.target.value); setResult(null); }}>{variants.map((item) => <option key={item.id} value={item.id}>{[item.option1_value, item.option2_value].filter(Boolean).join(" / ") || item.name}</option>)}</select></label>}
        </div>
        {product && <div className="content-product-summary">{(variant?.photo_url || product.photo_url) ? <img src={variant?.photo_url || product.photo_url || ""} alt=""/> : <ImageIcon/>}<div><b>{product.name}</b><span>{variant ? ([variant.option1_value, variant.option2_value].filter(Boolean).join(" / ") || variant.name) : "Produk utama"}</span><strong>Rp{selectedPrice.toLocaleString("id-ID")}</strong></div></div>}
        <button className="content-generate" disabled={!slot || !product} onClick={() => generate(false)}><Sparkles size={17}/> Generate Threads + X</button>
        {result && <button className="content-regenerate" onClick={() => generate(true)}><RefreshCw size={15}/> Generate ulang versi ini</button>}
      </article>

      <article className="panel content-preview">
        {!result ? <div className="content-empty"><Sparkles/><h2>Preview akan muncul di sini</h2><p>Pilih jadwal dan produk, lalu tekan Generate. Generate berulang untuk kombinasi yang sama akan membuka draft tersimpan.</p></div> : <>
          <div className="content-result-head"><div><span>{result.slot_id} · {result.applied_angle}</span><h2>{result.status}</h2></div><select value={result.status} onChange={(e) => changeStatus(e.target.value as ContentStatus)}>{statusOrder.map((status) => <option key={status} disabled={status === "Posted" && !result.ready_to_publish}>{status}</option>)}</select></div>
          {result.fallback_reason && <p className="content-warning"><b>Fallback netral:</b> {result.fallback_reason}</p>}
          {result.missing_fields.length > 0 && <p className="content-warning"><b>Needs Review:</b> {result.missing_fields.join(", ")}</p>}
          <div className="channel-tabs">
            <Channel title="Threads" posts={result.threads.posts} onCopy={copyText} copied={copied}/>
            <Channel title="X" posts={result.x.posts} onCopy={copyText} copied={copied}/>
          </div>
          <div className="raw-image-card"><div><span>RAW PRODUCT IMAGE</span><b>Foto yang sama untuk Threads & X</b><small>Tanpa frame, overlay, atau template Instagram.</small></div>{result.raw_product_image.reference ? <><img src={result.raw_product_image.reference} alt="Foto RAW produk"/><div className="raw-actions"><button onClick={copyImage}>{copied === "image" ? <Check/> : <Copy/>} Copy image</button><a href={result.raw_product_image.reference} download target="_blank" rel="noreferrer"><Download/> Download RAW</a><a href={result.raw_product_image.reference} target="_blank" rel="noreferrer"><ExternalLink/> Buka</a></div></> : <p>Foto RAW belum tersedia.</p>}</div>
          <div className="validation-list">{Object.entries(result.validation).map(([key, value]) => { const passed = key === "unresolved_variables" ? !value : value; const label = key === "unresolved_variables" ? "variables resolved" : key.replaceAll("_", " "); return <span className={passed ? "ok" : "bad"} key={key}>{passed ? "✓" : "!"} {label}</span>; })}</div>
        </>}
      </article>
    </div>
    <article className="panel content-calendar"><div><span>RENCANA LENGKAP</span><h2>60 slot konten</h2></div><div className="content-slot-list">{contentPlanSlots.map((item) => { const draft = Object.values(saved).find((savedItem) => savedItem.slot_id === item.id); return <button key={item.id} onClick={() => { setDate(item.date); setPeriod(item.period as ContentPeriod); setResult(draft || null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><time>{new Date(`${item.date}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</time><span>{item.period} · {item.angle}</span><em>{draft?.status || item.initialStatus}</em></button>; })}</div></article>
  </section>;
}

function Channel({ title, posts, onCopy, copied }: { title: string; posts: { text: string; image_reference: string | null }[]; onCopy: (text: string, id: string) => void; copied: string }) {
  return <section className="channel-card"><h3>{title}<small>{posts.length > 1 ? `${posts.length} post (split otomatis)` : "1 post"}</small></h3>{posts.map((post, index) => { const id = `${title}-${index}`; return <div className="post-copy" key={id}><div><b>Post {index + 1}</b><button onClick={() => onCopy(post.text, id)}>{copied === id ? <Check/> : <Copy/>}{copied === id ? "Tersalin" : "Copy"}</button></div><pre>{post.text}</pre></div>; })}</section>;
}
