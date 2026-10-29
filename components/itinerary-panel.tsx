import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Shop = { id: string; name: string; items: string; done: boolean };
type Stop = { id: string; day: number; position: number; place: string; note: string; shops: Shop[] };

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

const clampDay = (v: string) => Math.min(60, Math.max(1, Math.floor(Number(v)) || 1));

export default function ItineraryPanel({ tripCode, tripName, departureDate }: { tripCode: string; tripName?: string; departureDate?: string | null }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | "all">("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ day: "1", time: "", place: "", note: "" });
  const [editingStop, setEditingStop] = useState<string | null>(null);
  const [stopDraft, setStopDraft] = useState({ day: "1", time: "", place: "", note: "" });
  const [addingShop, setAddingShop] = useState<string | null>(null);
  const [editingShop, setEditingShop] = useState<string | null>(null);
  const [shopDraft, setShopDraft] = useState({ name: "", items: "" });

  const load = async () => {
    const { data, error: err } = await supabase
      .from("trip_itinerary_stops")
      .select("id,day,position,place,note,shops")
      .eq("trip_code", tripCode)
      .order("day")
      .order("position")
      .order("created_at");
    if (err) setError("Gagal memuat itinerary");
    else { setError(""); setStops((data || []) as Stop[]); }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setFilter("all");
    void load();
  }, [tripCode]);

  const days = useMemo(() => {
    const map = new Map<number, Stop[]>();
    for (const s of stops) map.set(s.day, [...(map.get(s.day) || []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [stops]);

  const visible = filter === "all" ? days : days.filter(([d]) => d === filter);
  const totalShops = stops.reduce((n, s) => n + s.shops.length, 0);
  const doneShops = stops.reduce((n, s) => n + s.shops.filter((x) => x.done).length, 0);

  const addStop = async () => {
    const name = draft.place.trim();
    if (!name) return;
    const day = clampDay(draft.day);
    const position = stops.filter((s) => s.day === day).length;
    const { error: err } = await supabase.from("trip_itinerary_stops").insert({ trip_code: tripCode, day, position, place: name, note: joinNote(draft.time, draft.note) });
    if (err) { setError("Gagal menambah tempat"); return; }
    setDraft((d) => ({ ...d, time: "", place: "", note: "" }));
    setAdding(false);
    await load();
  };

  const startEditStop = (stop: Stop) => {
    const { time, rest } = splitNote(stop.note);
    setEditingStop(stop.id);
    setStopDraft({ day: String(stop.day), time, place: stop.place, note: rest });
  };

  const saveStop = async (stop: Stop) => {
    const name = stopDraft.place.trim();
    if (!name) return;
    const day = clampDay(stopDraft.day);
    const patch: Record<string, unknown> = { place: name, note: joinNote(stopDraft.time, stopDraft.note) };
    if (day !== stop.day) {
      patch.day = day;
      patch.position = stops.filter((s) => s.day === day).length;
    }
    const { error: err } = await supabase.from("trip_itinerary_stops").update(patch).eq("id", stop.id);
    if (err) setError("Gagal menyimpan");
    setEditingStop(null);
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
    const results = await Promise.all(
      order.map((s, i) => supabase.from("trip_itinerary_stops").update({ position: i }).eq("id", s.id)),
    );
    if (results.some((r) => r.error)) setError("Gagal mengubah urutan");
    await load();
  };

  const saveShops = async (stop: Stop, shops: Shop[]) => {
    setStops((all) => all.map((s) => (s.id === stop.id ? { ...s, shops } : s)));
    const { error: err } = await supabase.from("trip_itinerary_stops").update({ shops }).eq("id", stop.id);
    if (err) { setError("Gagal menyimpan"); await load(); }
  };

  const submitShop = (stop: Stop) => {
    const name = shopDraft.name.trim();
    if (!name) return;
    const items = shopDraft.items.trim();
    if (editingShop) {
      void saveShops(stop, stop.shops.map((x) => (x.id === editingShop ? { ...x, name, items } : x)));
    } else {
      void saveShops(stop, [...stop.shops, { id: crypto.randomUUID(), name, items, done: false }]);
    }
    setAddingShop(null);
    setEditingShop(null);
    setShopDraft({ name: "", items: "" });
  };

  return (
    <section className="itin">
      <header className="itin-head">
        <div>
          <span>Itinerary</span>
          <h2>{tripName || tripCode}</h2>
          <p>Tempat, toko, dan barang yang mau dicari. {totalShops > 0 && <b>{doneShops}/{totalShops} toko dicek</b>}</p>
        </div>
        <button className="itin-add-btn" onClick={() => setAdding((v) => !v)}><Plus size={16} /> Tambah tempat</button>
      </header>
      {error && <p role="alert" className="commerce-error">{error}</p>}

      {adding && (
        <form className="itin-form" onSubmit={(e) => { e.preventDefault(); void addStop(); }}>
          <label>Hari<input type="number" min={1} max={60} value={draft.day} onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))} /></label>
          <label>Jam<input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} /></label>
          <label className="wide">Tempat<input value={draft.place} maxLength={120} placeholder="mis. Pavilion KL" onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))} /></label>
          <label className="wide">Catatan<input value={draft.note} maxLength={450} placeholder="opsional" onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} /></label>
          <div className="itin-form-actions">
            <button type="button" onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" className="primary" disabled={!draft.place.trim()}>Simpan</button>
          </div>
        </form>
      )}

      {days.length > 1 && (
        <div className="itin-filter" role="tablist" aria-label="Pilih hari">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>Semua</button>
          {days.map(([d]) => (
            <button key={d} className={filter === d ? "on" : ""} onClick={() => setFilter(d)}>
              Hari {d}<small>{dayDate(departureDate, d, { day: "numeric", month: "short" })}</small>
            </button>
          ))}
        </div>
      )}

      {loading ? <p className="task-empty">Memuat…</p> : days.length === 0 ? <p className="task-empty">Belum ada rencana. Tambah tempat pertama.</p> : visible.map(([d, list]) => (
        <div className="itin-day" key={d}>
          <h3>
            <span className="itin-day-num">Hari {d}</span>
            <span>{dayDate(departureDate, d, { weekday: "long", day: "numeric", month: "long" })}</span>
            <small>{list.length} tempat</small>
          </h3>
          <div className="itin-table" role="table">
            <div className="itin-row itin-th" role="row">
              <span>Jam</span><span>Tempat</span><span>Toko & barang yang dicari</span><span>Catatan</span><span />
            </div>
            {list.map((stop, index) => {
              const { time, rest } = splitNote(stop.note);
              if (editingStop === stop.id) {
                return (
                  <form className="itin-row itin-editrow" key={stop.id} onSubmit={(e) => { e.preventDefault(); void saveStop(stop); }}>
                    <label>Hari<input type="number" min={1} max={60} value={stopDraft.day} onChange={(e) => setStopDraft((x) => ({ ...x, day: e.target.value }))} /></label>
                    <label>Jam<input type="time" value={stopDraft.time} onChange={(e) => setStopDraft((x) => ({ ...x, time: e.target.value }))} /></label>
                    <label className="wide">Tempat<input value={stopDraft.place} maxLength={120} onChange={(e) => setStopDraft((x) => ({ ...x, place: e.target.value }))} /></label>
                    <label className="wide">Catatan<input value={stopDraft.note} maxLength={450} onChange={(e) => setStopDraft((x) => ({ ...x, note: e.target.value }))} /></label>
                    <div className="itin-form-actions">
                      <button type="button" onClick={() => setEditingStop(null)}>Batal</button>
                      <button type="submit" className="primary" disabled={!stopDraft.place.trim()}>Simpan</button>
                    </div>
                  </form>
                );
              }
              return (
                <div className="itin-row" role="row" key={stop.id}>
                  <span className="itin-time" data-label="Jam">{time || "—"}</span>
                  <span className="itin-place" data-label="Tempat"><b>{stop.place}</b></span>
                  <span className="itin-shops-cell" data-label="Toko & barang">
                    {stop.shops.length === 0 && addingShop !== stop.id && <em>Belum ada toko</em>}
                    <ul>
                      {stop.shops.map((shop) => editingShop === shop.id ? (
                        <li key={shop.id}>
                          <form className="itin-shopform" onSubmit={(e) => { e.preventDefault(); submitShop(stop); }}>
                            <input autoFocus value={shopDraft.name} placeholder="Toko" onChange={(e) => setShopDraft((x) => ({ ...x, name: e.target.value }))} />
                            <input value={shopDraft.items} placeholder="Barang dicari" onChange={(e) => setShopDraft((x) => ({ ...x, items: e.target.value }))} />
                            <button type="button" onClick={() => { setEditingShop(null); setShopDraft({ name: "", items: "" }); }}>Batal</button>
                            <button type="submit" className="primary" disabled={!shopDraft.name.trim()}>Simpan</button>
                          </form>
                        </li>
                      ) : (
                        <li key={shop.id} className={shop.done ? "done" : ""}>
                          <button className="itin-check" aria-pressed={shop.done} aria-label={`Tandai ${shop.name}`} onClick={() => void saveShops(stop, stop.shops.map((x) => (x.id === shop.id ? { ...x, done: !x.done } : x)))}>
                            {shop.done ? <CheckCircle2 /> : <i />}
                          </button>
                          <span><b>{shop.name}</b>{shop.items && <small>{shop.items}</small>}</span>
                          <button className="ghost" aria-label={`Edit ${shop.name}`} onClick={() => { setAddingShop(null); setEditingShop(shop.id); setShopDraft({ name: shop.name, items: shop.items }); }}><Pencil size={13} /></button>
                          <button className="ghost" aria-label={`Hapus ${shop.name}`} onClick={() => void saveShops(stop, stop.shops.filter((x) => x.id !== shop.id))}><Trash2 size={13} /></button>
                        </li>
                      ))}
                    </ul>
                    {addingShop === stop.id ? (
                      <form className="itin-shopform" onSubmit={(e) => { e.preventDefault(); submitShop(stop); }}>
                        <input autoFocus value={shopDraft.name} placeholder="Toko, mis. Padini" onChange={(e) => setShopDraft((x) => ({ ...x, name: e.target.value }))} />
                        <input value={shopDraft.items} placeholder="Barang dicari" onChange={(e) => setShopDraft((x) => ({ ...x, items: e.target.value }))} />
                        <button type="button" onClick={() => { setAddingShop(null); setShopDraft({ name: "", items: "" }); }}>Batal</button>
                        <button type="submit" className="primary" disabled={!shopDraft.name.trim()}>Tambah</button>
                      </form>
                    ) : (
                      <button className="itin-addshop" onClick={() => { setEditingShop(null); setAddingShop(stop.id); setShopDraft({ name: "", items: "" }); }}><Plus size={13} /> Toko</button>
                    )}
                  </span>
                  <span className="itin-note" data-label="Catatan">{rest}</span>
                  <span className="itin-actions">
                    <button className="ghost" aria-label={`Naikkan ${stop.place}`} disabled={index === 0} onClick={() => void moveStop(list, index, -1)}><ArrowUp size={15} /></button>
                    <button className="ghost" aria-label={`Turunkan ${stop.place}`} disabled={index === list.length - 1} onClick={() => void moveStop(list, index, 1)}><ArrowDown size={15} /></button>
                    <button className="ghost" aria-label={`Edit ${stop.place}`} onClick={() => startEditStop(stop)}><Pencil size={15} /></button>
                    <button className="ghost" aria-label={`Hapus ${stop.place}`} onClick={() => void removeStop(stop)}><Trash2 size={15} /></button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
