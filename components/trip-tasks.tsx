import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Task = { id: string; text: string; tag: string; done: boolean };

const tags = ["Order", "Belanja", "Cargo", "Konten", "Lainnya"];

export default function TripTasks({ tripCode }: { tripCode: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [tag, setTag] = useState(tags[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error: err } = await supabase
      .from("trip_tasks")
      .select("id,text,tag,done")
      .eq("trip_code", tripCode)
      .order("created_at");
    if (err) setError("Gagal memuat checklist");
    else { setError(""); setTasks((data || []) as Task[]); }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tripCode]);

  const add = async () => {
    const value = text.trim();
    if (!value) return;
    const { error: err } = await supabase.from("trip_tasks").insert({ trip_code: tripCode, text: value, tag });
    if (err) { setError("Gagal menambah tugas"); return; }
    setText("");
    await load();
  };

  const toggle = async (task: Task) => {
    setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const { error: err } = await supabase.from("trip_tasks").update({ done: !task.done }).eq("id", task.id);
    if (err) { setError("Gagal menyimpan"); await load(); }
  };

  const remove = async (task: Task) => {
    setTasks((all) => all.filter((t) => t.id !== task.id));
    const { error: err } = await supabase.from("trip_tasks").delete().eq("id", task.id);
    if (err) { setError("Gagal menghapus"); await load(); }
  };

  const done = tasks.filter((t) => t.done).length;

  return (
    <article className="panel tasks">
      <div className="panel-head">
        <div>
          <span>Action center</span>
          <h2>Checklist trip</h2>
        </div>
        <small>{done}/{tasks.length} selesai</small>
      </div>
      <div className="task-progress">
        <i style={{ width: (tasks.length ? (done / tasks.length) * 100 : 0) + "%" }} />
      </div>
      {error && <p role="alert" className="commerce-error">{error}</p>}
      <div className="task-list">
        {loading ? <p className="task-empty">Memuat…</p> : tasks.length === 0 ? <p className="task-empty">Belum ada tugas. Tambah yang pertama di bawah.</p> : tasks.map((t) => (
          <div key={t.id} className={"task-row" + (t.done ? " done" : "")}>
            <button className="task-main" onClick={() => void toggle(t)} aria-pressed={t.done}>
              <span className="check">{t.done ? <CheckCircle2 /> : <i />}</span>
              <span>{t.text}<small>{t.tag}</small></span>
            </button>
            <button className="task-del" aria-label={`Hapus ${t.text}`} onClick={() => void remove(t)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <form className="task-add" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input value={text} maxLength={200} placeholder="Tugas baru, mis. Konfirmasi harga Padini" onChange={(e) => setText(e.target.value)} />
        <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Label">{tags.map((x) => <option key={x}>{x}</option>)}</select>
        <button type="submit" disabled={!text.trim()}><Plus size={16} /> Tambah</button>
      </form>
    </article>
  );
}
