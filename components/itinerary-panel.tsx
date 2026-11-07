import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, MapPin, Pencil, Plus, Route, Store, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Shop = { id: string; name: string; items: string; done: boolean };
type Idea = { id: string; text: string; done: boolean };
type Stop = { id: string; day: number; position: number; place: string; note: string; shops: Shop[]; content: Idea[]; map_url: string; getting_there: string };
type StopDraft = { day: string; time: string; place: string; note: string; url: string; leg: string };

// Seeded notes start with the planned time, e.g. "19:40 · Pavilion ...".
const timeRe = /^(\d{1,2}:\d{2})\s*·\s*/;
const splitNote = (note: string) => {
  const m = note.match(timeRe);
  return m ? { time: m[1], rest: note.slice(m[0].length) } : { time: "", rest: note };
};
const joinNote = (time: string, rest: string) => [time.trim(), rest.trim()].filter(Boolean).join(" · ");

const dayDate = (departure: string | null | undefined, day: number, opts: Intl.DateTimeFormatOptions) => {
  if (!departure) return "";
  const d = new Date(departure + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + day - 1);
  return d.toLocaleDateString("id-ID", opts);
};

// Day number that matches today's date, or 0 when the trip is not under way.
const todayDay = (departure: string | null | undefined) => {
  if (!departure) return 0;
  const start = new Date(departure + "T00:00:00");
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - start.getTime()) / 86400000) + 1;
};

const safeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : "");
const clampDay = (v: string) => Math.min(60, Math.max(1, Math.floor(Number(v)) || 1));
const emptyDraft = (day = 1): StopDraft => ({ day: String(day), time: "", place: "", note: "", url: "", leg: "" });

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="isheet-backdrop" onMouseDown={onClose}>
      <div className="isheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="isheet-grabber" aria-hidden="true" />
        <div className="isheet-title">
          <button type="button" onClick={onClose}>Batal</button>
          <h3>{title}</h3>
          <span />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ItineraryPanel({ tripCode, tripName, departureDate }: { tripCode: string; tripName?: string; departureDate?: string | null }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | "all" | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [stopSheet, setStopSheet] = useState<{ id: string | null; draft: StopDraft } | null>(null);
  const [ideaSheet, setIdeaSheet] = useState<{ stopId: string; ideaId: string | null; text: string } | null>(null);
  const [shopSheet, setShopSheet] = useState<{ stopId: string; shopId: string | null; name: string; items: string } | null>(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from("trip_itinerary_stops")
      .select("id,day,position,place,note,shops,content,map_url,getting_there")
      .eq("trip_code", tripCode)
      .order("day")
      .order("position")
      .order("created_at");
    if (err) setError("Gagal memuat itinerary");
    else { setError(""); setStops(((data || []) as Stop[]).map((s) => ({ ...s, content: s.content || [] }))); }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setFilter(null);
    setOpen(new Set());
    void load();
  }, [tripCode]);

  const days = useMemo(() => {
    const map = new Map<number, Stop[]>();
    for (const s of stops) map.set(s.day, [...(map.get(s.day) || []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [stops]);

  // Default to today's day while travelling, otherwise the first day.
  const active: number | "all" = filter ?? (days.some(([d]) => d === todayDay(departureDate)) ? todayDay(departureDate) : days[0]?.[0] ?? "all");
  const visible = active === "all" ? days : days.filter(([d]) => d === active);
  const totalShops = stops.reduce((n, s) => n + s.shops.length, 0);
  const doneShops = stops.reduce((n, s) => n + s.shops.filter((x) => x.done).length, 0);

  const toggleOpen = (id: string) => setOpen((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const saveStop = async () => {
    if (!stopSheet) return;
    const { id, draft } = stopSheet;
    const name = draft.place.trim();
    if (!name) return;
    const day = clampDay(draft.day);
    const fields = { place: name, note: joinNote(draft.time, draft.note), map_url: safeUrl(draft.url), getting_there: draft.leg.trim() };
    const existing = id ? stops.find((s) => s.id === id) : undefined;
    const { error: err } = existing
      ? await supabase.from("trip_itinerary_stops").update(day !== existing.day ? { ...fields, day, position: stops.filter((s) => s.day === day).length } : fields).eq("id", existing.id)
      : await supabase.from("trip_itinerary_stops").insert({ trip_code: tripCode, day, position: stops.filter((s) => s.day === day).length, ...fields });
    if (err) { setError(existing ? "Gagal menyimpan" : "Gagal menambah tempat"); return; }
    setStopSheet(null);
    setFilter(day);
    await load();
  };

  const removeStop = async (stop: Stop) => {
    if (!window.confirm(`Hapus ${stop.place} beserta daftar tokonya?`)) return;
    const { error: err } = await supabase.from("trip_itinerary_stops").delete().eq("id", stop.id);
    if (err) setError("Gagal menghapus");
    await load();
  };

  const moveStop = async (list: Stop[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const order = [...list];
    [order[index], order[target]] = [order[target], order[index]];
    const results = await Promise.all(order.map((s, i) => supabase.from("trip_itinerary_stops").update({ position: i }).eq("id", s.id)));
    if (results.some((r) => r.error)) setError("Gagal mengubah urutan");
    await load();
  };

  const saveShops = async (stop: Stop, shops: Shop[]) => {
    setStops((all) => all.map((s) => (s.id === stop.id ? { ...s, shops } : s)));
    const { error: err } = await supabase.from("trip_itinerary_stops").update({ shops }).eq("id", stop.id);
    if (err) { setError("Gagal menyimpan"); await load(); }
  };

  const saveContent = async (stop: Stop, content: Idea[]) => {
    setStops((all) => all.map((s) => (s.id === stop.id ? { ...s, content } : s)));
    const { error: err } = await supabase.from("trip_itinerary_stops").update({ content }).eq("id", stop.id);
    if (err) { setError("Gagal menyimpan"); await load(); }
  };

  const submitIdea = () => {
    if (!ideaSheet) return;
    const stop = stops.find((s) => s.id === ideaSheet.stopId);
    const text = ideaSheet.text.trim();
    if (!stop || !text) return;
    void saveContent(stop, ideaSheet.ideaId
      ? stop.content.map((x) => (x.id === ideaSheet.ideaId ? { ...x, text } : x))
      : [...stop.content, { id: crypto.randomUUID(), text, done: false }]);
    setIdeaSheet(null);
  };

  const submitShop = () => {
    if (!shopSheet) return;
    const stop = stops.find((s) => s.id === shopSheet.stopId);
    const name = shopSheet.name.trim();
    if (!stop || !name) return;
    const items = shopSheet.items.trim();
    void saveShops(stop, shopSheet.shopId
      ? stop.shops.map((x) => (x.id === shopSheet.shopId ? { ...x, name, items } : x))
      : [...stop.shops, { id: crypto.randomUUID(), name, items, done: false }]);
    setShopSheet(null);
  };

  const setDraft = (patch: Partial<StopDraft>) => setStopSheet((s) => (s ? { ...s, draft: { ...s.draft, ...patch } } : s));
  const nextDay = typeof active === "number" ? active : 1;

  return (
    <section className="itin">
      <header className="itin-head">
        <div>
          <span>Itinerary</span>
          <h2>{tripName || tripCode}</h2>
          <p>{stops.length} tempat · {totalShops} toko{totalShops > 0 && <> · <b>{doneShops} dicek</b></>}</p>
        </div>
        <button className="itin-add-btn" onClick={() => setStopSheet({ id: null, draft: emptyDraft(nextDay) })}><Plus size={18} /> Tempat</button>
      </header>
      {error && <p role="alert" className="commerce-error">{error}</p>}

      {days.length > 0 && (
        <div className="itin-days" role="tablist" aria-label="Pilih hari">
          {days.map(([d, list]) => {
            const shops = list.reduce((n, s) => n + s.shops.length, 0);
            const done = list.reduce((n, s) => n + s.shops.filter((x) => x.done).length, 0);
            return (
              <button key={d} role="tab" aria-selected={active === d} className={(active === d ? "on " : "") + (shops > 0 && done === shops ? "complete" : "")} onClick={() => setFilter(d)}>
                <small>{dayDate(departureDate, d, { weekday: "short" }) || "Hari"}</small>
                <b>{d}</b>
                <em>{dayDate(departureDate, d, { day: "numeric", month: "short" }) || `${list.length} tempat`}</em>
              </button>
            );
          })}
          {days.length > 1 && <button role="tab" aria-selected={active === "all"} className={"all" + (active === "all" ? " on" : "")} onClick={() => setFilter("all")}><small>Semua</small><b>≡</b><em>{days.length} hari</em></button>}
        </div>
      )}

      {loading ? <p className="task-empty">Memuat…</p> : days.length === 0 ? (
        <div className="itin-empty"><MapPin size={28} aria-hidden="true" /><p>Belum ada rencana.</p><button className="primary" onClick={() => setStopSheet({ id: null, draft: emptyDraft(1) })}>Tambah tempat pertama</button></div>
      ) : visible.map(([d, list]) => {
        const shops = list.reduce((n, s) => n + s.shops.length, 0);
        const done = list.reduce((n, s) => n + s.shops.filter((x) => x.done).length, 0);
        return (
          <div className="itin-day" key={d}>
            <div className="itin-day-card">
              <div>
                <span>Hari {d}</span>
                <strong>{dayDate(departureDate, d, { weekday: "long", day: "numeric", month: "long" }) || `Hari ${d}`}</strong>
              </div>
              <div className="itin-day-stats">
                <b>{list.length}</b><small>tempat</small>
                <b>{done}/{shops}</b><small>toko</small>
              </div>
              <i className="itin-bar"><u style={{ width: (shops ? (done / shops) * 100 : 0) + "%" }} /></i>
            </div>

            <ol className="itin-timeline">
              {list.map((stop, index) => {
                const { time, rest } = splitNote(stop.note);
                const isOpen = open.has(stop.id);
                const shopDone = stop.shops.filter((x) => x.done).length;
                const mapUrl = safeUrl(stop.map_url);
                return (
                  <li key={stop.id} className={"itin-stop" + (isOpen ? " open" : "") + (stop.shops.length > 0 && shopDone === stop.shops.length ? " complete" : "")}>
                    {stop.getting_there && <div className="itin-leg"><Route size={14} aria-hidden="true" /><span>{stop.getting_there}</span></div>}
                    <div className="itin-card">
                      <button className="itin-card-head" aria-expanded={isOpen} onClick={() => toggleOpen(stop.id)}>
                        <span className="itin-time">{time || String(index + 1)}</span>
                        <span className="itin-card-main">
                          <b>{stop.place}</b>
                          <small>
                            {stop.shops.length > 0 ? <><Store size={13} aria-hidden="true" /> {shopDone}/{stop.shops.length} toko</> : "Belum ada toko"}{stop.content.length > 0 && <> · {stop.content.filter((x) => x.done).length}/{stop.content.length} konten</>}
                            {rest && !isOpen && <span className="itin-preview"> · {rest}</span>}
                          </small>
                        </span>
                        <ChevronDown className="itin-chev" size={20} aria-hidden="true" />
                      </button>

                      {(
                        <div className="itin-detail">
                          {rest && <p className="itin-note">{rest}</p>}
                          <div className="itin-col">
                          <h4>Toko & barang</h4>
                          <ul className="itin-shoplist">
                            {stop.shops.map((shop) => (
                              <li key={shop.id} className={shop.done ? "done" : ""}>
                                <button className="itin-shop-main" aria-pressed={shop.done} onClick={() => void saveShops(stop, stop.shops.map((x) => (x.id === shop.id ? { ...x, done: !x.done } : x)))}>
                                  <span className="itin-check">{shop.done ? <CheckCircle2 /> : <i />}</span>
                                  <span><b>{shop.name}</b>{shop.items && <small>{shop.items}</small>}</span>
                                </button>
                                <button className="ghost" aria-label={`Edit ${shop.name}`} onClick={() => setShopSheet({ stopId: stop.id, shopId: shop.id, name: shop.name, items: shop.items })}><Pencil size={16} /></button>
                                <button className="ghost" aria-label={`Hapus ${shop.name}`} onClick={() => void saveShops(stop, stop.shops.filter((x) => x.id !== shop.id))}><Trash2 size={16} /></button>
                              </li>
                            ))}
                            <li className="itin-addrow"><button onClick={() => setShopSheet({ stopId: stop.id, shopId: null, name: "", items: "" })}><Plus size={16} /> Tambah toko / barang</button></li>
                          </ul>
                          </div>
                          <div className="itin-col">
                          <h4>Konten</h4>
                          <ul className="itin-shoplist">
                            {stop.content.map((idea) => (
                              <li key={idea.id} className={idea.done ? "done" : ""}>
                                <button className="itin-shop-main" aria-pressed={idea.done} onClick={() => void saveContent(stop, stop.content.map((x) => (x.id === idea.id ? { ...x, done: !x.done } : x)))}>
                                  <span className="itin-check">{idea.done ? <CheckCircle2 /> : <i />}</span>
                                  <span><b>{idea.text}</b></span>
                                </button>
                                <button className="ghost" aria-label={`Edit ${idea.text}`} onClick={() => setIdeaSheet({ stopId: stop.id, ideaId: idea.id, text: idea.text })}><Pencil size={16} /></button>
                                <button className="ghost" aria-label={`Hapus ${idea.text}`} onClick={() => void saveContent(stop, stop.content.filter((x) => x.id !== idea.id))}><Trash2 size={16} /></button>
                              </li>
                            ))}
                            <li className="itin-addrow"><button onClick={() => setIdeaSheet({ stopId: stop.id, ideaId: null, text: "" })}><Plus size={16} /> Tambah ide konten</button></li>
                          </ul>
                          </div>
                          <div className="itin-actions">
                            {mapUrl && <a className="itin-map" href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden="true" /> Maps</a>}
                            <button onClick={() => { const { time: t, rest: r } = splitNote(stop.note); setStopSheet({ id: stop.id, draft: { day: String(stop.day), time: t, place: stop.place, note: r, url: stop.map_url || "", leg: stop.getting_there || "" } }); }}><Pencil size={16} /> Edit</button>
                            <button aria-label={`Naikkan ${stop.place}`} disabled={index === 0} onClick={() => void moveStop(list, index, -1)}><ArrowUp size={16} /></button>
                            <button aria-label={`Turunkan ${stop.place}`} disabled={index === list.length - 1} onClick={() => void moveStop(list, index, 1)}><ArrowDown size={16} /></button>
                            <button className="danger" aria-label={`Hapus ${stop.place}`} onClick={() => void removeStop(stop)}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      {stopSheet && (
        <Sheet title={stopSheet.id ? "Edit tempat" : "Tempat baru"} onClose={() => setStopSheet(null)}>
          <form className="isheet-form" onSubmit={(e) => { e.preventDefault(); void saveStop(); }}>
            <label className="wide">Tempat<input autoFocus value={stopSheet.draft.place} maxLength={120} placeholder="mis. Pavilion KL" onChange={(e) => setDraft({ place: e.target.value })} /></label>
            <label>Hari<input type="number" inputMode="numeric" min={1} max={60} value={stopSheet.draft.day} onChange={(e) => setDraft({ day: e.target.value })} /></label>
            <label>Jam<input type="time" value={stopSheet.draft.time} onChange={(e) => setDraft({ time: e.target.value })} /></label>
            <label className="wide">Catatan<input value={stopSheet.draft.note} maxLength={450} placeholder="opsional" onChange={(e) => setDraft({ note: e.target.value })} /></label>
            <label className="wide">Link Google Maps<input type="url" inputMode="url" value={stopSheet.draft.url} maxLength={500} placeholder="https://maps.google.com/…" onChange={(e) => setDraft({ url: e.target.value })} /></label>
            <label className="wide">Cara ke sini<input value={stopSheet.draft.leg} maxLength={300} placeholder="mis. Dari hotel: jalan kaki 5 menit" onChange={(e) => setDraft({ leg: e.target.value })} /></label>
            <button type="submit" className="primary" disabled={!stopSheet.draft.place.trim()}>Simpan</button>
          </form>
        </Sheet>
      )}

      {ideaSheet && (
        <Sheet title={ideaSheet.ideaId ? "Edit ide konten" : "Ide konten baru"} onClose={() => setIdeaSheet(null)}>
          <form className="isheet-form" onSubmit={(e) => { e.preventDefault(); submitIdea(); }}>
            <label className="wide">Ide / shot list<input autoFocus value={ideaSheet.text} maxLength={300} placeholder="mis. Reels haul Padini, foto OOTD di Pavilion" onChange={(e) => setIdeaSheet((s) => s && { ...s, text: e.target.value })} /></label>
            <button type="submit" className="primary" disabled={!ideaSheet.text.trim()}>Simpan</button>
          </form>
        </Sheet>
      )}

      {shopSheet && (
        <Sheet title={shopSheet.shopId ? "Edit toko" : "Toko baru"} onClose={() => setShopSheet(null)}>
          <form className="isheet-form" onSubmit={(e) => { e.preventDefault(); submitShop(); }}>
            <label className="wide">Toko<input autoFocus value={shopSheet.name} maxLength={120} placeholder="mis. Padini" onChange={(e) => setShopSheet((s) => s && { ...s, name: e.target.value })} /></label>
            <label className="wide">Barang yang dicari<input value={shopSheet.items} maxLength={300} placeholder="mis. blouse, tote bag" onChange={(e) => setShopSheet((s) => s && { ...s, items: e.target.value })} /></label>
            <button type="submit" className="primary" disabled={!shopSheet.name.trim()}>Simpan</button>
          </form>
        </Sheet>
      )}
    </section>
  );
}
