import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type Order,
  createOrderDraftSnapshot,
  effectiveOrderStatus,
  getOrderLifecycle,
  normalizePhone,
  orderStatuses,
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
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(`orders-selected-${tripCode}`) || null;
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
  const shown = orders.filter(
    (o) =>
      (filter === 'all' || effectiveOrderStatus(o) === filter) &&
      `${o.order_code} ${o.customer_name} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedId) {
        window.sessionStorage.setItem(`orders-selected-${tripCode}`, selectedId);
      } else {
        window.sessionStorage.removeItem(`orders-selected-${tripCode}`);
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
                  onClick={() => {
                    setSelectedId(order.id);
                    if (typeof window !== 'undefined') {
                      window.sessionStorage.setItem(`orders-selected-${tripCode}`, order.id);
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
                  <b>{rupiah(Number(order.total_idr))}</b>
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
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [courier, setCourier] = useState(order.courier);
  const [tracking, setTracking] = useState(order.tracking_number);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<'cancelled' | 'return' | 'delete' | null>(null);
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<string | null>(null);
  const [receiptPhotoPreview, setReceiptPhotoPreview] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.sessionStorage.getItem(`order-draft-${order.id}`) || '{}');
    } catch {
      return {};
    }
  });
  const locked = useRef(false);
  const lifecycle = getOrderLifecycle(order);
  const whatsappTemplates = orderWhatsAppTemplates(order);
  const transitionRequirements: Record<string, { label: string; helper: string; fields: Array<{ key: 'courier' | 'tracking'; label: string; placeholder: string }> }> = {
    purchased: {
      label: 'Barang sudah dibeli',
      helper: 'Upload foto produk dan foto resi / bukti pembelian sebelum lanjut ke tahap berikutnya.',
      fields: [],
    },
    arrived: {
      label: 'Barang dikirim ke Indonesia',
      helper: 'Catat barang sudah sampai di Indonesia sebelum lanjut ke tahap berikutnya.',
      fields: [
        { key: 'courier', label: 'Kurir / vendor lokal', placeholder: 'Warehouse / cargo / ekspedisi lokal' },
        { key: 'tracking', label: 'Nomor penerimaan / link tracking', placeholder: 'Nomor penerimaan atau link tracking' },
      ],
    },
    packed: {
      label: 'Barang dikirim ke Indonesia',
      helper: 'Tulis info packing dan kurir untuk memastikan proses pengiriman siap dijalankan.',
      fields: [
        { key: 'courier', label: 'Kurir / jasa kirim', placeholder: 'JNE / J&T / DHL / lainnya' },
        { key: 'tracking', label: 'Nomor resi / link packing', placeholder: 'Nomor resi atau link tracking' },
      ],
    },
    shipped: {
      label: 'Barang dikirim ke customer',
      helper: 'Isi kurir dan nomor resi final agar customer bisa tracking barang.',
      fields: [
        { key: 'courier', label: 'Kurir pengiriman', placeholder: 'JNE / J&T / Pos / lainnya' },
        { key: 'tracking', label: 'Nomor resi / link tracking', placeholder: 'Masukkan nomor resi atau link tracking' },
      ],
    },
    completed: {
      label: 'Pesanan selesai',
      helper: 'Isi kurir dan nomor resi final sebelum menutup pesanan sebagai selesai.',
      fields: [
        { key: 'courier', label: 'Kurir / jasa pengiriman', placeholder: 'JNE / J&T / Pos / lainnya' },
        { key: 'tracking', label: 'Nomor resi / link tracking', placeholder: 'Masukkan nomor resi atau link tracking' },
      ],
    },
  };
  const visibleStatuses = Object.entries(orderStatuses).filter(([value]) => value !== 'packed');
  const visibleLifecycleStages = lifecycle.stages.filter((stage) => stage.id !== 'packed');
  const internalFlowOrder = ['new', 'confirmed', 'purchased', 'arrived', 'packed', 'shipped', 'completed'];
  const visibleFlowOrder = ['new', 'confirmed', 'purchased', 'arrived', 'shipped', 'completed'];
  const visibleStatus = status === 'packed' ? 'arrived' : status;
  const reviewVisibleStatus = reviewStatus === 'packed' ? 'arrived' : reviewStatus;
  const currentStepIndex = internalFlowOrder.indexOf(status);
  const terminalDisplayStatus = status === 'cancelled' && order.cancellation_type === 'return' ? 'cancelled_returned' : visibleStatus;
  const displayStatus = reviewVisibleStatus ?? terminalDisplayStatus;
  const displayStatusIndex = visibleFlowOrder.indexOf(displayStatus);
  const currentVisibleIndex = displayStatusIndex >= 0 ? displayStatusIndex : 0;
  const isReviewMode = reviewStatus !== null && reviewStatus !== status;
  const nextStatus = internalFlowOrder[Math.min(currentStepIndex + 1, internalFlowOrder.length - 1)];
  const statusTransition = transitionRequirements[displayStatus];
  const statusSteps = visibleFlowOrder.map((value, index) => ({
    value,
    label: orderStatuses[value] || value,
    current: displayStatus === value,
    done: index < currentVisibleIndex,
    upcoming: index > currentVisibleIndex,
    review: reviewVisibleStatus === value,
  }));
  const persistDraft = (draft: Record<string, string>) => {
    const snapshot = createOrderDraftSnapshot(draft);
    setSavedDraft(snapshot);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(`order-draft-${order.id}`, JSON.stringify(snapshot));
    }
  };
  const readPreview = (file: File | null) => new Promise<string | null>((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
  const validImageSource = (source: string | null | undefined) => {
    if (!source) return '';
    return /^data:image\//.test(source) || /^https?:\/\//.test(source) ? source : '';
  };
  const openWhatsApp = (text: string) => {
    window.open(
      `https://wa.me/${normalizePhone(order.phone)}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
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
  const canCancelUnpaid = order.status === 'new' && paid === 0;
  const canCancelReturn = !['cancelled', 'completed'].includes(order.status) && (paid > 0 || order.status !== 'new');
  useEffect(() => {
    const draft: Record<string, string> = {
      ...(savedDraft || {}),
      courier: courier || savedDraft.courier || order.courier || '',
      tracking: tracking || savedDraft.tracking || order.tracking_number || '',
      productPhoto: productPhoto?.name || savedDraft.productPhoto || savedDraft.productPhotoName || '',
      productPhotoPreview: productPhotoPreview || savedDraft.productPhotoPreview || '',
      receiptPhoto: receiptPhoto?.name || savedDraft.receiptPhoto || savedDraft.receiptPhotoName || '',
      receiptPhotoPreview: receiptPhotoPreview || savedDraft.receiptPhotoPreview || '',
      status,
    };
    persistDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, courier, tracking, productPhoto, receiptPhoto, productPhotoPreview, receiptPhotoPreview]);
  return (
    <article className="panel order-detail">
      {order.status === 'new' && !order.order_payments.some((payment) => payment.verified_at) && (
        <div className="payment-attention" role="status">
          <strong>Menunggu konfirmasi pembayaran</strong>
          <span>Cek bukti transfer di bawah, lalu klik Konfirmasi bayar setelah dana dan bukti sudah cocok.</span>
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
                <dd>{order.phone}</dd>
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
            {order.order_payments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <strong>{rupiah(Number(payment.amount_idr))}</strong>
                <span>{payment.reference}</span>
                <small>
                  {payment.verified_at ? 'Terverifikasi' : 'Menunggu konfirmasi'}
                </small>
                <div className="payment-row-actions">
                  {payment.verified_at ? (
                    <a
                      className="payment-primary-action"
                      href={`https://wa.me/${normalizePhone(order.phone)}?text=${encodeURIComponent(whatsappTemplates.paymentConfirmation)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Kirim ke WhatsApp
                    </a>
                  ) : (
                    <button
                      className="payment-primary-action"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await rpc('commerce_verify_payment', {
                            p_payment_id: payment.id,
                          });
                          window.open(
                            `https://wa.me/${normalizePhone(order.phone)}?text=${encodeURIComponent(whatsappTemplates.paymentConfirmation)}`,
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
            <div className="order-status-stepper" aria-label="Order status progression">
              {statusSteps.map((step) => (
                <button
                  key={step.value}
                  type="button"
                  className={`order-status-step ${step.current ? 'current' : step.done ? 'done' : 'upcoming'} ${step.review ? 'review' : ''}`}
                  onClick={() => {
                    if (step.done) {
                      setReviewStatus(step.value);
                    } else if (step.current) {
                      setReviewStatus(null);
                    }
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayStatus === 'purchased') {
                if (!productPhoto && !savedDraft.productPhoto) {
                  setMessage('Upload foto produk sebelum lanjut ke tahap berikutnya.');
                  return;
                }
                if (!receiptPhoto && !savedDraft.receiptPhoto) {
                  setMessage('Upload foto resi / bukti pembelian sebelum lanjut ke tahap berikutnya.');
                  return;
                }
              } else {
                const requiredFieldKeys = statusTransition?.fields.map((item) => item.key) ?? [];
                const missingField = requiredFieldKeys.find((key) => !String(key === 'courier' ? courier : tracking).trim());
                if (missingField) {
                  const missingFieldLabel = statusTransition?.fields.find((item) => item.key === missingField)?.label ?? 'data yang dibutuhkan';
                  setMessage(`Isi ${missingFieldLabel.toLowerCase()} sebelum lanjut ke status berikutnya.`);
                  return;
                }
              }
              void action(async () => {
                const advanceTarget = status === 'arrived' && nextStatus === 'packed' ? 'shipped' : nextStatus;
                const stepsToAdvance = status === 'arrived' && nextStatus === 'packed'
                  ? ['packed', 'shipped']
                  : [nextStatus];

                for (const nextTarget of stepsToAdvance) {
                  await rpc('commerce_update_order', {
                    p_order_id: order.id,
                    p_status: nextTarget,
                    p_courier: courier,
                    p_tracking: tracking,
                  });
                }

                const draft = {
                  courier,
                  tracking,
                  productPhoto: productPhoto?.name || savedDraft.productPhoto || '',
                  receiptPhoto: receiptPhoto?.name || savedDraft.receiptPhoto || '',
                  status: advanceTarget,
                };
                persistDraft(draft);
                setReviewStatus(null);
                setStatus(advanceTarget);
              });
            }}
          >
            <fieldset
              disabled={busy || ['cancelled', 'completed'].includes(order.status) || isReviewMode}
            >
              {statusTransition && (
                <div className="order-status-transition-block">
                  <strong>{statusTransition.label}</strong>
                  <p>{statusTransition.helper}</p>
                  {displayStatus === 'purchased' && (
                    <>
                      <label>
                        Foto produk
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setProductPhoto(nextFile);
                            setProductPhotoPreview(await readPreview(nextFile));
                          }}
                        />
                        {(() => {
                          const imageSource = validImageSource(productPhotoPreview || savedDraft.productPhotoPreview || '');
                          const hasPreview = Boolean(imageSource);
                          return hasPreview ? (
                            <div className="order-status-image-preview">
                              <a
                                href={imageSource}
                                target="_blank"
                                rel="noreferrer"
                                className="order-status-image-link"
                                onClick={(event) => {
                                  if (!imageSource) event.preventDefault();
                                }}
                              >
                                <img
                                  src={imageSource}
                                  alt="Foto produk yang tersimpan"
                                />
                              </a>
                              <span>{productPhoto?.name || savedDraft.productPhoto || savedDraft.productPhotoName || 'Foto produk'}</span>
                            </div>
                          ) : (
                            <div className="order-status-image-preview order-status-image-empty">
                              <span>Belum ada foto produk</span>
                            </div>
                          );
                        })()}
                      </label>
                      <label>
                        Foto resi / bukti pembelian
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setReceiptPhoto(nextFile);
                            setReceiptPhotoPreview(await readPreview(nextFile));
                          }}
                        />
                        {(() => {
                          const imageSource = validImageSource(receiptPhotoPreview || savedDraft.receiptPhotoPreview || '');
                          const hasPreview = Boolean(imageSource);
                          return hasPreview ? (
                            <div className="order-status-image-preview">
                              <a
                                href={imageSource}
                                target="_blank"
                                rel="noreferrer"
                                className="order-status-image-link"
                                onClick={(event) => {
                                  if (!imageSource) event.preventDefault();
                                }}
                              >
                                <img
                                  src={imageSource}
                                  alt="Foto resi yang tersimpan"
                                />
                              </a>
                              <span>{receiptPhoto?.name || savedDraft.receiptPhoto || savedDraft.receiptPhotoName || 'Foto resi'}</span>
                            </div>
                          ) : (
                            <div className="order-status-image-preview order-status-image-empty">
                              <span>Belum ada foto resi</span>
                            </div>
                          );
                        })()}
                      </label>
                    </>
                  )}
                  {['arrived', 'shipped'].includes(displayStatus) && statusTransition.fields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <input
                        maxLength={field.key === 'courier' ? 100 : 200}
                        value={field.key === 'courier' ? courier : tracking}
                        onChange={(event) => {
                          if (field.key === 'courier') setCourier(event.target.value);
                          else setTracking(event.target.value);
                        }}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </div>
              )}

              {!isReviewMode && (
                <button type="submit" className="commerce-primary">
                  Simpan & lanjut ke step berikutnya
                </button>
              )}
            </fieldset>
            {isReviewMode && (
              <div className="order-status-review-note">
                <strong>Tahap ini sudah tersimpan.</strong>
                <p>Ini hanya review data untuk step yang sudah selesai. Buka step aktif untuk melanjutkan proses berikutnya.</p>
                <button
                  type="button"
                  className="commerce-secondary"
                  onClick={() => setReviewStatus(null)}
                >
                  Kembali ke step aktif
                </button>
              </div>
            )}
            <p className="commerce-help">
              Setiap tahap akan tersimpan dan dibuka kembali untuk review. Setelah satu step selesai, sistem lanjut ke step berikutnya secara berurutan.
            </p>
          </form>
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
