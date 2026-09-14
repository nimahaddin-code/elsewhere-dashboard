export type CatalogueVariant = {
  photo_url?: string | null;
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
  new: 'Baru',
  confirmed: 'Dikonfirmasi',
  purchased: 'Sudah dibeli',
  arrived: 'Sudah tiba',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};
export const paidAmount = (order: Order) =>
  order.order_payments
    .filter((p) => p.verified_at)
    .reduce((sum, p) => sum + Number(p.amount_idr), 0);
export const paymentLabel = (order: Order) =>
  paidAmount(order) >= Number(order.total_idr)
    ? 'Lunas'
    : paidAmount(order) > 0
      ? 'DP diterima'
      : 'Belum dibayar';
export function normalizePhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}
