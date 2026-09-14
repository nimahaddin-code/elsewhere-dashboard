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
}) {
  const margin = input.margin ?? defaultMargin(input.category);
  const cargoRate = isFashion(input.category)
    ? input.fashionCargo
    : input.otherCargo;
  const valid =
    [input.localPrice, input.grams, margin, cargoRate].every(
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
    .div(1000).ceil().mul(1000);
  return {
    productCost: productCost.toNumber(),
    cargo: cargo.toNumber(),
    capital: capital.toNumber(),
    profit: sell.sub(capital).toNumber(),
    sell: sell.toNumber(),
  };
}
export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
