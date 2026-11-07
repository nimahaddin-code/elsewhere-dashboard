import Decimal from 'decimal.js';
export const defaultMargin = (category: string) =>
  /makanan|food|snack|minuman/i.test(category) ? 20 : 25;
export const isFashion = (category: string) =>
  /^(fashion|pakaian|clothing|bags|tas|sepatu|shoes|accessories|aksesoris)$/i.test(
    category.trim(),
  );
export function calculatePrice(input: {
  localPrice: number;
  grams: number;
  category: string;
  margin?: number | null;
  rate: number;
  fashionCargo: number;
  otherCargo: number;
  flatFee?: number;
  // Overrides the category-based trip cargo rate (Rp per kg).
  cargoPerKg?: number;
}) {
  const flatFee = input.flatFee ?? 0;
  const margin = input.margin ?? defaultMargin(input.category);
  const cargoRate =
    input.cargoPerKg ??
    (isFashion(input.category) ? input.fashionCargo : input.otherCargo);
  const valid =
    [input.localPrice, input.grams, margin, cargoRate, flatFee].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) &&
    Number.isFinite(input.rate) &&
    input.rate > 0;
  if (!valid)
    return { productCost: 0, cargo: 0, capital: 0, profit: 0, sell: 0 };
  const productCost = new Decimal(input.localPrice).mul(input.rate);
  const cargo = new Decimal(input.grams).div(1000).mul(cargoRate);
  const capital = productCost.add(cargo);
  const sell = capital
    .mul(new Decimal(margin).div(100).add(1))
    .add(flatFee)
    .div(1000).ceil().mul(1000);
  return {
    productCost: productCost.toNumber(),
    cargo: cargo.toNumber(),
    capital: capital.toNumber(),
    profit: sell.sub(capital).toNumber(),
    sell: sell.toNumber(),
  };
}
// Calculator shipping options: `amount` is quoted per `perKg` kilograms.
export type ShippingMode = 'handcarry' | 'paket';
export const SHIPPING_RATES = {
  handcarry: { label: 'Hand carry', amount: 165, perKg: 10, inLocalCurrency: true },
  paket: { label: 'Paket', amount: 90000, perKg: 1, inLocalCurrency: false },
} as const;
export const shippingPerKg = (mode: ShippingMode, rate: number) => {
  const s = SHIPPING_RATES[mode];
  return (s.inLocalCurrency ? s.amount * rate : s.amount) / s.perKg;
};
// Accepts "14.90", "14,90" and "1.234,50"/"1,234.50": the last separator is the decimal point.
export function parseDecimal(raw: string) {
  const v = raw.replace(/\s/g, '');
  if (!v) return 0;
  const last = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'));
  const normalized =
    last < 0 ? v : `${v.slice(0, last).replace(/[.,]/g, '')}.${v.slice(last + 1)}`;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
