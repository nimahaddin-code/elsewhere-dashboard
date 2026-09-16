import { useEffect, useRef, useState } from 'react';
import { Check, Download, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import type { CatalogueProduct, CatalogueVariant } from '../lib/commerce';
import { normalizePhone } from '../lib/commerce';
import { rupiah } from '../lib/pricing';
import ProductPhoto from './product-photo';
import { supabase } from '../lib/supabase';

export type CartItem = {
  product: CatalogueProduct;
  variant: CatalogueVariant;
  quantity: number;
};

type ProductDetailProps = {
  product: CatalogueProduct | null;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
};

export function ProductDetail({ product, onClose, onAdd }: ProductDetailProps) {
  const [selectedId, setSelectedId] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const variants = product?.product_variants || [];
  const selected = variants.find((variant) => variant.id === selectedId) || variants[0];
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    setSelectedId(product.product_variants?.[0]?.id || '');
    setQuantity(1);
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [product]);

  if (!product) return null;
  const option1Values = [...new Set(variants.map((variant) => variant.option1_value).filter(Boolean))] as string[];
  const option2Values = [...new Set(variants.map((variant) => variant.option2_value).filter(Boolean))] as string[];
  const selectedOption1 = selected?.option1_value;
  const selectedOption2 = selected?.option2_value;
  const chooseOption = (key: 'option1_value' | 'option2_value', value: string) => {
    const match = variants.find((variant) => {
      const nextOption1 = key === 'option1_value' ? value : selectedOption1;
      const nextOption2 = key === 'option2_value' ? value : selectedOption2;
      return variant.option1_value === nextOption1 && variant.option2_value === nextOption2;
    }) || variants.find((variant) => variant[key] === value);
    if (match) setSelectedId(match.id);
  };
  const maxQuantity = Math.min(20, selected?.available ?? 20);
  const unavailable = !selected?.unit_price_idr || (selected.available !== null && selected.available < 1);

  return (
    <dialog ref={dialogRef} className="storefront-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button className="storefront-dialog-close" type="button" onClick={onClose} aria-label="Tutup detail produk"><X size={19} /></button>
      <div className="product-detail-layout">
        <div className="product-detail-photo">
          <ProductPhoto key={`${product.id}-${selected?.id || 'default'}`} product={product} variant={selected} alt={`${product.name}${selected ? ` — ${selected.name}` : ''}`} />
        </div>
        <div className="product-detail-copy">
          <span className="commerce-eyebrow">{product.brand || 'ELSEWHERE FIND'}</span>
          <h2>{product.name}</h2>
          <p className="product-detail-price">{selected?.unit_price_idr ? rupiah(Number(selected.unit_price_idr)) : 'Harga belum tersedia'}</p>
          <p className="product-detail-note">Termasuk kargo internasional. Ongkir domestik dikonfirmasi terpisah.</p>
          {option1Values.length > 0 && <fieldset className="variant-choices"><legend>{product.option1_label || 'Pilihan'}</legend><div>{option1Values.map((value) => <button type="button" className={selectedOption1 === value ? 'selected' : ''} key={value} onClick={() => chooseOption('option1_value', value)}>{value}</button>)}</div></fieldset>}
          {option2Values.length > 0 && <fieldset className="variant-choices"><legend>{product.option2_label || 'Ukuran'}</legend><div>{option2Values.map((value) => <button type="button" className={selectedOption2 === value ? 'selected' : ''} key={value} onClick={() => chooseOption('option2_value', value)}>{value}</button>)}</div></fieldset>}
          {!option1Values.length && !option2Values.length && variants.length > 1 && <label className="variant-select-label">Pilihan<select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name}</option>)}</select></label>}
          <div className="product-detail-availability">{selected?.sale_mode === 'stock' ? 'Ready stock' : 'Pre order'}{selected?.available !== null ? ` · ${selected?.available || 0} tersedia` : ' · Kuota terbuka'}</div>
          <div className="quantity-control"><span>Jumlah</span><div><button type="button" aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button><strong>{quantity}</strong><button type="button" aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><Plus size={15} /></button></div></div>
          <button className="commerce-primary storefront-add-button" type="button" disabled={unavailable} onClick={() => { onAdd({ product, variant: selected, quantity }); onClose(); }}>{unavailable ? 'Tidak tersedia' : 'Tambah ke keranjang'}</button>
        </div>
      </div>
    </dialog>
  );
}

type CheckoutProps = {
  items: CartItem[];
  onClose: () => void;
  onComplete: (items: CartItem[]) => void;
  onFinished: () => void;
};
type PaymentReceipt = { order_id: string; order_code: string; total_idr: number };

export function CheckoutDialog({ items, onClose, onComplete, onFinished }: CheckoutProps) {
  const [draft, setDraft] = useState({ name: '', phone: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const whatsapp = normalizePhone(import.meta.env.VITE_WHATSAPP_NUMBER || '');
  const qrisUrl = import.meta.env.VITE_QRIS_IMAGE_URL || '/QRIS.PNG';
  const total = items.reduce((sum, item) => sum + Number(item.variant.unit_price_idr || 0) * item.quantity, 0);
  const closeCheckout = () => {
    if (receipts.length) onFinished();
    onClose();
  };

  useEffect(() => {
    if (!items.length) return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [items.length]);

  if (!items.length) return null;
  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^[0-9]{9,15}$/.test(normalizePhone(draft.phone))) { setError('Isi nomor WhatsApp yang valid, misalnya 081234567890.'); return; }
    setBusy(true); setError('');
    try {
      const created: PaymentReceipt[] = [];
      for (const item of items) {
        const { data, error: failure } = await supabase.rpc('commerce_place_order', {
          p_request_id: crypto.randomUUID(),
          p_variant_id: item.variant.id,
          p_quantity: item.quantity,
          p_expected_price: item.variant.unit_price_idr,
          p_name: draft.name.trim(),
          p_phone: normalizePhone(draft.phone),
          p_address: draft.address.trim(),
          p_notes: draft.notes.trim(),
        });
        if (failure) throw failure;
        const { data: target, error: targetError } = await supabase.rpc('commerce_order_target', { p_order_code: data.order_code });
        if (targetError || !target?.order_id) throw targetError || new Error('Nomor pesanan belum siap. Muat ulang dan coba lagi.');
        created.push({ ...data, order_id: target.order_id });
      }
      setReceipts(created);
      onComplete(items);
    } catch (failure) {
      setError((failure as Error).message || 'Pesanan belum dapat dikonfirmasi. Coba lagi dengan data yang sama.');
    } finally { setBusy(false); }
  };
  const orderCodes = receipts.map((receipt) => receipt.order_code).join(', ');
  const submitPaymentProof = async () => {
    if (!paymentProof || paymentBusy || paymentSubmitted) return;
    if (paymentProof.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(paymentProof.type)) {
      setPaymentError('Bukti harus JPG, PNG, WEBP, atau PDF maksimal 5 MB.');
      return;
    }
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<string, string>)[paymentProof.type];
      for (const receipt of receipts) {
        const path = `${receipt.order_id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('order-receipts').upload(path, paymentProof, { contentType: paymentProof.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: paymentError } = await supabase.rpc('commerce_submit_payment', {
          p_request_id: crypto.randomUUID(),
          p_order_code: receipt.order_code,
          p_amount: receipt.total_idr,
          p_reference: 'QRIS customer',
          p_receipt_path: path,
        });
        if (paymentError) throw paymentError;
      }
      setPaymentSubmitted(true);
    } catch (failure) {
      setPaymentError((failure as Error).message || 'Bukti pembayaran belum dapat dikirim. Coba lagi.');
    } finally { setPaymentBusy(false); }
  };
  return (
    <dialog ref={dialogRef} className="storefront-dialog storefront-checkout-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) closeCheckout(); }}>
      <button className="storefront-dialog-close" type="button" onClick={closeCheckout} disabled={busy} aria-label="Tutup checkout"><X size={19} /></button>
      {receipts.length ? <div className="checkout-success">
        <span className="checkout-success-icon"><Check size={22} /></span>
        <span className="commerce-eyebrow">PESANAN TERCATAT</span>
        <h2>Terima kasih, {draft.name}.</h2>
        <p>Nomor pesananmu: <strong>{orderCodes}</strong></p>
        <div className="payment-required-notice"><strong>WAJIB: upload bukti pembayaran</strong><p>Setelah membayar, masukkan foto bukti pembayaran/transfer di bawah. Setelah terkirim, klik tombol WhatsApp untuk memberi tahu kami.</p></div>
        <div className="qris-panel">{qrisUrl ? <img src={qrisUrl} alt="QRIS Elsewhere" /> : <div className="qris-missing">QRIS belum dikonfigurasi.</div>}<a className="qris-download" href={qrisUrl} download="QRIS-Elsewhere.png" target="_blank" rel="noreferrer" aria-label="Download QRIS"><Download size={17} /></a></div>
        <label className="payment-proof-picker">Bukti pembayaran / transfer<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { setPaymentProof(event.target.files?.[0] || null); setPaymentError(''); }} disabled={paymentBusy || paymentSubmitted} /><span>{paymentProof?.name || 'Pilih foto atau file bukti pembayaran'}</span></label>
        <button className="commerce-primary payment-proof-button" type="button" onClick={submitPaymentProof} disabled={!paymentProof || paymentBusy || paymentSubmitted}>{paymentSubmitted ? 'Bukti pembayaran terkirim ✓' : paymentBusy ? 'Mengirim bukti…' : 'Kirim bukti pembayaran'}</button>
        {paymentError && <p className="commerce-error" role="alert">{paymentError}</p>}
        {/^[0-9]{9,15}$/.test(whatsapp) && <a className={`commerce-primary whatsapp-button${paymentSubmitted ? '' : ' is-locked'}`} target="_blank" rel="noreferrer" href={paymentSubmitted ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Halo Elsewhere, saya ingin konfirmasi pesanan ${orderCodes}. Bukti pembayaran sudah saya upload. Saya sudah membayar total ${rupiah(total)} lewat QRIS.`)}` : undefined} onClick={(event) => { if (!paymentSubmitted) event.preventDefault(); }}>{paymentSubmitted ? 'Kirim pesan ke WhatsApp' : 'Upload bukti dulu untuk lanjut'}</a>}
        <button className="checkout-secondary" type="button" onClick={closeCheckout}>Kembali ke katalog</button>
      </div> : <form onSubmit={submit}>
        <span className="commerce-eyebrow">CHECKOUT</span><h2>Lengkapi pesananmu</h2><p className="checkout-intro">Kami akan mengonfirmasi ketersediaan dan pembayaran melalui WhatsApp.</p>
        <div className="checkout-items">{items.map((item) => <div key={item.variant.id}><div><strong>{item.product.name}</strong><small>{item.variant.name} · {item.quantity} item</small></div><b>{rupiah(Number(item.variant.unit_price_idr || 0) * item.quantity)}</b></div>)}</div>
        <fieldset disabled={busy}><label>Nama penerima<input required autoComplete="name" minLength={2} maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Nomor WhatsApp<input required type="tel" autoComplete="tel" placeholder="081234567890" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label>Alamat lengkap dan kode pos<textarea required minLength={10} maxLength={1000} autoComplete="street-address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label><label>Catatan (opsional)<textarea maxLength={1000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label></fieldset>
        <div className="commerce-total"><span>Total barang</span><strong>{rupiah(total)}</strong></div><p className="commerce-help">Ongkir domestik dikonfirmasi terpisah. Payment dilakukan melalui QRIS setelah pesanan tercatat.</p>{error && <p role="alert" className="commerce-error">{error}</p>}<button className="commerce-primary" type="submit" disabled={busy}>{busy ? 'Menyimpan pesanan…' : 'Lanjut ke pembayaran'}</button>
      </form>}
    </dialog>
  );
}

export function CartButton({ count, pulse, onClick }: { count: number; pulse: boolean; onClick: () => void }) {
  return <button className={`store-cart-button${pulse ? ' cart-added' : ''}`} type="button" onClick={onClick} aria-label={`Buka keranjang, ${count} item`}><ShoppingBag size={18} />{count > 0 && <span>{count}</span>}</button>;
}

export function CartDialog({ items, onClose, onChange, onCheckout }: { items: CartItem[]; onClose: () => void; onChange: (items: CartItem[]) => void; onCheckout: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);
  const total = items.reduce((sum, item) => sum + Number(item.variant.unit_price_idr || 0) * item.quantity, 0);
  return <dialog ref={dialogRef} className="storefront-dialog storefront-cart-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <button className="storefront-dialog-close" type="button" onClick={onClose} aria-label="Tutup keranjang"><X size={19} /></button>
    <span className="commerce-eyebrow">YOUR SELECTION</span><h2>Keranjang</h2>
    {!items.length ? <div className="cart-empty"><ShoppingBag size={28} /><p>Keranjangmu masih kosong.</p><button className="checkout-secondary" type="button" onClick={onClose}>Lihat katalog</button></div> : <>
      <div className="cart-lines">{items.map((item, index) => <div className="cart-line" key={`${item.variant.id}-${index}`}><div className="cart-line-photo"><ProductPhoto product={item.product} variant={item.variant} alt="" /></div><div className="cart-line-copy"><strong>{item.product.name}</strong><small>{item.variant.name}</small><b>{rupiah(Number(item.variant.unit_price_idr || 0) * item.quantity)}</b><div className="cart-line-controls"><button type="button" onClick={() => onChange(items.map((value, row) => row === index ? { ...value, quantity: Math.max(1, value.quantity - 1) } : value))}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" onClick={() => onChange(items.map((value, row) => row === index ? { ...value, quantity: Math.min(value.variant.available ?? 20, value.quantity + 1) } : value))}><Plus size={13} /></button><button className="cart-remove" type="button" onClick={() => onChange(items.filter((_, row) => row !== index))}>Hapus</button></div></div></div>)}</div>
      <div className="commerce-total"><span>Total barang</span><strong>{rupiah(total)}</strong></div><button className="commerce-primary" type="button" onClick={onCheckout}>Checkout</button>
    </>}
  </dialog>;
}
