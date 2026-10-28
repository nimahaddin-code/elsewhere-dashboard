import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Shop = { id: string; name: string; items: string; done: boolean };
type Stop = { id: string; day: number; position: number; place: string; note: string; shops: Shop[] };

const dayLabel = (departure: string | null | undefined, day: number) => {
  if (!departure) return "";
  const d = new Date(departure + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + day - 1);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
};

export default function ItineraryPanel({ tripCode, tripName, departureDate }: { tripCode: string; tripName?: string; departureDate?: string | null }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(1);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [shopDrafts, setShopDrafts] = useState<Record<string, { name: string; items: string }>>({});

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
    void load();
  }, [tripCode]);

  const days = useMemo(() => {
    const map = new Map<number, Stop[]>();
    for (const s of stops) map.set(s.day, [...(map.get(s.day) || []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [stops]);

  const addStop = async () => {
    const name = place.trim();
    if (!name) return;
    const position = stops.filter((s) => s.day === day).length;
    const { error: err } = await supabase.from("trip_itinerary_stops").insert({ trip_code: tripCode, day, position, place: name, note: note.trim() });
    if (err) { setError("Gagal menambah tempat"); return; }
    setPlace("");
    setNote("");
    await load();
  };

  const removeStop = async (stop: Stop) => {
    if (!window.confirm(`Hapus ${stop.place} beserta daftar tokonya?`)) return;
    const { error: err } = await supabase.from("trip_itinerary_stops").delete().eq("id", stop.id);
    if (err) setError("Gagal menghapus");
    await load();
  };

  const saveShops = async (stop: Stop, shops: Shop[]) => {
    setStops((all) => all.map((s) => (s.id === stop.id ? { ...s, shops } : s)));
    const { error: err } = await supabase.from("trip_itinerary_stops").update({ shops }).eq("id", stop.id);
    if (err) { setError("Gagal menyimpan"); await load(); }
  };

  const addShop = (stop: Stop) => {
    const draft = shopDrafts[stop.id];
    if (!draft?.name.trim()) return;
    void saveShops(stop, [...stop.shops, { id: crypto.randomUUID(), name: draft.name.trim(), items: draft.items.trim(), done: false }]);
    setShopDrafts((d) => ({ ...d, [stop.id]: { name: "", items: "" } }));
  };

  const totalShops = stops.reduce((n, s) => n + s.shops.length, 0);
  const doneShops = stops.reduce((n, s) => n + s.shops.filter((x) => x.done).length, 0);

  return (
    <section className="itin">
      <header className="itin-head">
        <span>Itinerary belanja</span>
        <h2>{tripName || tripCode}</h2>
        <p>Rencana tempat, toko, dan barang yang mau dicari. {totalShops > 0 && <b>{doneShops}/{totalShops} toko dicek</b>}</p>
      </header>
      {error && <p role="alert" className="commerce-error">{error}</p>}

      <form className="itin-add" onSubmit={(e) => { e.preventDefault(); void addStop(); }}>
        <label>Hari<input type="number" min={1} max={60} value={day} onChange={(e) => setDay(Math.min(60, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} /></label>
        <label className="itin-wide">Tempat<input value={place} maxLength={120} placeholder="mis. Pavilion KL" onChange={(e) => setPlace(e.target.value)} /></label>
        <label className="itin-wide">Catatan (opsional)<input value={note} maxLength={500} placeholder="mis. buka jam 10, mulai dari lantai 3" onChange={(e) => setNote(e.target.value)} /></label>
        <button type="submit" disabled={!place.trim()}><Plus size={16} /> Tambah tempat</button>
      </form>

      {loading ? <p className="task-empty">Memuat…</p> : days.length === 0 ? <p className="task-empty">Belum ada rencana. Tambah tempat pertama di Hari 1.</p> : days.map(([d, list]) => (
        <div className="itin-day" key={d}>
          <h3>Hari {d}<small>{dayLabel(departureDate, d)}</small></h3>
          {list.map((stop) => {
            const draft = shopDrafts[stop.id] || { name: "", items: "" };
            return (
              <article className="itin-stop" key={stop.id}>
                <div className="itin-stop-head">
                  <MapPin size={17} />
                  <div><b>{stop.place}</b>{stop.note && <small>{stop.note}</small>}</div>
                  <button aria-label={`Hapus ${stop.place}`} onClick={() => void removeStop(stop)}><Trash2 size={15} /></button>
                </div>
                <ul className="itin-shops">
                  {stop.shops.map((shop) => (
                    <li key={shop.id} className={shop.done ? "done" : ""}>
                      <button className="itin-check" aria-pressed={shop.done} aria-label={`Tandai ${shop.name}`} onClick={() => void saveShops(stop, stop.shops.map((x) => (x.id === shop.id ? { ...x, done: !x.done } : x)))}>
                        {shop.done ? <CheckCircle2 /> : <i />}
                      </button>
                      <span><b>{shop.name}</b>{shop.items && <small>{shop.items}</small>}</span>
                      <button aria-label={`Hapus ${shop.name}`} onClick={() => void saveShops(stop, stop.shops.filter((x) => x.id !== shop.id))}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
                <form className="itin-shop-add" onSubmit={(e) => { e.preventDefault(); addShop(stop); }}>
                  <input value={draft.name} placeholder="Toko, mis. Padini" onChange={(e) => setShopDrafts((x) => ({ ...x, [stop.id]: { ...draft, name: e.target.value } }))} />
                  <input value={draft.items} placeholder="Barang dicari" onChange={(e) => setShopDrafts((x) => ({ ...x, [stop.id]: { ...draft, items: e.target.value } }))} />
                  <button type="submit" disabled={!draft.name.trim()} aria-label="Tambah toko"><Plus size={16} /></button>
                </form>
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}
