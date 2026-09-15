import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ImageIcon, LoaderCircle, Sparkles, Upload } from "lucide-react";
import QRCode from "qrcode";

type GeneratorProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  photo_url?: string | null;
};

type GeneratorVariant = {
  id: string;
  name: string;
  photo_url?: string | null;
  local_price: number;
  weight_grams: number;
};

type Slide = { name: string; url: string };
type Theme = { background: string; panel: string; accent: string; ink: string; label: string };
type ImageChoice = { id: string; label: string; url: string; variant: GeneratorVariant; local?: boolean };

const SIZE = { width: 1080, height: 1350 };
const themes: Record<"fashion" | "food" | "health", Theme> = {
  fashion: { background: "#f5d0d2", panel: "#e8b9bc", accent: "#8b6650", ink: "#201b1b", label: "FASHION" },
  food: { background: "#f8e7a5", panel: "#f2d66f", accent: "#9b6828", ink: "#332413", label: "FOOD & DRINK" },
  health: { background: "#dcebd4", panel: "#bcd6ad", accent: "#527044", ink: "#1e2b1b", label: "HEALTH & WELLNESS" },
};

function themeFor(category: string) {
  if (/makanan|minuman|snack|food|drink/i.test(category)) return themes.food;
  if (/obat|kesehatan|suplemen|vitamin|health|medicine/i.test(category)) return themes.health;
  return themes.fashion;
}

function roundedStart(price: number) {
  return Math.max(0, Math.floor(price / 5000) * 5000);
}

function shortPrice(price: number) {
  return `${Math.round(price / 1000)}K`;
}

function proxiedUrl(url: string) {
  if (/^(data:|blob:)/i.test(url) || url.startsWith(window.location.origin)) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function loadImageOnce(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadImage(url: string) {
  try {
    return await loadImageOnce(proxiedUrl(url));
  } catch {
    return loadImageOnce(url);
  }
}

function coverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function wrapTwoLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      lines[lines.length - 1] = candidate;
    } else if (lines.length === 1) {
      lines.push(word);
    } else {
      break;
    }
  }
  return lines.filter(Boolean);
}

function drawBrand(ctx: CanvasRenderingContext2D, theme: Theme) {
  ctx.fillStyle = theme.ink;
  ctx.textAlign = "center";
  ctx.font = "500 66px Georgia, serif";
  ctx.fillText("E", SIZE.width / 2 - 17, 69);
  ctx.font = "500 61px Georgia, serif";
  ctx.fillText("C", SIZE.width / 2 + 17, 85);
  ctx.font = "500 12px Arial, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText("ELSEWHERE & CO.", SIZE.width / 2, 111);
  ctx.letterSpacing = "0px";
}

function wordsThatFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  let result = "";
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth) break;
    result = candidate;
  }
  return result || words[0] || "";
}

const slideDbName = "elsewhere-catalogue-studio";
function slideStore(mode: IDBTransactionMode) {
  return new Promise<IDBObjectStore>((resolve, reject) => {
    const request = indexedDB.open(slideDbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("slides");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.transaction("slides", mode).objectStore("slides"));
  });
}

async function loadSavedSlides(productId: string) {
  const store = await slideStore("readonly");
  return new Promise<Slide[]>((resolve) => {
    const request = store.get(productId);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => resolve([]);
  });
}

async function saveSlides(productId: string, slides: Slide[]) {
  const store = await slideStore("readwrite");
  await new Promise<void>((resolve, reject) => {
    const request = store.put(slides, productId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function baseCanvas(theme: Theme) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, SIZE.width, SIZE.height);
  return { canvas, ctx };
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

async function copyPng(url: string) {
  const blob = await (await fetch(url)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export default function CatalogueImageGenerator({
  product,
  variants,
  sellingPrice,
}: {
  product: GeneratorProduct;
  variants: GeneratorVariant[];
  sellingPrice: (variant: GeneratorVariant) => number;
}) {
  const variantChoices = useMemo<ImageChoice[]>(() => {
    const seen = new Set<string>();
    return variants
      .map((variant) => ({ id: variant.id, label: variant.name, variant, url: variant.photo_url || product.photo_url || "" }))
      .filter((item) => item.url && !seen.has(item.url) && seen.add(item.url));
  }, [product.photo_url, variants]);
  const [uploads, setUploads] = useState<ImageChoice[]>([]);
  const choices = useMemo(() => [...variantChoices, ...uploads], [variantChoices, uploads]);
  const [selected, setSelected] = useState<string[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const theme = themeFor(product.category);

  useEffect(() => {
    setSelected(choices.slice(0, 8).map((choice) => choice.id));
    void loadSavedSlides(product.id).then(saved => {
      setSlides(saved);
      if (saved.length) setMessage("Hasil generate terakhir dipulihkan otomatis.");
    });
  }, [product.id, variantChoices.length]);

  const chosen = choices.filter((choice) => selected.includes(choice.id));

  const addUploads = (files: FileList | null) => {
    if (!files?.length || !variants[0]) return;
    const incoming = Array.from(files).filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, 8 - uploads.length));
    const next = incoming.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      label: file.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(file),
      variant: variants[0],
      local: true,
    }));
    setUploads(current => [...current, ...next]);
    setSelected(current => [...current, ...next.map(item => item.id)].slice(0, 8));
    setSlides([]);
    setMessage(`${next.length} foto berhasil ditambahkan.`);
  };

  const generate = async () => {
    if (!chosen.length) {
      setMessage("Pilih minimal satu foto produk dulu.");
      return;
    }
    setBusy(true);
    setMessage("Menyiapkan gambar HD…");
    try {
      const attempts = await Promise.allSettled(chosen.map(async (choice) => ({ ...choice, image: await loadImage(choice.url) })));
      const loaded = attempts.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      const failedCount = attempts.length - loaded.length;
      if (!loaded.length) throw new Error("Semua foto gagal dimuat");
      const minPrice = Math.min(...loaded.map((item) => sellingPrice(item.variant)));

      const first = baseCanvas(theme);
      drawBrand(first.ctx, theme);
      first.ctx.fillStyle = theme.panel;
      roundedRect(first.ctx, 72, 145, 936, 820, 250);
      first.ctx.fill();
      first.ctx.save();
      roundedRect(first.ctx, 105, 175, 870, 755, 190);
      first.ctx.clip();
      coverImage(first.ctx, loaded[0].image, 105, 175, 870, 755);
      first.ctx.restore();
      first.ctx.strokeStyle = `${theme.accent}88`;
      first.ctx.lineWidth = 3;
      roundedRect(first.ctx, 105, 175, 870, 755, 190);
      first.ctx.stroke();
      first.ctx.fillStyle = theme.ink;
      first.ctx.textAlign = "center";
      const title = `${product.brand} ${product.name}`.toUpperCase();
      const titleSize = 46;
      first.ctx.font = `500 ${titleSize}px Georgia, serif`;
      const titleLines = wrapTwoLines(first.ctx, title, 860);
      const titleY = titleLines.length > 1 ? 1028 : 1062;
      titleLines.forEach((line, index) => first.ctx.fillText(line, SIZE.width / 2, titleY + index * (titleSize + 8)));
      first.ctx.font = "500 24px Arial, sans-serif";
      first.ctx.letterSpacing = "8px";
      first.ctx.fillText(theme.label, SIZE.width / 2, 1148);
      first.ctx.letterSpacing = "0px";
      first.ctx.strokeStyle = theme.accent;
      first.ctx.lineWidth = 2;
      roundedRect(first.ctx, 330, 1170, 420, 92, 46);
      first.ctx.stroke();
      first.ctx.font = "500 25px Arial, sans-serif";
      first.ctx.letterSpacing = "6px";
      const singleProduct = loaded.length === 1;
      first.ctx.fillText(singleProduct ? `PRICE  RP${sellingPrice(loaded[0].variant).toLocaleString("id-ID")}` : `START FROM  ${shortPrice(roundedStart(minPrice))}`, SIZE.width / 2, 1227);

      const second = baseCanvas(theme);
      second.ctx.fillStyle = theme.ink;
      second.ctx.textAlign = "center";
      second.ctx.font = "400 26px Arial, sans-serif";
      second.ctx.fillText("ELSEWHERE & CO", SIZE.width / 2, 72);
      second.ctx.font = "500 72px Georgia, serif";
      second.ctx.fillText("NEW COLLECTION", SIZE.width / 2, 158);
      const gridItems = loaded.slice(0, 4);
      for (let i = 0; i < gridItems.length; i++) {
        const item = gridItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 112 + col * 470;
        const y = 305 + row * 430;
        second.ctx.fillStyle = "#fffdfb";
        roundedRect(second.ctx, x, y, 386, 385, 18);
        second.ctx.fill();
        second.ctx.save();
        roundedRect(second.ctx, x, y, 386, 285, 18);
        second.ctx.clip();
        coverImage(second.ctx, item.image, x, y, 386, 285);
        second.ctx.restore();
        second.ctx.fillStyle = theme.ink;
        second.ctx.textAlign = "left";
        second.ctx.font = "500 17px Arial, sans-serif";
        const label = `${product.name} — ${item.variant.name}`.toUpperCase();
        second.ctx.fillText(wordsThatFit(second.ctx, label, 350), x + 18, y + 323);
        second.ctx.fillStyle = theme.accent;
        second.ctx.font = "700 23px Arial, sans-serif";
        second.ctx.fillText(`RP${sellingPrice(item.variant).toLocaleString("id-ID")}`, x + 18, y + 356);
      }
      second.ctx.fillStyle = theme.accent;
      roundedRect(second.ctx, 280, 1190, 520, 72, 36);
      second.ctx.fill();
      second.ctx.fillStyle = "white";
      second.ctx.textAlign = "center";
      second.ctx.font = "500 25px Arial, sans-serif";
      second.ctx.fillText("REQUEST? SEND BY WHATSAPP", SIZE.width / 2, 1236);

      const third = baseCanvas(theme);
      drawBrand(third.ctx, theme);
      third.ctx.fillStyle = theme.ink;
      third.ctx.textAlign = "center";
      third.ctx.font = "500 66px Georgia, serif";
      third.ctx.fillText("SCAN OUR BARCODE", SIZE.width / 2, 225);
      third.ctx.font = "italic 28px Arial, sans-serif";
      third.ctx.letterSpacing = "7px";
      third.ctx.fillText("TO FIND ALL ITEMS", SIZE.width / 2, 292);
      third.ctx.letterSpacing = "0px";
      const catalogueUrl = `${window.location.origin}/`;
      const qrUrl = await QRCode.toDataURL(catalogueUrl, { width: 660, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      const qr = await loadImage(qrUrl);
      third.ctx.fillStyle = "white";
      third.ctx.fillRect(180, 360, 720, 720);
      third.ctx.drawImage(qr, 210, 390, 660, 660);
      third.ctx.fillStyle = theme.ink;
      third.ctx.font = "500 28px Arial, sans-serif";
      third.ctx.letterSpacing = "8px";
      third.ctx.fillText("OR CLICK LINK IN BIO", SIZE.width / 2, 1165);

      const nextSlides = singleProduct ? [
        { name: "01-cover", url: first.canvas.toDataURL("image/png", 1) },
        { name: "02-qr", url: third.canvas.toDataURL("image/png", 1) },
      ] : [
        { name: "01-cover", url: first.canvas.toDataURL("image/png", 1) },
        { name: "02-collection", url: second.canvas.toDataURL("image/png", 1) },
        { name: "03-qr", url: third.canvas.toDataURL("image/png", 1) },
      ];
      setSlides(nextSlides);
      await saveSlides(product.id, nextSlides);
      const slideCount = nextSlides.length;
      setMessage(failedCount ? `${slideCount} slide HD berhasil dibuat. ${failedCount} foto bermasalah dilewati otomatis.` : `${slideCount} slide HD berhasil dibuat (1080 × 1350 px).`);
    } catch {
      setMessage("Ada foto yang tidak bisa diproses. Coba ganti foto atau upload ulang ke dashboard.");
    } finally {
      setBusy(false);
    }
  };

  const copySlide = async (slide: Slide) => {
    try {
      await copyPng(slide.url);
      setMessage(`${slide.name} sudah dicopy—langsung paste ke Canva.`);
    } catch {
      setMessage("Browser belum mengizinkan copy gambar. Gunakan tombol Download PNG.");
    }
  };

  return (
    <section className="catalogue-generator panel" style={{ "--generator-bg": theme.background, "--generator-accent": theme.accent } as React.CSSProperties}>
      <header className="generator-heading">
        <div><span>SMART CATALOGUE STUDIO</span><h2>Generate 3 slide katalog</h2><p>Pilih foto yang mau ditampilkan. Warna, nama, varian, harga, dan QR disusun otomatis.</p></div>
        <div className="hd-badge"><Sparkles size={16}/> HD 1080 × 1350</div>
      </header>

      {choices.length ? <>
        <div className="generator-tools">
          <label className="upload-generator-photo"><Upload size={17}/> Tambah foto dari perangkat<input type="file" accept="image/*" multiple onChange={event => { addUploads(event.target.files); event.currentTarget.value = ""; }}/></label>
        </div>
        <div className="generator-image-picker">
          {choices.map(({ id, label, url, local }) => {
            const active = selected.includes(id);
            return <button type="button" key={id} className={active ? "selected" : ""} onClick={() => setSelected(ids => active ? ids.filter(itemId => itemId !== id) : ids.length < 8 ? [...ids, id] : ids)}>
              <img src={url} alt={`${product.name} ${label}`}/><span>{label}</span>{local && <em>Upload</em>}{active && <i><Check size={14}/></i>}
            </button>;
          })}
        </div>
        <div className="generator-actions">
          <button type="button" className="generate-slides" disabled={busy || !selected.length} onClick={generate}>
            {busy ? <LoaderCircle className="spin" size={18}/> : <ImageIcon size={18}/>} {busy ? "Sedang generate…" : "Generate 3 slide HD"}
          </button>
          <small>Maksimal 8 foto. Slide koleksi menampilkan 4 pilihan pertama.</small>
        </div>
      </> : <div className="generator-empty"><ImageIcon size={24}/><p>Tambahkan foto produk atau foto varian dulu supaya slide bisa dibuat.</p></div>}

      {message && <p className="generator-message" role="status">{message}</p>}
      {slides.length > 0 && <div className="generated-slides">
        {slides.map((slide, index) => <article key={slide.name}>
          <div className="slide-preview"><img src={slide.url} alt={`Preview slide ${index + 1}`}/><b>{index + 1}</b></div>
          <strong>{slide.name.includes("cover") ? "Cover & harga" : slide.name.includes("collection") ? "Pilihan produk" : "QR katalog"}</strong>
          <div><button type="button" onClick={() => copySlide(slide)}><Copy size={14}/> Copy</button><button type="button" onClick={() => download(slide.url, `${product.brand}-${product.name}-${slide.name}.png`)}><Download size={14}/> PNG</button></div>
        </article>)}
        <button type="button" className="download-all" onClick={() => slides.forEach((slide, i) => setTimeout(() => download(slide.url, `${product.brand}-${product.name}-${slide.name}.png`), i * 250))}><Download size={16}/> Download semua {slides.length} slide</button>
      </div>}
    </section>
  );
}
