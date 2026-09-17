import { contentPlanConfig, contentPlanSlots } from "./content-plan-data.ts";

export type ContentStatus = "Planned" | "Product Selected" | "Generated" | "Needs Review" | "Ready" | "Posted" | "Skipped";
export type ContentPeriod = "Siang" | "Malam";
export type ContentSlot = (typeof contentPlanSlots)[number];

export type ContentVariant = {
  id: string | null;
  name?: string | null;
  option1_value?: string | null;
  option2_value?: string | null;
  photo_url?: string | null;
  price_idr: number;
};

export type ContentProduct = {
  id: string;
  name: string;
  brand?: string | null;
  category: string;
  product_type?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  description?: string | null;
  verified_short_fact?: string | null;
  photo_url?: string | null;
  brand_origin?: string | null;
  evidence?: {
    requested?: { product_id: string } | null;
    staff_pick?: { product_id: string } | null;
    trending?: { product_id: string; valid_until: string } | null;
  };
};

type ChannelResult = { copy: string; posts: { text: string; image_reference: string | null }[] };

export type GeneratedContent = {
  generation_key: string;
  campaign_id: string;
  plan_version: string;
  slot_id: string;
  date: string;
  time: string;
  period: ContentPeriod;
  product_id: string;
  variant_id: string | null;
  planned_angle: string;
  applied_angle: string;
  fallback_reason: string | null;
  threads: ChannelResult;
  x: ChannelResult;
  raw_product_image: { reference: string | null; source: "product.raw_images"; is_raw: true };
  missing_fields: string[];
  validation: {
    trip_preserved: boolean;
    wa_exact: boolean;
    claims_grounded: boolean;
    length_valid: boolean;
    raw_image_valid: boolean;
    unresolved_variables: boolean;
  };
  ready_to_publish: boolean;
  status: ContentStatus;
};

const FALLBACK_THREADS = `[OPEN PO JASTIP MALAYSIA 🇲🇾]

PO sampai 23 Oct 2026
Shopping 4–7 Nov 2026
ETA Indonesia 17 Nov 2026 📦

cek detail titipan yang ini dulu yaa.

[PRODUCT NAME] — [PRICE]
[SHORT PRODUCT-SPECIFIC COMMENT]

mau nitip? join grup + kirim nama barangnya yaa ↓
${contentPlanConfig.waUrl}`;

const FALLBACK_X = `[OPEN PO JASTIP MALAYSIA 🇲🇾]
PO 23 Oct 2026 • Shopping 4–7 Nov 2026 • ETA Indo 17 Nov 2026
cek yang ini ya.
[PRODUCT NAME] — [PRICE]
[SHORT PRODUCT-SPECIFIC COMMENT]
Join grup + order/request ↓
${contentPlanConfig.waUrl}`;

const categoryMatches = (planned: string, actual: string) => {
  if (planned === "Semua") return true;
  const value = actual.toLowerCase();
  const patterns: Record<string, RegExp> = {
    Beauty: /beauty|skincare|makeup|kosmetik|kecantikan/,
    Fashion: /fashion|pakaian|baju|hijab|shawl|clothing/,
    Snacks: /snack|makanan|minuman|food|drink/,
    Accessories: /accessor|aksesor/,
    Lifestyle: /lifestyle|rumah|home/,
  };
  return patterns[planned]?.test(value) ?? value.includes(planned.toLowerCase());
};

export const formatContentPrice = (value: number) =>
  `Rp${Math.round(value).toLocaleString("id-ID")}`;

export const xWeightedLength = (text: string) => {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  return Array.from(withoutUrls).length + urls.length * 23;
};

const normalise = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const variantName = (variant: ContentVariant) =>
  [variant.option1_value, variant.option2_value].filter(Boolean).join(" / ") || variant.name || "";

export const productFactComment = (product: ContentProduct, variant: ContentVariant) => {
  if (product.verified_short_fact?.trim()) return product.verified_short_fact.trim();
  const selectedVariant = variantName(variant).trim();
  if (selectedVariant && !/^default$/i.test(selectedVariant)) return `Pilihan varian ${selectedVariant} untuk item ini.`;
  if (product.size?.trim()) return `Ukuran ${product.size.trim()} sesuai produk yang dipilih.`;
  if (product.material?.trim()) return `Material tercatat: ${product.material.trim()}.`;
  if (product.color?.trim()) return `Warna produk yang dipilih: ${product.color.trim()}.`;
  if (product.product_type?.trim()) return `Jenis produknya ${product.product_type.trim()}.`;
  return "";
};

const eligibility = (slot: ContentSlot, product: ContentProduct, variant: ContentVariant) => {
  if (!categoryMatches(slot.category, product.category)) return `Kategori produk tidak sesuai ${slot.category}.`;
  const angle = slot.angle.toUpperCase();
  if (angle.includes("UNDER 300K") && !(variant.price_idr > 0 && variant.price_idr < 300000)) return "Harga harus kurang dari Rp300.000.";
  if (angle.includes("UNDER 500K") && !(variant.price_idr > 0 && variant.price_idr < 500000)) return "Harga harus kurang dari Rp500.000.";
  if (angle.includes("LOCAL BRAND") && product.brand_origin !== "MY") return "Asal brand Malaysia belum terverifikasi.";
  if (angle.includes("REQUESTED") && product.evidence?.requested?.product_id !== product.id) return "Bukti request untuk produk ini belum tersedia.";
  if (angle.includes("STAFF PICK") && product.evidence?.staff_pick?.product_id !== product.id) return "Pilihan tim untuk produk ini belum tercatat.";
  if (angle.includes("TRENDING")) {
    const evidence = product.evidence?.trending;
    if (!evidence || evidence.product_id !== product.id || evidence.valid_until < slot.date) return "Bukti tren yang masih berlaku belum tersedia.";
  }
  return null;
};

const inject = (template: string, product: ContentProduct, variant: ContentVariant, comment: string) => {
  const values: Record<string, string> = {
    "[PRODUCT NAME]": product.name?.trim() || "",
    "[PRICE]": variant.price_idr > 0 ? formatContentPrice(variant.price_idr) : "",
    "[BRAND]": product.brand?.trim() || "",
    "[VARIANT]": variantName(variant),
    "[SHORT PRODUCT-SPECIFIC COMMENT]": comment,
  };
  return normalise(Object.entries(values).reduce((copy, [key, value]) => copy.split(key).join(value), template));
};

const extractCta = (template: string) => {
  const lines = template.split("\n").map((line) => line.trim()).filter(Boolean);
  const linkIndex = lines.findIndex((line) => line === contentPlanConfig.waUrl);
  return linkIndex > 0 ? lines[linkIndex - 1] : "Join grup + order/request ↓";
};

const makePosts = (
  channel: "threads" | "x",
  fullCopy: string,
  slot: ContentSlot,
  productLine: string,
  comment: string,
  image: string | null,
  template: string,
) => {
  const limit = channel === "x" ? contentPlanConfig.xMaxLength : contentPlanConfig.threadsMaxLength;
  const measure = channel === "x" ? xWeightedLength : (text: string) => Array.from(text).length;
  if (measure(fullCopy) <= limit) return { posts: [{ text: fullCopy, image_reference: image }], valid: true };
  const trip = channel === "x"
    ? "[OPEN PO JASTIP MALAYSIA 🇲🇾]\nPO 23 Oct 2026 • Shopping 4–7 Nov 2026 • ETA Indo 17 Nov 2026"
    : "[OPEN PO JASTIP MALAYSIA 🇲🇾]\n\nPO sampai 23 Oct 2026\nShopping 4–7 Nov 2026\nETA Indonesia 17 Nov 2026 📦";
  const bridge = channel === "x" ? slot.bridgeX : slot.bridgeThreads;
  const cta = extractCta(template);
  const firstCta = channel === "x" ? "Join grup + order ↓" : "join grup + order ↓";
  let first = normalise(`${trip}\n${bridge}\n${productLine}\n${firstCta}\n${contentPlanConfig.waUrl}`);
  if (measure(first) > limit) first = normalise(`${trip}\n${productLine}\n${firstCta}\n${contentPlanConfig.waUrl}`);
  const second = normalise(`${productLine}\n${comment}\n${cta}\n${contentPlanConfig.waUrl}`);
  return {
    posts: [first, second].map((text) => ({ text, image_reference: image })),
    valid: measure(first) <= limit && measure(second) <= limit,
  };
};

const waOnce = (text: string) => text.split(contentPlanConfig.waUrl).length - 1 === 1;

export function findContentSlot(date: string, period: ContentPeriod) {
  const matches = contentPlanSlots.filter((slot) => slot.date === date && slot.period === period);
  return matches.length === 1 ? matches[0] : null;
}

export function generateContent(input: {
  slot: ContentSlot;
  time?: string;
  product: ContentProduct;
  variant: ContentVariant;
}): GeneratedContent {
  const { slot, product, variant } = input;
  const image = variant.photo_url?.trim() || product.photo_url?.trim() || null;
  const missing: string[] = [];
  if (!product.name?.trim()) missing.push("product.name");
  if (!(variant.price_idr > 0)) missing.push("variant.price_idr");
  if (!product.category?.trim()) missing.push("product.category");
  if (!image) missing.push("raw_product_image");

  const fallbackReason = eligibility(slot, product, variant);
  const comment = productFactComment(product, variant);
  const threadsTemplate = fallbackReason ? FALLBACK_THREADS : slot.threadsTemplate;
  const xTemplate = fallbackReason ? FALLBACK_X : slot.xTemplate;
  const threadsCopy = inject(threadsTemplate, product, variant, comment);
  const xCopy = inject(xTemplate, product, variant, comment);
  const productLine = `${product.name?.trim() || ""} — ${variant.price_idr > 0 ? formatContentPrice(variant.price_idr) : ""}`.trim();
  const threadsPosts = makePosts("threads", threadsCopy, slot, productLine, comment, image, threadsTemplate);
  const xPosts = makePosts("x", xCopy, slot, productLine, comment, image, xTemplate);
  const allPosts = [...threadsPosts.posts, ...xPosts.posts];
  const unresolved = allPosts.some((post) => /\[[A-Z][A-Z -]+\]/.test(post.text));
  // On a two-post split the trip block belongs in post 1; post 2 deliberately
  // keeps the product, comment, CTA, and exact WA URL compact.
  const tripPreserved = [threadsPosts.posts, xPosts.posts].every((posts) => {
    const first = posts[0]?.text || "";
    return first.includes("23 Oct 2026") && first.includes("4–7 Nov 2026") && first.includes("17 Nov 2026");
  });
  const waExact = allPosts.every((post) => waOnce(post.text));
  const lengthValid = threadsPosts.valid && xPosts.valid;
  const failures = [...missing];
  if (!tripPreserved) failures.push("trip_details");
  if (!waExact) failures.push("wa_group_url");
  if (!lengthValid) failures.push("channel_length");
  if (unresolved) failures.push("unresolved_variables");
  const ready = failures.length === 0;
  const generationKey = [contentPlanConfig.campaignId, slot.id, product.id, variant.id || "default", contentPlanConfig.planVersion].join(":");
  return {
    generation_key: generationKey,
    campaign_id: contentPlanConfig.campaignId,
    plan_version: contentPlanConfig.planVersion,
    slot_id: slot.id,
    date: slot.date,
    time: input.time || slot.time,
    period: slot.period,
    product_id: product.id,
    variant_id: variant.id,
    planned_angle: slot.angle,
    applied_angle: fallbackReason ? "NEUTRAL" : slot.angle,
    fallback_reason: fallbackReason,
    threads: { copy: threadsCopy, posts: threadsPosts.posts },
    x: { copy: xCopy, posts: xPosts.posts },
    raw_product_image: { reference: image, source: "product.raw_images", is_raw: true },
    missing_fields: Array.from(new Set(failures)),
    validation: {
      trip_preserved: tripPreserved,
      wa_exact: waExact,
      claims_grounded: true,
      length_valid: lengthValid,
      raw_image_valid: Boolean(image),
      unresolved_variables: unresolved,
    },
    ready_to_publish: ready,
    status: ready ? "Generated" : "Needs Review",
  };
}
