import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CatalogueProduct, CatalogueVariant } from '../lib/commerce';
import { normalizePhone } from '../lib/commerce';
import { rupiah } from '../lib/pricing';

export default function OrderForm({
  product,
  variant,
  onClose,
  onSaved,
}: {
  product: CatalogueProduct;
  variant: CatalogueVariant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    quantity: 1,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    order_code: string;
    total_idr: number;
  } | null>(null);
  // Keep the same token after a network failure: a retry must never create a second order.
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const [attempted, setAttempted] = useState(false);
  const whatsapp = normalizePhone(import.meta.env.VITE_WHATSAPP_NUMBER || '');
  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!/^[0-9]{9,15}$/.test(normalizePhone(draft.phone))) {
      setError('Isi nomor WhatsApp yang valid, misalnya 081234567890.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    setAttempted(true);
    try {
      const { data, error: failure } = await supabase.rpc(
        'commerce_place_order',
        {
          p_request_id: requestId.current,
          p_variant_id: variant.id,
          p_quantity: draft.quantity,
          p_expected_price: variant.unit_price_idr,
          p_name: draft.name.trim(),
          p_phone: normalizePhone(draft.phone),
          p_address: draft.address.trim(),
          p_notes: draft.notes.trim(),
        },
      );
      if (failure) {
        if (failure.code) setAttempted(false);
        throw failure;
      }
      setReceipt(data);
      onSaved();
    } catch (failure) {
      setError(
        (failure as Error).message ||
          'Pesanan belum dapat dikonfirmasi. Coba kirim ulang dengan form yang sama.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      className="commerce-modal"
      aria-labelledby="order-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <button
          autoFocus
          type="button"
          className="commerce-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup form"
        >
          ×
        </button>
        {receipt ? (
          <>
            <span className="commerce-eyebrow">PESANAN TERCATAT</span>
            <h2 id="order-title">Terima kasih, {draft.name}.</h2>
            <p>
              Simpan nomor pesanan ini untuk konfirmasi dengan tim Elsewhere.
            </p>
            <strong className="order-code">{receipt.order_code}</strong>
            <p>
              {product.name} · {variant.name} × {draft.quantity}
            </p>
            <h3>{rupiah(Number(receipt.total_idr))}</h3>
            <p>
              Belum termasuk ongkir ke alamatmu. Tim akan mengonfirmasi
              ketersediaan dan pembayaran melalui WhatsApp.
            </p>
            {/^[0-9]{9,15}$/.test(whatsapp) && (
              <a
                className="commerce-primary"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Halo Elsewhere, saya ingin konfirmasi pesanan ${receipt.order_code}, ${product.name} (${variant.name}) × ${draft.quantity}, total ${rupiah(Number(receipt.total_idr))}.`)}`}
              >
                Konfirmasi via WhatsApp
              </a>
            )}
            <button type="button" onClick={onClose}>
              Kembali ke katalog
            </button>
          </>
        ) : (
          <>
            <span className="commerce-eyebrow">
              {product.trip_name} ·{' '}
              {variant.sale_mode === 'stock' ? 'READY STOCK' : 'PREORDER'}
            </span>
            <h2 id="order-title">Pesan {product.name}</h2>
            <p>
              {variant.name} · {rupiah(Number(variant.unit_price_idr))} / item
            </p>
            <fieldset disabled={busy || attempted}>
              <label>
                Jumlah
                <input
                  required
                  type="number"
                  min={1}
                  max={Math.min(20, variant.available ?? 20)}
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft({ ...draft, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Nama penerima
                <input
                  required
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Nomor WhatsApp
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  maxLength={22}
                  placeholder="081234567890"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </label>
              <label>
                Alamat lengkap dan kode pos
                <textarea
                  required
                  autoComplete="street-address"
                  minLength={10}
                  maxLength={1000}
                  value={draft.address}
                  onChange={(e) =>
                    setDraft({ ...draft, address: e.target.value })
                  }
                />
              </label>
              <label>
                Catatan (opsional)
                <textarea
                  maxLength={1000}
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
            </fieldset>
            <div className="commerce-total">
              <span>Total barang</span>
              <strong>
                {rupiah(Number(variant.unit_price_idr) * draft.quantity)}
              </strong>
            </div>
            <p className="commerce-help">
              Termasuk kargo internasional. Ongkir domestik dikonfirmasi
              terpisah. Data kontak digunakan untuk mengurus pesanan ini. Pesanan yang belum dikonfirmasi dan belum memiliki catatan pembayaran dibatalkan otomatis setelah 48 jam.
            </p>
            {error && (
              <p role="alert" className="commerce-error">
                {error}
              </p>
            )}
            <button className="commerce-primary" disabled={busy} type="submit">
              {busy
                ? 'Menyimpan pesanan…'
                : attempted
                  ? 'Cek / kirim ulang pesanan'
                  : 'Kirim pesanan'}
            </button>
          </>
        )}
      </form>
    </dialog>
  );
}
