import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Crop, Download, ImageIcon, Images, LoaderCircle, RotateCcw, Save, Sparkles, Upload } from "lucide-react";
import { zipSync } from "fflate";
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
type CropSetting = { x: number; y: number; zoom: number };

const SIZE = { width: 1080, height: 1350 };
const EXPORT_SCALE = 4;
const themes: Record<"fashion" | "food" | "health" | "beauty", Theme> = {
  fashion: { background: "#f5d0d2", panel: "#e8b9bc", accent: "#8b6650", ink: "#201b1b", label: "FASHION" },
  food: { background: "#f8e7a5", panel: "#f2d66f", accent: "#9b6828", ink: "#332413", label: "FOOD & DRINK" },
  health: { background: "#dcebd4", panel: "#bcd6ad", accent: "#527044", ink: "#1e2b1b", label: "HEALTH & WELLNESS" },
  beauty: { background: "#dceff7", panel: "#bcddea", accent: "#507d91", ink: "#1d2d35", label: "BEAUTY" },
};

function themeFor(category: string) {
  if (/makanan|minuman|snack|food|drink/i.test(category)) return themes.food;
  if (/kecantikan|skincare|makeup|beauty|cosmetic/i.test(category)) return themes.beauty;
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

function highestResolutionUrl(url: string) {
  let upgraded = url;
  if (/img\.ltwebstatic\.com/i.test(upgraded)) {
    upgraded = upgraded.replace(/_thumbnail_\d+x(?:\d+)?(?=\.[a-z0-9]+(?:\?|$))/i, "");
  }
  if (/cdn\.shopify\.com/i.test(upgraded)) {
    upgraded = upgraded.replace(/_\d+x(?:\d+)?(?=\.[a-z0-9]+(?:\?|$))/i, "");
  }
  try {
    const parsed = new URL(upgraded);
    for (const key of ["w", "width", "h", "height", "resize", "quality", "q"]) parsed.searchParams.delete(key);
    upgraded = parsed.toString();
  } catch {
    // Keep non-URL sources such as data and blob URLs unchanged.
  }
  return upgraded;
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

function enhanceImage(img: HTMLImageElement) {
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(2.5, Math.max(1, 3000 / longestSide));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(image.data);
  const data = image.data;
  const width = canvas.width;
  const height = canvas.height;
  const amount = 0.22;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel];
        const surrounding = source[index - 4 + channel] + source[index + 4 + channel]
          + source[index - width * 4 + channel] + source[index + width * 4 + channel];
        data[index + channel] = Math.max(0, Math.min(255, center + amount * (center * 4 - surrounding)));
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function loadImage(url: string, enhance = true) {
  const candidates = [...new Set([highestResolutionUrl(url), url])];
  for (const candidate of candidates) {
    try {
      const loaded = await loadImageOnce(proxiedUrl(candidate));
      return enhance ? enhanceImage(loaded) : loaded;
    } catch {
      try {
        const loaded = await loadImageOnce(candidate);
        return enhance ? enhanceImage(loaded) : loaded;
      } catch {
        // Continue to the original thumbnail only when the full-size asset fails.
      }
    }
  }
  throw new Error("Foto gagal dimuat");
}

const defaultCrop: CropSetting = { x: 0, y: 0, zoom: 1 };

function coverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number, crop: CropSetting = defaultCrop) {
  const imageWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const imageHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const scale = Math.max(w / imageWidth, h / imageHeight);
  const sw = w / scale / crop.zoom;
  const sh = h / scale / crop.zoom;
  const maxX = Math.max(0, imageWidth - sw);
  const maxY = Math.max(0, imageHeight - sh);
  const sx = Math.max(0, Math.min(maxX, maxX / 2 + (crop.x / 100) * (maxX / 2)));
  const sy = Math.max(0, Math.min(maxY, maxY / 2 + (crop.y / 100) * (maxY / 2)));
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
  canvas.width = SIZE.width * EXPORT_SCALE;
  canvas.height = SIZE.height * EXPORT_SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "elsewhere-catalogue";
}

async function downloadSlidesZip(slides: Slide[], product: GeneratorProduct) {
  const baseName = safeFilename(`${product.brand}-${product.name}`);
  const entries: Record<string, Uint8Array> = {};
  await Promise.all(slides.map(async (slide) => {
    const bytes = new Uint8Array(await (await fetch(slide.url)).arrayBuffer());
    entries[`${baseName}-${slide.name}.png`] = bytes;
  }));
  const zip = zipSync(entries, { level: 6 });
  const zipBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([zipBuffer], { type: "application/zip" }));
  download(url, `${baseName}-slides.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyPng(url: string) {
  const blob = await (await fetch(url)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export default function CatalogueImageGenerator({
  product,
  variants,
  sellingPrice,
  tripCountry = "Malaysia",
}: {
  product: GeneratorProduct;
  variants: GeneratorVariant[];
  sellingPrice: (variant: GeneratorVariant) => number;
  tripCountry?: string;
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
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cropSettings, setCropSettings] = useState<Record<string, CropSetting>>({});
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const theme = themeFor(product.category);

  useEffect(() => {
    setSelected(choices.slice(0, 8).map((choice) => choice.id));
    void loadSavedSlides(product.id).then(saved => {
      setSlides(saved);
      if (saved.length) setMessage("Hasil generate terakhir dipulihkan otomatis.");
    });
    setCaption(localStorage.getItem(`elsewhere-caption-${product.id}`) || "");
    try {
      setCropSettings(JSON.parse(localStorage.getItem(`elsewhere-crops-${product.id}`) || "{}"));
    } catch {
      setCropSettings({});
    }
    setEditingCropId(null);
  }, [product.id, variantChoices.length]);

  const chosen = choices.filter((choice) => selected.includes(choice.id));
  const editingChoice = choices.find(choice => choice.id === editingCropId);
  const editingCrop = editingCropId ? cropSettings[editingCropId] || defaultCrop : defaultCrop;

  const updateCrop = (patch: Partial<CropSetting>) => {
    if (!editingCropId) return;
    setCropSettings(current => ({ ...current, [editingCropId]: { ...(current[editingCropId] || defaultCrop), ...patch } }));
  };

  const persistCrops = async () => {
    localStorage.setItem(`elsewhere-crops-${product.id}`, JSON.stringify(cropSettings));
    setMessage("Posisi foto tersimpan. Memperbarui slide HD…");
    await generate();
  };

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
    localStorage.setItem(`elsewhere-crops-${product.id}`, JSON.stringify(cropSettings));
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
      coverImage(first.ctx, loaded[0].image, 105, 175, 870, 755, cropSettings[loaded[0].id]);
      first.ctx.restore();
      first.ctx.strokeStyle = `${theme.accent}88`;
      first.ctx.lineWidth = 3;
      roundedRect(first.ctx, 105, 175, 870, 755, 190);
      first.ctx.stroke();
      first.ctx.fillStyle = theme.ink;
      first.ctx.textAlign = "center";
      const title = product.name.toUpperCase();
      const titleSize = 46;
      first.ctx.font = `500 ${titleSize}px Georgia, serif`;
      const titleLines = wrapTwoLines(first.ctx, title, 860);
      const titleY = titleLines.length > 1 ? 1024 : 1060;
      titleLines.forEach((line, index) => first.ctx.fillText(line, SIZE.width / 2, titleY + index * (titleSize + 8)));
      first.ctx.font = "500 24px Arial, sans-serif";
      first.ctx.letterSpacing = "8px";
      first.ctx.fillText(theme.label, SIZE.width / 2, 1172);
      first.ctx.letterSpacing = "0px";
      first.ctx.strokeStyle = theme.accent;
      first.ctx.lineWidth = 2;
      roundedRect(first.ctx, 330, 1194, 420, 92, 46);
      first.ctx.stroke();
      first.ctx.font = "500 25px Arial, sans-serif";
      first.ctx.letterSpacing = "6px";
      const singleProduct = loaded.length === 1;
      first.ctx.fillText(singleProduct ? `PRICE  RP${sellingPrice(loaded[0].variant).toLocaleString("id-ID")}` : `START FROM  ${shortPrice(roundedStart(minPrice))}`, SIZE.width / 2, 1251);

      const second = baseCanvas(theme);
      second.ctx.fillStyle = theme.ink;
      second.ctx.textAlign = "center";
      second.ctx.font = "400 26px Arial, sans-serif";
      second.ctx.fillText("ELSEWHERE & CO", SIZE.width / 2, 102);
      second.ctx.font = "500 72px Georgia, serif";
      second.ctx.fillText("NEW COLLECTION", SIZE.width / 2, 188);
      const gridItems = loaded.slice(0, 4);
      for (let i = 0; i < gridItems.length; i++) {
        const item = gridItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 112 + col * 470;
        const y = 275 + row * 430;
        second.ctx.fillStyle = "#fffdfb";
        roundedRect(second.ctx, x, y, 386, 385, 18);
        second.ctx.fill();
        second.ctx.save();
        roundedRect(second.ctx, x, y, 386, 285, 18);
        second.ctx.clip();
        coverImage(second.ctx, item.image, x, y, 386, 285, cropSettings[item.id]);
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
      const qrUrl = await QRCode.toDataURL(catalogueUrl, { width: 660 * EXPORT_SCALE, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      const qr = await loadImage(qrUrl, false);
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
      const displayPrice = singleProduct ? sellingPrice(loaded[0].variant) : roundedStart(minPrice);
      const isFood = /makanan|minuman|snack|food|drink/i.test(product.category);
      const isHealth = /obat|kesehatan|suplemen|vitamin|health|medicine/i.test(product.category);
      const intro = isFood
        ? "Pilihan camilan dan minuman yang cocok untuk stok di rumah atau jadi oleh-oleh."
        : isHealth
          ? "Pilihan produk wellness untuk melengkapi kebutuhan harianmu."
          : "Nyaman, versatile, dan gampang dipadukan untuk daily outfit.";
      const availability = singleProduct ? "Produk tersedia sesuai pilihan yang tertera." : "Tersedia dalam beberapa pilihan model dan varian.";
      const nextCaption = `${product.name} is here 🎀\n\n${intro}\n\n${singleProduct ? "Harga" : "Harga mulai"} Rp${displayPrice.toLocaleString("id-ID")}\nSudah termasuk jasa titip dan estimasi cargo ${tripCountry}–Indonesia.\n\n${availability} Lihat katalog melalui link in bio atau chat WhatsApp untuk order 💌\n\ngood things, found elsewhere.`;
      setCaption(nextCaption);
      localStorage.setItem(`elsewhere-caption-${product.id}`, nextCaption);
      const slideCount = nextSlides.length;
      setMessage(failedCount ? `${slideCount} slide Maximum HD berhasil dibuat. ${failedCount} foto bermasalah dilewati otomatis.` : `${slideCount} slide Maximum HD berhasil dibuat (4320 × 5400 px).`);
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

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setMessage("Caption sudah dicopy—langsung paste ke Instagram.");
    } catch {
      setMessage("Browser belum mengizinkan copy. Blok teks caption lalu copy manual.");
    }
  };

  const downloadAll = async () => {
    try {
      setMessage("Menyiapkan ZIP gambar HD…");
      await downloadSlidesZip(slides, product);
      setMessage(`${slides.length} gambar HD sudah dijadikan satu file ZIP.`);
    } catch {
      setMessage("ZIP gagal dibuat. Coba generate ulang lalu download lagi.");
    }
  };

  const saveToGallery = async () => {
    try {
      setMessage("Menyiapkan foto HD untuk galeri…");
      const baseName = safeFilename(`${product.brand}-${product.name}`);
      const files = await Promise.all(slides.map(async slide => {
        const blob = await (await fetch(slide.url)).blob();
        return new File([blob], `${baseName}-${slide.name}.png`, { type: "image/png" });
      }));
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
        await navigator.share({ files, title: `${product.name} — Elsewhere & Co.` });
        setMessage("Pilih Simpan Gambar/Save Image pada menu HP untuk memasukkannya ke galeri.");
        return;
      }
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        download(url, file.name);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      });
      setMessage("Perangkat ini memakai mode download. Foto tersimpan di Downloads dan dapat dibuka dari Galeri.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Penyimpanan ke galeri dibatalkan.");
      } else {
        setMessage("Foto belum bisa disimpan ke galeri. Gunakan Download ZIP sebagai alternatif.");
      }
    }
  };

  return (
    <section className="catalogue-generator panel" style={{ "--generator-bg": theme.background, "--generator-accent": theme.accent } as React.CSSProperties}>
      <header className="generator-heading">
        <div><span>SMART CATALOGUE STUDIO</span><h2>Generate 3 slide katalog</h2><p>Pilih foto yang mau ditampilkan. Warna, nama, varian, harga, dan QR disusun otomatis.</p></div>
        <div className="hd-badge"><Sparkles size={16}/> Maximum HD 4320 × 5400</div>
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
        <div className="crop-photo-buttons">
          {chosen.map(choice => <button type="button" key={choice.id} className={editingCropId === choice.id ? "active" : ""} onClick={() => setEditingCropId(choice.id)}><Crop size={14}/> Atur crop: {choice.label}</button>)}
        </div>
        {editingChoice && <section className="crop-editor">
          <div className="crop-editor-preview"><img src={editingChoice.url} alt={`Atur crop ${editingChoice.label}`} style={{ transform: `translate(${-editingCrop.x * 0.16}%, ${-editingCrop.y * 0.16}%) scale(${editingCrop.zoom})` }}/><span>Preview dari foto asli</span></div>
          <div className="crop-editor-controls">
            <div><strong>Atur posisi “{editingChoice.label}”</strong><p>Selalu diproses ulang dari foto asli—crop tidak ditumpuk dan kualitas tetap maksimal.</p></div>
            <label>Kiri ↔ kanan <input type="range" min="-100" max="100" value={editingCrop.x} onChange={event => updateCrop({ x: Number(event.target.value) })}/></label>
            <label>Atas ↕ bawah <input type="range" min="-100" max="100" value={editingCrop.y} onChange={event => updateCrop({ y: Number(event.target.value) })}/></label>
            <label>Zoom <input type="range" min="1" max="2.5" step="0.05" value={editingCrop.zoom} onChange={event => updateCrop({ zoom: Number(event.target.value) })}/></label>
            <div className="crop-editor-actions"><button type="button" onClick={() => updateCrop(defaultCrop)}><RotateCcw size={14}/> Kembali ke foto asli</button><button type="button" className="save-crop" disabled={busy} onClick={() => void persistCrops()}><Save size={14}/> Simpan & update slide</button></div>
          </div>
        </section>}
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
        <button type="button" className="download-all" onClick={downloadAll}><Download size={16}/> Download ZIP ({slides.length} slide)</button>
        <button type="button" className="save-gallery" onClick={() => void saveToGallery()}><Images size={16}/> Simpan ke galeri ({slides.length} foto)</button>
      </div>}
      {slides.length > 0 && caption && <section className="generated-caption">
        <div><span>CAPTION SIAP POST</span><h3>Copywriting otomatis</h3><p>Harga dan informasi mengikuti foto yang terakhir kamu generate.</p></div>
        <textarea readOnly value={caption} aria-label="Caption siap post"/>
        <button type="button" onClick={copyCaption}><Copy size={15}/> Copy caption</button>
      </section>}
    </section>
  );
}
