import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type Order,
  orderStatuses,
  paidAmount,
  paymentLabel,
} from '../lib/commerce';
import { rupiah } from '../lib/pricing';

export default function OrdersPanel({
  tripCode,
  onChange,
}: {
  tripCode: string;
  onChange: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*,order_items(*),order_payments(*)')
        .eq('trip_code', tripCode)
        .order('created_at', { ascending: false });
      if (!active) return;
      setLoading(false);
      if (error)
        setError(
          'Pesanan belum bisa dimuat. Pastikan pembaruan database sudah diterapkan.',
        );
      else {
        setOrders((data || []) as Order[]);
        setError('');
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tripCode, revision]);
  const selected = orders.find((o) => o.id === selectedId);
  const shown = orders.filter(
    (o) =>
      (filter === 'all' || o.status === filter) &&
      `${o.order_code} ${o.customer_name} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const changed = () => {
    setRevision((n) => n + 1);
    onChange();
  };
  return (
    <section className="orders-workspace">
      <div className="commerce-heading">
        <div>
          <span className="commerce-eyebrow">{tripCode} · OPERASIONAL</span>
          <h1>Pesanan</h1>
          <p>Konfirmasi, pembayaran, dan pengiriman dalam satu tempat.</p>
        </div>
        <button onClick={changed}>Perbarui</button>
      </div>
      <div className="commerce-filters">
        <input
          aria-label="Cari pesanan"
          placeholder="Cari nomor, nama, atau WhatsApp…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Semua status</option>
          {Object.entries(orderStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="commerce-error">
          {error}
        </p>
      )}
      {loading ? (
        <output>Memuat pesanan…</output>
      ) : (
        !error && (
          <div className="orders-layout">
            <div className="order-list">
              {!shown.length && (
                <div className="panel commerce-empty">
                  Belum ada pesanan yang cocok. Pesanan dari katalog akan muncul
                  di sini.
                </div>
              )}
              {shown.map((order) => (
                <button
                  className={`panel order-list-card ${order.id === selectedId ? 'selected' : ''}`}
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                >
                  <small className="order-code">{order.order_code}</small>
                  <strong>{order.customer_name}</strong>
                  <span>
                    {order.order_items
                      .map((i) => `${i.product_name} × ${i.quantity}`)
                      .join(', ')}
                  </span>
                  <b>{rupiah(Number(order.total_idr))}</b>
                  <span>
                    {orderStatuses[order.status]} · {paymentLabel(order)}
                  </span>
                  <small>
                    {new Date(order.created_at).toLocaleString('id-ID')}
                  </small>
                </button>
              ))}
            </div>
            {selected ? (
              <OrderDetail
                key={`${selected.id}:${selected.status}:${selected.courier}:${selected.tracking_number}`}
                order={selected}
                onChange={changed}
              />
            ) : (
              <div className="panel commerce-empty">
                Pilih pesanan untuk melihat detail.
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
function OrderDetail({
  order,
  onChange,
}: {
  order: Order;
  onChange: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [courier, setCourier] = useState(order.courier);
  const [tracking, setTracking] = useState(order.tracking_number);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const paymentRequest = useRef(crypto.randomUUID());
  const locked = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const receiptPath = useRef<string | null>(null);
  const [paymentAttempted, setPaymentAttempted] = useState(false);
  const action = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
      setMessage('Perubahan tersimpan.');
      onChange();
    } catch (error) {
      setMessage((error as Error).message || 'Gagal menyimpan. Coba lagi.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name, args);
    if (error) {
      if (error.code) setPaymentAttempted(false);
      throw error;
    }
  };
  const record = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void action(async () => {
      if (file && !receiptPath.current) {
        if (
          file.size > 5 * 1024 * 1024 ||
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
          ].includes(file.type)
        )
          throw new Error(
            'Bukti harus JPG, PNG, WEBP, atau PDF maksimal 5 MB.',
          );
        const extension = (
          {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
          } as Record<string, string>
        )[file.type];
        const path = `${order.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from('order-receipts')
          .upload(path, file);
        if (error) throw error;
        receiptPath.current = path;
      }
      setPaymentAttempted(true);
      await rpc('commerce_record_payment', {
        p_request_id: paymentRequest.current,
        p_order_id: order.id,
        p_amount: Number(amount),
        p_reference: reference,
        p_receipt_path: receiptPath.current,
      });
      paymentRequest.current = crypto.randomUUID();
      receiptPath.current = null;
      setPaymentAttempted(false);
      setAmount('');
      setReference('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    });
  };
  const paid = paidAmount(order);
  return (
    <article className="panel order-detail">
      <span className="commerce-eyebrow">DETAIL PESANAN</span>
      <h2>{order.customer_name}</h2>
      <small className="order-code">{order.order_code}</small>
      <a
        href={`https://wa.me/${order.phone}?text=${encodeURIComponent(`Halo ${order.customer_name}, kami dari Elsewhere ingin mengonfirmasi pesanan ${order.order_code}.`)}`}
        target="_blank"
        rel="noreferrer"
      >
        Hubungi via WhatsApp · {order.phone}
      </a>
      <p className="preserve-lines">{order.address}</p>
      {order.notes && <p className="preserve-lines">Catatan: {order.notes}</p>}
      {order.order_items.map((i, index) => (
        <div className="commerce-total" key={index}>
          <span>
            {i.product_name} · {i.variant_name} × {i.quantity}
          </span>
          <b>{rupiah(Number(i.unit_price_idr) * i.quantity)}</b>
        </div>
      ))}
      <div className="commerce-total">
        <span>Total barang</span>
        <b>{rupiah(Number(order.total_idr))}</b>
      </div>
      <div className="commerce-total">
        <span>Pembayaran terverifikasi</span>
        <b>{rupiah(paid)}</b>
      </div>
      <div className="commerce-total">
        <span>Sisa tagihan barang</span>
        <b>{rupiah(Math.max(0, Number(order.total_idr) - paid))}</b>
      </div>
      <p className="commerce-help">
        Ongkir domestik dikonfirmasi dan dicatat terpisah dari tagihan barang.
      </p>
      {message && <output className="commerce-message">{message}</output>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(() =>
            rpc('commerce_update_order', {
              p_order_id: order.id,
              p_status: status,
              p_courier: courier,
              p_tracking: tracking,
            }),
          );
        }}
      >
        <h3>Pengiriman & status</h3>
        <fieldset
          disabled={busy || ['cancelled', 'completed'].includes(order.status)}
        >
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(orderStatuses).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kurir
            <input
              maxLength={100}
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="JNE / J&T / lainnya"
            />
          </label>
          <label>
            Nomor resi
            <input
              maxLength={100}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </label>
          <button type="submit" className="commerce-primary">
            Simpan status
          </button>
        </fieldset>
        <p className="commerce-help">
          Status maju berurutan. Pengiriman memerlukan pembayaran lunas dan
          resi. Pembatalan hanya sebelum pembelian, tanpa catatan pembayaran.
        </p>
      </form>
      <h3>Riwayat pembayaran</h3>
      {!order.order_payments.length && <p>Belum ada pembayaran.</p>}
      {order.order_payments.map((payment) => (
        <div className="payment-row" key={payment.id}>
          <strong>{rupiah(Number(payment.amount_idr))}</strong>
          <span>{payment.reference}</span>
          <small>
            {payment.verified_at ? 'Terverifikasi' : 'Menunggu verifikasi'}
          </small>
          {payment.receipt_path && (
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const { data, error } = await supabase.storage
                    .from('order-receipts')
                    .createSignedUrl(payment.receipt_path!, 60);
                  if (error) throw error;
                  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                })
              }
            >
              Lihat bukti
            </button>
          )}
          {!payment.verified_at && (
            <div>
              <button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    rpc('commerce_verify_payment', {
                      p_payment_id: payment.id,
                    }),
                  )
                }
              >
                Verifikasi pembayaran
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    rpc('commerce_remove_pending_payment', {
                      p_payment_id: payment.id,
                    }),
                  )
                }
              >
                Hapus catatan keliru
              </button>
            </div>
          )}
        </div>
      ))}
      {order.status !== 'cancelled' && paid < Number(order.total_idr) && (
        <form onSubmit={record}>
          <h3>Catat DP / pelunasan</h3>
          <fieldset disabled={busy || paymentAttempted}>
            <label>
              Nominal (Rp)
              <input
                required
                type="number"
                min={1}
                max={Number(order.total_idr) - paid}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Referensi transfer / catatan
              <input
                required
                maxLength={200}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label>
              Bukti pembayaran (opsional, maks. 5 MB)
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </fieldset>
          <button disabled={busy} className="commerce-primary" type="submit">
            {paymentAttempted
              ? 'Cek / kirim ulang pembayaran'
              : 'Catat pembayaran'}
          </button>
          <p className="commerce-help">
            Pencatatan belum menambah dana terkumpul. Verifikasi setelah
            transfer benar-benar diterima.
          </p>
        </form>
      )}
    </article>
  );
}
