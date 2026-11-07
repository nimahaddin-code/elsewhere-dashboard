import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type Order,
  effectiveOrderStatus,
  getOrderLifecycle,
  normalizePhone,
  orderStatuses,
  itemProfitDetail,
  orderProfit,
  orderWhatsAppTemplates,
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
  const [paymentQuery, setPaymentQuery] = useState('');
  const [paymentTag, setPaymentTag] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(`orders-selected-${tripCode}`) || null;
  });
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
  const paymentNeedle = paymentQuery.trim().toLowerCase();
  // Each distinct payment note (case/spacing-insensitive) becomes a tag.
  const tagKey = (reference: string) => reference.trim().replace(/\s+/g, ' ').toLowerCase();
  const paymentTags = [...orders.reduce((tags, o) => {
    for (const key of new Set(o.order_payments.map((p) => tagKey(p.reference)).filter(Boolean))) {
      const label = o.order_payments.find((p) => tagKey(p.reference) === key)!.reference.trim();
      tags.set(key, { label: tags.get(key)?.label ?? label, count: (tags.get(key)?.count ?? 0) + 1 });
    }
    return tags;
  }, new Map<string, { label: string; count: number }>())].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
  const paymentFilterOn = Boolean(paymentNeedle || paymentTag);
  const matchesPayment = (p: Order['order_payments'][number]) =>
    (!paymentTag || tagKey(p.reference) === paymentTag) && (!paymentNeedle || p.reference.toLowerCase().includes(paymentNeedle));
  const matchingPayments = (o: Order) => (paymentFilterOn ? o.order_payments.filter(matchesPayment) : []);
  const shown = orders.filter(
    (o) =>
      (filter === 'all' || effectiveOrderStatus(o) === filter) &&
      `${o.order_code} ${o.customer_name} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!paymentFilterOn || matchingPayments(o).length > 0),
  );
  // Totals follow the current filters; cancelled orders count as 0 omzet/profit.
  const active = shown.filter((o) => o.status !== 'cancelled');
  const summary = {
    omzet: active.reduce((sum, o) => sum + Number(o.total_idr), 0),
    profit: active.reduce((sum, o) => sum + orderProfit(o).profit, 0),
    paid: active.reduce((sum, o) => sum + paidAmount(o), 0),
    matchedPayments: shown.reduce((sum, o) => sum + matchingPayments(o).filter((p) => p.verified_at).reduce((t, p) => t + Number(p.amount_idr), 0), 0),
  };
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedId) {
        window.localStorage.setItem(`orders-selected-${tripCode}`, selectedId);
      } else {
        window.localStorage.removeItem(`orders-selected-${tripCode}`);
      }
    }
  }, [selectedId, tripCode]);

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
        <input
          aria-label="Cari keterangan pembayaran"
          placeholder="Cari keterangan transfer…"
          value={paymentQuery}
          onChange={(e) => setPaymentQuery(e.target.value)}
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
      {!loading && !error && paymentTags.length > 0 && (
        <fieldset className="payment-tags" aria-label="Tag keterangan pembayaran">
          <button type="button" className={paymentTag === null ? 'active' : ''} aria-pressed={paymentTag === null} onClick={() => setPaymentTag(null)}>
            Semua
          </button>
          {paymentTags.map(([key, tag]) => (
            <button key={key} type="button" className={paymentTag === key ? 'active' : ''} aria-pressed={paymentTag === key} title={tag.label} onClick={() => setPaymentTag(paymentTag === key ? null : key)}>
              {tag.label} <small>{tag.count}</small>
            </button>
          ))}
        </fieldset>
      )}
      {!loading && !error && (
        <dl className="orders-summary">
          <div><dt>Omzet</dt><dd>{rupiah(summary.omzet)}</dd></div>
          <div className="profit"><dt>Profit</dt><dd>{rupiah(summary.profit)}</dd></div>
          <div><dt>Terbayar</dt><dd>{rupiah(summary.paid)}</dd></div>
          <div><dt>Order</dt><dd>{shown.length}</dd></div>
          {paymentFilterOn && (
            <div className="wide"><dt>Transfer {paymentTag ? `tag “${paymentTags.find(([key]) => key === paymentTag)?.[1].label ?? paymentTag}”` : `cocok “${paymentQuery.trim()}”`} (terverifikasi)</dt><dd>{rupiah(summary.matchedPayments)}</dd></div>
          )}
        </dl>
      )}
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
                  onClick={() => {
                    setSelectedId(order.id);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(`orders-selected-${tripCode}`, order.id);
                    }
                  }}
                >
                  <small className="order-code">{order.order_code}</small>
                  <strong>{order.customer_name}</strong>
                  <span>
                    {order.order_items
                      .map((i) => `${i.product_name} × ${i.quantity}`)
                      .join(', ')}
                  </span>
                  {order.order_payments.length > 0 && (
                    <span className="order-payment-tags">
                      {order.order_payments.map((p) => (
                        <small className={`order-payment-match ${paymentFilterOn && matchesPayment(p) ? 'hit' : ''}`} key={p.id}>
                          💳 {p.reference} · {rupiah(Number(p.amount_idr))}{p.verified_at ? '' : ' (belum dikonfirmasi)'}
                        </small>
                      ))}
                    </span>
                  )}
                  <b>
                    {rupiah(Number(order.total_idr))}
                    {order.status !== 'cancelled' && <small className="order-profit"> · untung {rupiah(orderProfit(order).profit)}</small>}
                  </b>
                  <span>
                    {orderStatuses[effectiveOrderStatus(order)]} · {paymentLabel(order)}
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
  const [status, setStatus] = useState(order.status === 'packed' ? 'arrived' : order.status);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [courier, setCourier] = useState(order.courier);
  const [tracking, setTracking] = useState(order.tracking_number);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<'cancelled' | 'return' | 'delete' | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const locked = useRef(false);
  const lifecycle = getOrderLifecycle(order);
  const whatsappTemplates = orderWhatsAppTemplates(order);
  // Staff can move an order to any step (including back to fix a mistake);
  // the database still requires full payment plus courier/resi for shipped and completed.
  const flowOrder = ['new', 'confirmed', 'purchased', 'arrived', 'shipped', 'completed'];
  const isCancelled = order.status === 'cancelled';
  const displayStatus = isCancelled && order.cancellation_type === 'return' ? 'cancelled_returned' : status;
  const currentIndex = flowOrder.indexOf(status);
  const nextStatus = currentIndex >= 0 && currentIndex < flowOrder.length - 1 ? flowOrder[currentIndex + 1] : null;
  const statusSteps = flowOrder.map((value, index) => ({
    value,
    label: orderStatuses[value] || value,
    current: status === value,
    done: currentIndex >= 0 && index < currentIndex,
  }));
  const needsShipping = (target: string | null) => target === 'shipped' || target === 'completed';
  // Manual orders may have no WhatsApp number; then messages are copied to paste manually.
  const hasPhone = Boolean(order.phone);
  const whatsappLink = (text: string) => `https://wa.me/${normalizePhone(order.phone)}?text=${encodeURIComponent(text)}`;
  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Pesan disalin. Tempel ke chat customer.');
    } catch {
      setMessage('Tidak bisa menyalin pesan otomatis di perangkat ini.');
    }
  };
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
    if (error) throw error;
  };
  const paid = paidAmount(order);
  const profit = orderProfit(order);
  const booked = order.order_payments.reduce((sum, payment) => sum + Number(payment.amount_idr), 0);
  const remaining = Math.max(0, Number(order.total_idr) - booked);
  const fullyPaid = paid >= Number(order.total_idr);
  const changeStatus = (target: string) =>
    action(async () => {
      const withShipping = target === 'arrived' || needsShipping(target);
      await rpc('commerce_set_order_status', {
        p_order_id: order.id,
        p_status: target,
        p_courier: withShipping ? courier : null,
        p_tracking: withShipping ? tracking : null,
      });
      setStatus(target);
      setPendingStatus(null);
    });
  // Records a payment the team received (cash/transfer) and verifies it in one step.
  const recordPayment = () => {
    const amount = payAmount === '' ? remaining : Number(payAmount);
    if (!(amount > 0) || amount > remaining) {
      setMessage(`Nominal harus antara Rp1 dan ${rupiah(remaining)}.`);
      return;
    }
    void action(async () => {
      const { data, error } = await supabase.rpc('commerce_record_payment', {
        p_request_id: crypto.randomUUID(),
        p_order_id: order.id,
        p_amount: amount,
        p_reference: payNote.trim() || 'Pembayaran manual',
      });
      if (error) throw error;
      await rpc('commerce_verify_payment', { p_payment_id: data });
      if (status === 'new') setStatus('confirmed');
      setPayAmount('');
      setPayNote('');
    });
  };
  const canCancelUnpaid = order.status === 'new' && paid === 0;
  const canCancelReturn = !['cancelled', 'completed'].includes(order.status) && (paid > 0 || order.status !== 'new');
  return (
    <article className="panel order-detail">
      {order.status === 'new' && !order.order_payments.some((payment) => payment.verified_at) && (
        <div className="payment-attention" role="status">
          <strong>Menunggu konfirmasi pembayaran</strong>
          <span>Cek bukti transfer lalu klik Konfirmasi bayar, atau catat pembayaran yang sudah diterima di bagian pembayaran.</span>
        </div>
      )}
      <div className="order-detail-sections">
        <section className="order-detail-section">
          <h3>Detail pemesanan</h3>
          <div className="order-detail-subsection">
            <h4>Customer</h4>
            <dl className="order-detail-grid">
              <div className="full-width">
                <dt>Order ID</dt>
                <dd>{order.order_code}</dd>
              </div>
              <div>
                <dt>Nama</dt>
                <dd>{order.customer_name}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{order.phone || '—'}</dd>
              </div>
              <div className="full-width">
                <dt>Alamat</dt>
                <dd className="preserve-lines">{order.address}</dd>
              </div>
              {order.notes && (
                <div className="full-width">
                  <dt>Catatan</dt>
                  <dd className="preserve-lines">{order.notes}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="order-detail-subsection">
            <h4>Barang</h4>
            {order.order_items.map((i, index) => {
              const detail = itemProfitDetail(i);
              const row = (
                <>
                  <span>
                    {i.product_name} · {i.variant_name} × {i.quantity}
                  </span>
                  <b>{rupiah(Number(i.unit_price_idr) * i.quantity)}</b>
                </>
              );
              if (!detail || detail.isShipping) {
                return <div className="commerce-total" key={index}>{row}</div>;
              }
              // Folded by default; open to see item price, shipping and profit.
              return (
                <details className="order-item-profit" key={index}>
                  <summary className="commerce-total">{row}</summary>
                  <dl>
                    {detail.productCost !== null && <div><dt>Harga barang</dt><dd>{rupiah(detail.productCost)}</dd></div>}
                    {detail.cargo !== null && (
                      <div>
                        <dt>Ongkir{detail.cargoPerGram !== null && detail.grams !== null ? ` (Rp${detail.cargoPerGram.toLocaleString('id-ID')} × ${detail.grams.toLocaleString('id-ID')}g)` : ''}</dt>
                        <dd>{rupiah(detail.cargo)}</dd>
                      </div>
                    )}
                    <div><dt>Untung / pcs</dt><dd>{rupiah(detail.unitProfit)}{detail.profitPercent === null ? '' : ` (${detail.profitPercent}%)`}</dd></div>
                    {i.quantity > 1 && <div><dt>Total untung</dt><dd>{rupiah(detail.totalProfit)}</dd></div>}
                  </dl>
                </details>
              );
            })}
            <div className="commerce-total">
              <span>Total barang</span>
              <b>{rupiah(Number(order.total_idr))}</b>
            </div>
            <div className="commerce-total order-profit-row">
              <span>Untung{profit.complete ? '' : ' (sebagian, ada item tanpa data modal)'}</span>
              <b>{rupiah(profit.profit)}</b>
            </div>
          </div>
        </section>

        <section className="order-detail-section">
          <h3>Pembayaran</h3>
          <div className="order-detail-subsection compact">
            <dl className="order-detail-grid compact">
              <div>
                <dt>Terbayar</dt>
                <dd>{rupiah(paid)}</dd>
              </div>
              <div>
                <dt>Sisa</dt>
                <dd>{rupiah(Math.max(0, Number(order.total_idr) - paid))}</dd>
              </div>
            </dl>
          </div>
          <div className="payment-history">
            <h4>Riwayat pembayaran</h4>
            <p className="commerce-help payment-record-help">Setiap pembayaran tercatat sebagai riwayat. Cek bukti transfer dan konfirmasi bayar bila nominal sudah cocok.</p>
            {!order.order_payments.length && <p>Belum ada pembayaran.</p>}
            {order.status !== 'cancelled' && remaining > 0 && (
              <div className="payment-record-form">
                <label>
                  Nominal (Rp)
                  <input type="number" inputMode="numeric" min={1} max={remaining} value={payAmount} placeholder={String(remaining)} onChange={(event) => setPayAmount(event.target.value)} />
                </label>
                <label>
                  Keterangan
                  <input maxLength={200} value={payNote} placeholder="Transfer BCA / cash" onChange={(event) => setPayNote(event.target.value)} />
                </label>
                <button type="button" className="commerce-primary" disabled={busy} onClick={recordPayment}>
                  {payAmount === '' || Number(payAmount) === remaining ? `Catat lunas ${rupiah(remaining)}` : 'Catat pembayaran'}
                </button>
              </div>
            )}
            {order.order_payments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <strong>{rupiah(Number(payment.amount_idr))}</strong>
                <span>{payment.reference}</span>
                <small>
                  {payment.verified_at ? 'Terverifikasi' : 'Menunggu konfirmasi'}
                </small>
                <div className="payment-row-actions">
                  {payment.verified_at ? (
                    hasPhone ? (
                      <a
                        className="payment-primary-action"
                        href={whatsappLink(whatsappTemplates.paymentConfirmation)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Kirim ke WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="payment-primary-action"
                        onClick={() => void copyMessage(whatsappTemplates.paymentConfirmation)}
                      >
                        Salin pesan konfirmasi
                      </button>
                    )
                  ) : (
                    <button
                      className="payment-primary-action"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await rpc('commerce_verify_payment', {
                            p_payment_id: payment.id,
                          });
                          if (hasPhone)
                            window.open(
                              whatsappLink(whatsappTemplates.paymentConfirmation),
                              '_blank',
                              'noopener,noreferrer',
                            );
                        })
                      }
                    >
                      Konfirmasi bayar
                    </button>
                  )}
                  {payment.receipt_path && (
                    <button
                      className="payment-secondary-action"
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
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="order-detail-section order-status-section">
          <div className="order-status-header">
            <h3>Status & pengiriman</h3>
            <span className="order-status-badge">{orderStatuses[displayStatus] || 'Status'}</span>
          </div>

          <div className="order-status-summary">
            <div className="order-status-summary-top">
              <strong>{orderStatuses[displayStatus] || 'Status'}</strong>
              <small>{lifecycle.phaseSummary}</small>
            </div>
            <p>
              {displayStatus === 'new' && 'Pesanan sudah checkout, menunggu konfirmasi pembayaran.'}
              {displayStatus === 'confirmed' && 'Pembayaran sudah dikonfirmasi, order siap diproses.'}
              {displayStatus === 'purchased' && 'Barang sudah dibeli dan sedang diproses dari supplier.'}
              {displayStatus === 'arrived' && 'Barang sudah sampai di Indonesia dan siap lanjut pengiriman.'}
              {displayStatus === 'packed' && 'Barang sudah siap dikirim ke customer.'}
              {displayStatus === 'shipped' && 'Pesanan sedang dalam proses pengiriman ke customer.'}
              {displayStatus === 'completed' && 'Pesanan sudah diterima customer dan selesai.'}
              {displayStatus === 'cancelled' && 'Pesanan dibatalkan.'}
              {displayStatus === 'cancelled_returned' && 'Pesanan dibatalkan dan dana/barang dikembalikan kepada customer.'}
            </p>
            <div className="order-status-stepper" aria-label="Ubah status order">
              {statusSteps.map((step) => (
                <button
                  key={step.value}
                  type="button"
                  className={`order-status-step ${step.current ? 'current' : step.done ? 'done' : 'upcoming'} ${pendingStatus === step.value ? 'review' : ''}`}
                  aria-pressed={step.current}
                  disabled={busy || isCancelled}
                  onClick={() => {
                    setMessage('');
                    setPendingStatus(step.current ? null : step.value);
                  }}
                >
                  {step.label}
                </button>
              ))}
              {!['cancelled', 'completed'].includes(order.status) && (
                <>
                  <button type="button" className="order-status-step terminal-action" disabled={!canCancelUnpaid || busy} onClick={()=>setConfirmAction('cancelled')}>Cancelled</button>
                  <button type="button" className="order-status-step terminal-action return" disabled={!canCancelReturn || busy} onClick={()=>setConfirmAction('return')}>Cancel &amp; Return</button>
                </>
              )}
            </div>
          </div>

          {message && <output className="commerce-message">{message}</output>}
          {pendingStatus ? (
            <div className="order-status-transition-block">
              <strong>Ubah status ke {orderStatuses[pendingStatus] || pendingStatus}?</strong>
              {flowOrder.indexOf(pendingStatus) < currentIndex && <p>Status akan dikembalikan ke tahap sebelumnya.</p>}
              {(pendingStatus === 'arrived' || needsShipping(pendingStatus)) && (
                <>
                  <label>
                    {pendingStatus === 'arrived' ? 'Kurir / vendor (opsional)' : 'Kurir pengiriman'}
                    <input maxLength={100} value={courier} placeholder={pendingStatus === 'arrived' ? 'Cargo / warehouse' : 'JNE / J&T / lainnya'} onChange={(event) => setCourier(event.target.value)} />
                  </label>
                  <label>
                    {pendingStatus === 'arrived' ? 'No. penerimaan / tracking (opsional)' : 'Nomor resi'}
                    <input maxLength={200} value={tracking} placeholder="Nomor resi atau link tracking" onChange={(event) => setTracking(event.target.value)} />
                  </label>
                </>
              )}
              {needsShipping(pendingStatus) && !fullyPaid && (
                <p className="commerce-help">Belum lunas. Catat pembayaran dulu di bagian pembayaran (sisa {rupiah(Math.max(0, Number(order.total_idr) - paid))}).</p>
              )}
              <div className="order-status-confirm-actions">
                <button
                  type="button"
                  className="commerce-primary"
                  disabled={busy || (needsShipping(pendingStatus) && (!fullyPaid || !courier.trim() || !tracking.trim()))}
                  onClick={() => void changeStatus(pendingStatus)}
                >
                  Ya, ubah status
                </button>
                <button type="button" className="commerce-secondary" onClick={() => setPendingStatus(null)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            !isCancelled && nextStatus && (
              <button type="button" className="commerce-primary" disabled={busy} onClick={() => { setMessage(''); setPendingStatus(nextStatus); }}>
                Lanjut ke {orderStatuses[nextStatus] || nextStatus}
              </button>
            )
          )}
          <p className="commerce-help">
            Tap status mana saja untuk memindahkan order, termasuk mundur kalau salah. Shipped to Cust dan Completed butuh pembayaran lunas serta kurir dan resi.
          </p>
          <div className="order-admin-actions">
            {confirmAction ? (
              <div className="order-delete-confirm">
                <span>{confirmAction === 'cancelled'
                  ? 'Batalkan order tanpa pembayaran terverifikasi ini?'
                  : confirmAction === 'return'
                    ? 'Tandai order sebagai Cancel & Return? Pastikan refund/pengembalian sudah ditangani.'
                    : `Hapus permanen ${order.order_code} beserta seluruh item dan catatan pembayarannya?`}</span>
                <div>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busy}
                    onClick={() => {
                      void action(async () => {
                        if (confirmAction === 'delete') {
                          await rpc('commerce_delete_order', { p_order_id: order.id });
                          onChange();
                          return;
                        }
                        await rpc('commerce_cancel_order', {
                          p_order_id: order.id,
                          p_mode: confirmAction === 'return' ? 'return' : 'unpaid',
                        });
                      });
                    }}
                  >
                    {confirmAction === 'cancelled' ? 'Ya, batalkan' : confirmAction === 'return' ? 'Ya, cancel & return' : 'Hapus permanen'}
                  </button>
                  <button type="button" onClick={() => setConfirmAction(null)}>
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mini-delete-button"
                onClick={() => setConfirmAction('delete')}
                aria-label="Hapus order"
              >
                Hapus order
              </button>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
