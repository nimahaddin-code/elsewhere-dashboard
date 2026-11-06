export type CatalogueVariant = {
  photo_url?: string | null;
  option1_value?: string | null;
  option2_value?: string | null;
  id: string;
  name: string;
  sale_mode: 'stock' | 'preorder';
  available: number | null;
  unit_price_idr: number | null;
};
export type CatalogueProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  photo_url: string;
  option1_label?: string | null;
  option2_label?: string | null;
  trip_code: string;
  trip_name: string;
  country: string;
  departure_date: string | null;
  return_date: string | null;
  product_variants: CatalogueVariant[];
};
export type Payment = {
  id: string;
  amount_idr: number;
  reference: string;
  receipt_path: string | null;
  verified_at: string | null;
  created_at: string;
};
export type Order = {
  id: string;
  order_code: string;
  trip_code: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  total_idr: number;
  status: string;
  cancellation_type?: 'unpaid' | 'return' | null;
  courier: string;
  tracking_number: string;
  created_at: string;
  order_items: {
    product_name: string;
    variant_name: string;
    quantity: number;
    unit_price_idr: number;
  }[];
  order_payments: Payment[];
};
export const orderStatuses: Record<string, string> = {
  new: 'Placed',
  confirmed: 'Paid',
  purchased: 'Purchased',
  arrived: 'Shipped to Indo',
  shipped: 'Shipped to Cust',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancelled_returned: 'Cancel & Return',
};
export const orderLifecycleStages = [
  { id: 'new', label: 'Placed', phase: 'place', description: 'Order sudah checkout dan bukti pembayaran terkirim' },
  { id: 'confirmed', label: 'Paid', phase: 'pay', description: 'Pembayaran sudah dikonfirmasi admin' },
  { id: 'purchased', label: 'Purchased', phase: 'shopping', description: 'Barang sudah dibeli dan masuk proses pembelian' },
  { id: 'arrived', label: 'Shipped to Indo', phase: 'shopping', description: 'Barang dikirim ke Indonesia' },
  { id: 'packed', label: 'Shipped to Indo', phase: 'shopping', description: 'Legacy alias: barang dikirim ke Indonesia' },
  { id: 'shipped', label: 'Shipped to Cust', phase: 'delivery', description: 'Barang dikirim ke customer' },
  { id: 'completed', label: 'Completed', phase: 'delivery', description: 'Pesanan selesai dan sudah diterima customer' },
] as const;

export const paidAmount = (order: Order) =>
  order.order_payments
    .filter((p) => p.verified_at)
    .reduce((sum, p) => sum + Number(p.amount_idr), 0);
export const paymentLabel = (order: Order) =>
  paidAmount(order) >= Number(order.total_idr)
    ? 'Lunas'
    : 'Belum dibayar';
export const effectiveOrderStatus = (order: Pick<Order, 'status' | 'cancellation_type'>) =>
  order.status === 'cancelled' && order.cancellation_type === 'return'
    ? 'cancelled_returned'
    : order.status;
export function getOrderLifecycle(order: Pick<Order, 'status' | 'cancellation_type' | 'courier' | 'tracking_number'>) {
  const stages = [...orderLifecycleStages];
  const effectiveStatus = effectiveOrderStatus(order);
  const current = stages.find((stage) => stage.id === order.status) ?? stages.find((stage) => stage.id === 'arrived') ?? stages[0];
  const currentIndex = stages.findIndex((stage) => stage.id === current.id);
  const progress = order.status === 'cancelled' ? 0 : Number(((currentIndex + 1) / stages.length).toFixed(2));
  const next = stages[Math.min(currentIndex + 1, stages.length - 1)];
  const phaseSummary = effectiveStatus === 'cancelled_returned'
    ? 'Pesanan dibatalkan dan dana/barang dikembalikan kepada customer.'
    : order.status === 'cancelled'
      ? 'Pesanan dihentikan sebelum pembayaran terverifikasi.'
      : ({
    place: 'Pesanan sudah checkout dan menunggu konfirmasi pembayaran.',
    pay: 'Pembayaran sudah diterima dan order siap dilanjutkan ke proses pembelian.',
    shopping: 'Barang sedang diproses, dibeli, dan dipersiapkan dari supplier ke Indonesia.',
    packing: 'Barang sudah sampai di Indonesia dan sedang disiapkan untuk pengiriman.',
    delivery: 'Pengiriman ke customer sedang berjalan sampai pesanan selesai.',
  }[current.phase] ?? 'Order sedang dipantau.');
  return {
    stages,
    current,
    next,
    progress,
    phaseSummary,
    currentLabel: orderStatuses[effectiveStatus] ?? current.label,
  };
}
export function orderWhatsAppTemplates(
  order: Pick<Order, 'customer_name' | 'order_code' | 'phone' | 'status' | 'cancellation_type' | 'courier' | 'tracking_number' | 'total_idr'> & {
    order_items?: Array<{
      product_name: string;
      variant_name?: string | null;
      quantity?: number | null;
    }>;
  },
) {
  const lifecycle = getOrderLifecycle(order);
  const statusUpdate = `Halo ${order.customer_name}, status pesanan ${order.order_code} saat ini: ${lifecycle.currentLabel}. ${lifecycle.phaseSummary} Jika ada perubahan, kami akan update kembali.`;
  const paymentReminder = `Halo ${order.customer_name}, berikut status pembayaran pesanan ${order.order_code}. Total tagihan ${Number(order.total_idr).toLocaleString('id-ID')} dan pembayaran masih belum terkonfirmasi. Mohon kirim bukti pembayaran agar proses order bisa lanjut.`;
  const proofSubmitted = `Halo Elsewhere, saya ingin konfirmasi pesanan ${order.order_code}. Bukti pembayaran sudah saya kirim dan saya menunggu konfirmasi dari tim.`;
  const productSummary = (order.order_items ?? []).length
    ? (order.order_items ?? [])
        .map((item) => `${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''} × ${item.quantity ?? 1}`)
        .join(', ')
    : 'Detail produk belum tersedia';
  const paymentConfirmation = `Halo ${order.customer_name}! Pembayaran untuk pesanan ${order.order_code} sudah kami terima. Pesananmu resmi terkonfirmasi yaa\n\n*Detail pesanan*\n• Produk: ${productSummary}\n• Total pembayaran: Rp${Number(order.total_idr).toLocaleString('id-ID')}\n• Estimasi tiba di Indonesia: 17 November 2026\n\nKami kabari lagi saat pesananmu siap dikirim atau kalau ada update lainnya. Thank you sudah titip di Elsewhere & Co. 🛍️`;
  const trackingUpdate = `Halo ${order.customer_name}, pesanan ${order.order_code} sudah masuk tahap pengiriman. Kurir: ${order.courier || 'sedang dipilih'}${order.tracking_number ? `. Resi: ${order.tracking_number}` : ''}. Mohon konfirmasi saat paket sampai.`;
  return {
    statusUpdate,
    paymentReminder,
    proofSubmitted,
    paymentConfirmation,
    trackingUpdate,
  };
}
export function createOrderDraftSnapshot(values: Record<string, string> = {}) {
  const productPhotoName = values.productPhotoName || values.productPhoto || '';
  const receiptPhotoName = values.receiptPhotoName || values.receiptPhoto || '';

  return {
    courier: values.courier || '',
    tracking: values.tracking || '',
    productPhoto: productPhotoName,
    productPhotoName,
    productPhotoPreview: values.productPhotoPreview || '',
    receiptPhoto: receiptPhotoName,
    receiptPhotoName,
    receiptPhotoPreview: values.receiptPhotoPreview || '',
    status: values.status || '',
  };
}
export function normalizePhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}
