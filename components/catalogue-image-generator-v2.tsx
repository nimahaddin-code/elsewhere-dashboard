import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ImageIcon, Images, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { zipSync } from "fflate";
import QRCode from "qrcode";
import { cataloguePriceLabel, catalogueThemeFor, containRect, fitProductTitle } from "../lib/catalogue-template";

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
type ImageChoice = { id: string; label: string; url: string; variant: GeneratorVariant; local?: boolean };

const SIZE = { width: 1080, height: 1350 };
const EXPORT_SCALE = 4;

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
    try {
      return await loadImageOnce(url);
    } catch {
      throw new Error("Foto gagal dimuat");
    }
  }
}

function containImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const imageWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const imageHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const rect = containRect(imageWidth, imageHeight, x, y, w, h);
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawBrand(ctx: CanvasRenderingContext2D, theme: ReturnType<typeof catalogueThemeFor>) {
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

function baseCanvas(theme: ReturnType<typeof catalogueThemeFor>) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE.width * EXPORT_SCALE;
  canvas.height = SIZE.height * EXPORT_SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE.height);
  theme.gradientStops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE.width, SIZE.height);
  const glow = ctx.createRadialGradient(SIZE.width / 2, SIZE.height / 2, 40, SIZE.width / 2, SIZE.height / 2, 610);
  glow.addColorStop(0, "rgba(255,255,255,.72)");
  glow.addColorStop(0.58, "rgba(255,238,247,.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
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
  const theme = catalogueThemeFor(product.category);

  useEffect(() => {
    setSelected(choices.slice(0, 8).map((choice) => choice.id));
    void loadSavedSlides(product.id).then(saved => {
      setSlides(saved);
      if (saved.length) setMessage("Hasil generate terakhir dipulihkan otomatis.");
    });
    setCaption(localStorage.getItem(`elsewhere-caption-${product.id}`) || "");
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
      first.ctx.fillStyle = "rgba(255,255,255,.88)";
      first.ctx.textAlign = "center";
      first.ctx.font = "500 15px Arial, sans-serif";
      first.ctx.letterSpacing = "5px";
      first.ctx.fillText("ELSEWHERE & CO.", SIZE.width / 2, 45);
      first.ctx.letterSpacing = "0px";
      first.ctx.fillStyle = "rgba(255,250,253,.92)";
      roundedRect(first.ctx, 92, 70, 896, 126, 63);
      first.ctx.fill();
      first.ctx.strokeStyle = theme.panelBorder;
      first.ctx.lineWidth = 2;
      first.ctx.stroke();
      first.ctx.fillStyle = theme.ink;
      const title = product.name.toUpperCase();
      const fittedTitle = fitProductTitle((value, fontSize) => {
        first.ctx.font = `600 ${fontSize}px Georgia, serif`;
        return first.ctx.measureText(value).width;
      }, title, 790);
      first.ctx.font = `600 ${fittedTitle.fontSize}px Georgia, serif`;
      const titleStep = fittedTitle.fontSize + 5;
      const titleStartY = 133 - ((fittedTitle.lines.length - 1) * titleStep) / 2;
      fittedTitle.lines.forEach((line, index) => first.ctx.fillText(line, SIZE.width / 2, titleStartY + index * titleStep));
      first.ctx.fillStyle = theme.panel;
      roundedRect(first.ctx, 70, 225, 940, 850, 72);
      first.ctx.fill();
      first.ctx.strokeStyle = theme.panelBorder;
      first.ctx.lineWidth = 4;
      first.ctx.stroke();
      first.ctx.save();
      roundedRect(first.ctx, 92, 247, 896, 806, 54);
      first.ctx.clip();
      containImage(first.ctx, loaded[0].image, 116, 271, 848, 758);
      first.ctx.restore();
      const singleProduct = loaded.length === 1;
      first.ctx.fillStyle = "rgba(255,250,253,.94)";
      roundedRect(first.ctx, 270, 1120, 540, 142, 71);
      first.ctx.fill();
      first.ctx.strokeStyle = theme.panelBorder;
      first.ctx.lineWidth = 2;
      first.ctx.stroke();
      first.ctx.fillStyle = theme.accent;
      first.ctx.textAlign = "center";
      first.ctx.font = "700 18px Arial, sans-serif";
      first.ctx.letterSpacing = "5px";
      first.ctx.fillText("START FROM", SIZE.width / 2, 1163);
      first.ctx.letterSpacing = "0px";
      first.ctx.fillStyle = theme.ink;
      first.ctx.font = "600 43px Georgia, serif";
      first.ctx.fillText(cataloguePriceLabel(minPrice), SIZE.width / 2, 1225);

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
        second.ctx.fillStyle = "rgba(255,253,254,.94)";
        roundedRect(second.ctx, x, y, 386, 385, 18);
        second.ctx.fill();
        second.ctx.save();
        roundedRect(second.ctx, x, y, 386, 285, 18);
        second.ctx.clip();
        containImage(second.ctx, item.image, x + 12, y + 12, 362, 261);
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
      const displayPrice = minPrice;
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
    <section className="catalogue-generator panel" style={{ "--generator-bg": theme.gradientStops[2][1], "--generator-accent": theme.accent } as React.CSSProperties}>
      <header className="generator-heading">
        <div><span>SMART CATALOGUE STUDIO</span><h2>Generate katalog premium</h2><p>Satu layout terbaru dengan warna yang menyesuaikan kategori. Foto asli, nama, harga, dan QR disusun otomatis.</p></div>
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
