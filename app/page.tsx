"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Menu,
  PackageSearch,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import Landing from "./landing";
const stages = [
  ["Leads", 48, "#dac1c7"],
  ["Waitlist", 36, "#c98e9b"],
  ["Hot leads", 21, "#a96174"],
  ["Paid", 14, "#624153"],
];
const products = [
  ["Gentlewoman tote", "Bags", "18", "Rp850k", "High"],
  ["Butterbear merch", "Character", "14", "Rp450k", "High"],
  ["Pipatchara bag", "Bags", "11", "Rp2.4jt", "Medium"],
  ["Thai beauty minis", "Beauty", "9", "Rp280k", "Medium"],
];
const leads = [
  ["Alya Putri", "Gentlewoman tote", "Invoice sent", "Rp1.240.000", "Hari ini"],
  ["Keisya A.", "Butterbear bundle", "Hot lead", "Rp680.000", "Follow up"],
  ["Nadya K.", "Pipatchara Amu", "Deposit paid", "Rp2.850.000", "Confirmed"],
  ["Celine M.", "Beauty minis", "Waitlist", "Rp420.000", "Besok"],
];
type Expense = {
  id: string | number;
  category: string;
  item: string;
  estimate: number;
  actual: number;
  status: string;
  created_by?: string;
};
type Product = {
  id: string;
  trip_code: string;
  product_code: string;
  name: string;
  brand: string;
  source_url: string;
  store_location: string;
  category: string;
  product_type: string;
  color: string;
  size: string;
  material: string;
  local_price: number;
  price_thb: number;
  weight_grams: number;
  margin_percent: number | null;
  photo_url: string;
  notes: string;
  status: "Draft" | "Ready" | "Archived";
  published:boolean;
  currency_code:string;
  currency_symbol:string;
  fashion_cargo_per_kg:number;
  nonfashion_cargo_per_kg:number;
};
type Variant={id:string;product_id:string;name:string;sku:string;local_price:number;weight_grams:number;stock:number;active:boolean};
type ProductCategory={id:string;name:string;default_margin_percent:number;active:boolean};
type Trip = {
  code: string;
  name: string;
  country: string;
  city: string;
  currency_code: string;
  currency_symbol: string;
  departure_date: string | null;
  return_date: string | null;
  status: "Planning" | "Open PO" | "On trip" | "Completed" | "Archived";
  collected_fund: number;
  target_orders: number;
  confirmed_orders: number;
  fashion_cargo_per_kg: number;
  nonfashion_cargo_per_kg: number;
  minimum_margin_percent: number;
};
const destinations = [
  { country: "Malaysia", currency: "MYR", symbol: "RM", city: "Kuala Lumpur" },
  { country: "Singapura", currency: "SGD", symbol: "S$", city: "Singapore" },
  { country: "Thailand", currency: "THB", symbol: "฿", city: "Bangkok" },
  { country: "Filipina", currency: "PHP", symbol: "₱", city: "Manila" },
  {
    country: "Brunei Darussalam",
    currency: "BND",
    symbol: "B$",
    city: "Bandar Seri Begawan",
  },
  {
    country: "Vietnam",
    currency: "VND",
    symbol: "₫",
    city: "Ho Chi Minh City",
  },
  { country: "Cina", currency: "CNY", symbol: "¥", city: "Guangzhou" },
  { country: "Jepang", currency: "JPY", symbol: "¥", city: "Tokyo" },
  { country: "Korea Selatan", currency: "KRW", symbol: "₩", city: "Seoul" },
  { country: "Korea Utara", currency: "KPW", symbol: "₩", city: "Pyongyang" },
  { country: "Mongolia", currency: "MNT", symbol: "₮", city: "Ulaanbaatar" },
  { country: "Taiwan", currency: "TWD", symbol: "NT$", city: "Taipei" },
];
const seedExpenses: Expense[] = [
  {
    id: 1,
    category: "Transportasi",
    item: "Tiket pesawat PP",
    estimate: 3500000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 2,
    category: "Akomodasi",
    item: "Hotel Kuala Lumpur",
    estimate: 2200000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 3,
    category: "Transportasi",
    item: "Transport lokal Malaysia",
    estimate: 1800000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 4,
    category: "Operasional",
    item: "Internet / SIM card",
    estimate: 250000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 6,
    category: "Operasional",
    item: "Packing & perlengkapan",
    estimate: 500000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 7,
    category: "Operasional",
    item: "Makan tim",
    estimate: 1000000,
    actual: 0,
    status: "Belum dibayar",
  },
  {
    id: 8,
    category: "Cadangan",
    item: "Dana darurat / contingency",
    estimate: 1250000,
    actual: 0,
    status: "Belum dibayar",
  },
];
function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article className={"metric " + tone}>
      <div>{label}</div>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}
export default function Home() {
  const [nav, setNav] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [recoveryMode,setRecoveryMode]=useState(false);
  const [newPassword,setNewPassword]=useState("");
  const [syncStatus, setSyncStatus] = useState("Menunggu login");
  const [view, setView] = useState<"dashboard" | "trip" | "catalogue" | "product">(
    "dashboard",
  );
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripCode, setActiveTripCode] = useState("TRIP-001");
  const [tripModal, setTripModal] = useState(false);
  const [tripDraft, setTripDraft] = useState({
    country: "Malaysia",
    city: "Kuala Lumpur",
    departure_date: "",
    return_date: "",
    name: "Malaysia Edit",
  });
  const [expenses, setExpenses] = useState<Expense[]>(seedExpenses);
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [categories,setCategories]=useState<ProductCategory[]>([]);
  const [categoryDraft,setCategoryDraft]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("Semua kategori");
  const [brandFilter,setBrandFilter]=useState("Semua brand");
  const [manageCategories,setManageCategories]=useState(false);
  const [openCategories,setOpenCategories]=useState<Set<string>>(()=>new Set(["Pakaian"]));
  const [productModal, setProductModal] = useState(false);
  const[variants,setVariants]=useState<Variant[]>([]);
  const[variantProduct,setVariantProduct]=useState<Product|null>(null);
  const[variantDraft,setVariantDraft]=useState({name:'',sku:'',local_price:0,weight_grams:0,stock:0,active:true});
  const [productDraft, setProductDraft] = useState({
    name: "",
    brand: "",
    source_url: "",
    store_location: "",
    category: "Pakaian",
    product_type: "",
    color: "",
    size: "",
    material: "",
    local_price: 0,
    price_thb: 0,
    weight_grams: 0,
    margin_percent: null as number | null,
    photo_url: "",
    notes: "",
    status: "Draft" as "Draft" | "Ready" | "Archived",
  });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState({
    category: "Operasional",
    item: "",
    estimate: 0,
    actual: 0,
    status: "Belum dibayar",
  });
  const [capacity, setCapacity] = useState(50);
  const [rate, setRate] = useState(535);
  const [rateStatus, setRateStatus] = useState("Menyiapkan kurs…");
  const [cargoRate, setCargoRate] = useState(95000);
  const [productCategory, setProductCategory] = useState("Pakaian");
  const [targetFund, setTargetFund] = useState(12000000);
  const [collected, setCollected] = useState(7400000);
  const [orderTarget, setOrderTarget] = useState(50);
  const [itemBaht, setItemBaht] = useState(200);
  const [itemGrams, setItemGrams] = useState(350);
  const [baseMargin, setBaseMargin] = useState(25);
  const [tasks, setTasks] = useState([
    { text: "Publish 4 Threads + 4 X posts", done: false, tag: "Content" },
    { text: "Follow up 7 hot leads", done: false, tag: "Sales" },
    { text: "Confirm price range Gentlewoman", done: true, tag: "Product" },
    { text: "Test waitlist form end-to-end", done: false, tag: "Launch" },
  ]);
  const done = tasks.filter((t) => t.done).length;
  const dashboardRoute=typeof window!=="undefined"&&window.location.pathname.startsWith("/dashboard");
  const activeTrip = trips.find((t) => t.code === activeTripCode);
  const currency = activeTrip?.currency_code || "MYR";
  const currencySymbol = activeTrip?.currency_symbol || "RM";
  const confirmedOrders = activeTrip?.confirmed_orders || 0;
  const availableBrands=useMemo(()=>Array.from(new Set(catalogue.filter(p=>categoryFilter==="Semua kategori"||p.category===categoryFilter).map(p=>p.brand||"Tanpa brand"))).sort(),[catalogue,categoryFilter]);
  const visibleCatalogue=useMemo(()=>catalogue.filter(p=>(categoryFilter==="Semua kategori"||p.category===categoryFilter)&&(brandFilter==="Semua brand"||(p.brand||"Tanpa brand")===brandFilter)),[catalogue,categoryFilter,brandFilter]);
  const toggleCategory=(name:string)=>setOpenCategories(current=>{const next=new Set(current);next.has(name)?next.delete(name):next.add(name);return next});
  const pct = Math.round((confirmedOrders / Math.max(1, capacity)) * 100);
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );
  const acceptRate = (value: number, source: string, date: string) => {
    if (!Number.isFinite(value) || value <= 0 || value > 100000)
      throw new Error("Invalid currency rate");
    setRate(value);
    setRateStatus(`Live via ${source} · ${date}`);
    localStorage.setItem(
      `elsewhere-${currency.toLowerCase()}-idr`,
      JSON.stringify({ value, source, date, savedAt: Date.now() }),
    );
  };
  const refreshRate = async () => {
    setRateStatus("Memperbarui kurs…");
    if(currency === "KPW"){
      setRate(18);
      setRateStatus("KPW tidak punya kurs pasar publik yang andal · isi manual");
      return;
    }
    const providers = [
      async () => {
        const r = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) throw new Error();
        const d:any = await r.json();
        return {
          value: Number(d.rates?.IDR),
          source: "ExchangeRate-API",
          date: new Date(d.time_last_update_unix * 1000).toLocaleDateString(
            "id-ID",
          ),
        };
      },
      async () => {
        const r = await fetch(
          `https://api.frankfurter.app/latest?from=${currency}&to=IDR`,
          { signal: AbortSignal.timeout(6000) },
        );
        if (!r.ok) throw new Error();
        const d:any = await r.json();
        return {
          value: Number(d.rates?.IDR),
          source: "Frankfurter",
          date: d.date,
        };
      },
    ];
    for (const provider of providers) {
      try {
        const x = await provider();
        acceptRate(x.value, x.source, x.date);
        return;
      } catch {}
    }
    try {
      const cached = JSON.parse(
        localStorage.getItem(`elsewhere-${currency.toLowerCase()}-idr`) ||
          "null",
      );
      if (cached?.value > 0) {
        setRate(cached.value);
        setRateStatus(`Kurs tersimpan · ${cached.date}`);
        return;
      }
    } catch {}
    setRate(535);
    setRateStatus("Fallback aman · edit jika perlu");
  };
  useEffect(() => {
    try {
      const cached = JSON.parse(
        localStorage.getItem(`elsewhere-${currency.toLowerCase()}-idr`) ||
          "null",
      );
      if (cached?.value > 0) {
        setRate(cached.value);
        setRateStatus(`Kurs tersimpan · ${cached.date}`);
      }
    } catch {}
    refreshRate();
  }, [currency]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if(event==="PASSWORD_RECOVERY") setRecoveryMode(true);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const loadSharedData = async (code = activeTripCode) => {
    setSyncStatus("Menyinkronkan…");
    const [tripResult, expenseResult, productResult, categoryResult] = await Promise.all([
      supabase.from("trips").select("*").order("created_at"),
      supabase
        .from("trip_expenses")
        .select("id,category,item,estimate,actual,status,created_by")
        .eq("trip_code", code)
        .order("created_at"),
      supabase
        .from("products")
        .select("*")
        .eq("trip_code", code)
        .neq("status", "Archived")
        .order("product_code"),
      supabase.from("product_categories").select("*").eq("active",true).order("name"),
    ]);
    if (tripResult.error || expenseResult.error || productResult.error || categoryResult.error) {
      setSyncStatus("Sinkronisasi gagal");
      return;
    }
    const tripRows = (tripResult.data || []) as Trip[];
    setTrips(tripRows);
    setExpenses((expenseResult.data || []) as Expense[]);
    setCatalogue(
      (productResult.data || []).map((p) => ({
        ...p,
        price_thb: Number(p.local_price || p.price_thb),
      })) as Product[],
    );
    setCategories((categoryResult.data||[]) as ProductCategory[]);
    const s = tripRows.find((t) => t.code === code);
    if (s) {
      setCollected(Number(s.collected_fund));
      setOrderTarget(Number(s.target_orders));
      setCapacity(Number(s.target_orders));
      setCargoRate(Number(s.fashion_cargo_per_kg));
      setBaseMargin(Number(s.minimum_margin_percent));
    }
    setSyncStatus("Tersinkron ke database");
  };
  useEffect(() => {
    if (!user) {
      setIsMember(false);
      return;
    }
    let active = true;
    setMemberLoading(true);
    supabase
      .from("workspace_members")
      .select("email,role")
      .eq("email", (user.email || "").toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setIsMember(!!data);
        setMemberLoading(false);
        if (data) loadSharedData(activeTripCode);
      });
    const channel = supabase
      .channel(`elsewhere-live-${activeTripCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_expenses" },
        () => loadSharedData(activeTripCode),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => loadSharedData(activeTripCode),
      )
      .on("postgres_changes",{event:"*",schema:"public",table:"product_variants"},()=>{if(variantProduct)openVariants(variantProduct)})
      .on("postgres_changes",{event:"*",schema:"public",table:"product_categories"},()=>loadSharedData(activeTripCode))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => loadSharedData(activeTripCode),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, activeTripCode]);
  const submitAuth = async () => {
    if (!loginEmail.trim() || loginPassword.length < 8) return;
    setAuthMessage(
      authMode === "login" ? "Sedang masuk…" : "Sedang membuat akun…",
    );
    const { error } =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({
            email: loginEmail.trim(),
            password: loginPassword,
          })
        : await supabase.auth.signUp({
            email: loginEmail.trim(),
            password: loginPassword,
          });
    setAuthMessage(
      error
        ? error.message === "Invalid login credentials"
          ? "Email/password salah, atau akun belum dibuat. Pilih “Buat akun pertama kali”."
          : error.message
        : authMode === "login"
          ? "Berhasil masuk."
          : "Akun berhasil dibuat dan kamu sudah masuk.",
    );
  };
  const requestPasswordReset=async()=>{
    if(!loginEmail.trim()){setAuthMessage("Masukkan emailmu dulu.");return}
    setAuthMessage("Mengirim link ganti password…");
    const{error}=await supabase.auth.resetPasswordForEmail(loginEmail.trim(),{redirectTo:"https://elsewhere-dashboard-six.vercel.app/dashboard"});
    setAuthMessage(error?error.message:"Link ganti password sudah dikirim. Cek Inbox atau Spam.");
  };
  const submitNewPassword=async()=>{
    if(newPassword.length<8)return;
    setAuthMessage("Menyimpan password baru…");
    const{error}=await supabase.auth.updateUser({password:newPassword});
    setAuthMessage(error?error.message:"Password baru berhasil disimpan.");
    if(!error){setRecoveryMode(false);setNewPassword("")}
  };
  const format = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  const remaining = Math.max(0, targetFund - collected);
  const remainingOrders = Math.max(1, orderTarget - confirmedOrders);
  const targetPerOrder = remaining / remainingOrders;
  const itemCost = itemBaht * rate;
  const effectiveCargoRate = cargoRate + (productCategory === "Fashion" ? 0 : 5000);
  const itemCargo = (itemGrams / 1000) * effectiveCargoRate;
  const landed = itemCost + itemCargo;
  const calculatorMargin=/makanan|food|snack|minuman/i.test(productCategory)?20:25;
  const targetProfit = (landed * calculatorMargin) / 100;
  const suggestedPrice = landed + targetProfit;
  const adaptiveMargin = landed ? (targetProfit / landed) * 100 : 0;
  const plannedCapital = expenses.reduce((sum, x) => sum + x.estimate, 0);
  const actualCapital = expenses.reduce((sum, x) => sum + x.actual, 0);
  const paidCapital = expenses
    .filter((x) => x.status === "Sudah dibayar")
    .reduce((sum, x) => sum + (x.actual || x.estimate), 0);
  const capitalRemaining = Math.max(0, plannedCapital - paidCapital);
  const updateExpense = (
    id: string | number,
    key: "category" | "item" | "estimate" | "actual" | "status",
    value: string | number,
  ) =>
    setExpenses((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  const saveExpense = async (
    id: string | number,
    key: "category" | "item" | "estimate" | "actual" | "status",
    value: string | number,
  ) => {
    setSyncStatus("Menyimpan…");
    const { error } = await supabase
      .from("trip_expenses")
      .update({ [key]: value })
      .eq("id", id);
    setSyncStatus(error ? "Gagal menyimpan" : "Tersimpan");
  };
  const addExpense = async () => {
    if (!expenseDraft.item.trim() || !user) return;
    setSyncStatus("Menyimpan…");
    const { error } = await supabase
      .from("trip_expenses")
      .insert({
        ...expenseDraft,
        trip_code: activeTripCode,
        created_by: user.id,
      });
    if (error) {
      setSyncStatus("Gagal menyimpan");
      return;
    }
    setExpenseDraft({
      category: "Operasional",
      item: "",
      estimate: 0,
      actual: 0,
      status: "Belum dibayar",
    });
    setExpenseModal(false);
    await loadSharedData(activeTripCode);
  };
  const deleteExpense = async (id: string | number) => {
    setSyncStatus("Menghapus…");
    const { error } = await supabase
      .from("trip_expenses")
      .delete()
      .eq("id", id);
    setSyncStatus(error ? "Gagal menghapus" : "Terhapus");
    if (!error) await loadSharedData();
  };
  const productPricing = (
    p: Pick<
      Product,
      | "local_price"
      | "price_thb"
      | "weight_grams"
      | "category"
      | "margin_percent"
    >,
  ) => {
    const productCost = Number(p.local_price || p.price_thb) * rate;
    const cargo =
      (Number(p.weight_grams) / 1000) *
      (p.category === "Fashion" ? cargoRate : cargoRate + 5000);
    const capital = productCost + cargo;
    const categoryMargin=/makanan|food|snack|minuman/i.test(p.category)?20:25;
    const margin = Number(p.margin_percent ?? categoryMargin);
    const profit = (capital * margin) / 100;
    return { productCost, cargo, capital, profit, sell: capital + profit };
  };
  const nextProductCode = () =>
    `P-${String(catalogue.length + 1).padStart(3, "0")}`;
  const addProduct = async () => {
    if (!productDraft.name.trim() || !user) return;
    setSyncStatus("Menyimpan produk…");
    const { price_thb, ...draft } = productDraft;
    const { data:newProduct,error } = await supabase
      .from("products")
      .insert({
        ...draft,
        local_price: price_thb,
        trip_code: activeTripCode,
        product_code: `${activeTripCode}-${nextProductCode()}`,
        created_by: user.id,
        currency_code:currency,currency_symbol:currencySymbol,fashion_cargo_per_kg:cargoRate,nonfashion_cargo_per_kg:cargoRate+5000,
      }).select('id,product_code').single();
    if (error) {
      setSyncStatus("Gagal menyimpan produk");
      return;
    }
    await supabase.from('product_variants').insert({product_id:newProduct.id,name:'Default',sku:newProduct.product_code,local_price:price_thb,weight_grams:productDraft.weight_grams,stock:0,active:true,created_by:user.id});
    setProductDraft({
      name: "",
      brand: "",
      source_url: "",
      store_location: "",
      category: "Pakaian",
      product_type: "",
      color: "",
      size: "",
      material: "",
      local_price: 0,
      price_thb: 0,
      weight_grams: 0,
      margin_percent: null,
      photo_url: "",
      notes: "",
      status: "Draft",
    });
    setProductModal(false);
    await loadSharedData(activeTripCode);
  };
  const saveProduct = async (
    id: string,
    key: keyof Product,
    value: string | number | null,
  ) => {
    setSyncStatus("Menyimpan produk…");
    const dbKey = key === "price_thb" ? "local_price" : key;
    const { error } = await supabase
      .from("products")
      .update({ [dbKey]: value })
      .eq("id", id);
    setSyncStatus(error ? "Gagal menyimpan produk" : "Produk tersimpan");
  };
  const updateProduct = (
    id: string,
    key: keyof Product,
    value: string | number | null,
  ) =>
    setCatalogue(
      (rows) =>
        rows.map((row) =>
          row.id === id ? { ...row, [key]: value, ...(key === "price_thb" ? {local_price:value} : {}) } : row,
        ) as Product[],
    );
  const updateEditorProduct = (
    id: string,
    key: keyof Product,
    value: string | number | null,
  ) => {
    updateProduct(id, key, value);
    setVariantProduct((product) =>
      product?.id === id
        ? ({
            ...product,
            [key]: value,
            ...(key === "price_thb" ? { local_price: value } : {}),
          } as Product)
        : product,
    );
  };
  const deleteProduct = async (id: string) => {
    setSyncStatus("Menghapus produk…");
    const { error } = await supabase.from("products").delete().eq("id", id);
    setSyncStatus(error ? "Gagal menghapus produk" : "Produk terhapus");
    if (!error) await loadSharedData();
  };
  const uploadPhoto=async(product:Product,file:File)=>{setSyncStatus('Mengunggah foto…');const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';const path=`${product.trip_code}/${product.id}-${Date.now()}.${ext}`;const{error}=await supabase.storage.from('product-images').upload(path,file,{upsert:false});if(error){setSyncStatus('Gagal mengunggah foto');return}const{data}=supabase.storage.from('product-images').getPublicUrl(path);await saveProduct(product.id,'photo_url',data.publicUrl);setCatalogue(rows=>rows.map(x=>x.id===product.id?{...x,photo_url:data.publicUrl}:x));setVariantProduct(x=>x?.id===product.id?{...x,photo_url:data.publicUrl}:x);setSyncStatus('Foto tersimpan')};
  const togglePublish=async(product:Product)=>{setSyncStatus(product.published?'Menarik produk dari landing page…':'Menyetujui produk…');const next=!product.published;const{error}=await supabase.from('products').update({published:next,approved_at:next?new Date().toISOString():null,approved_by:next?user?.id:null,currency_code:currency,currency_symbol:currencySymbol,fashion_cargo_per_kg:cargoRate,nonfashion_cargo_per_kg:cargoRate+5000,status:next?'Ready':product.status}).eq('id',product.id);setSyncStatus(error?'Gagal mengubah publikasi':next?'Produk tayang di landing page':'Produk disembunyikan');if(!error){setCatalogue(rows=>rows.map(x=>x.id===product.id?{...x,published:next,status:next?'Ready':x.status}:x));setVariantProduct(x=>x?.id===product.id?{...x,published:next,status:next?'Ready':x.status}:x)}};
  const openVariants=async(product:Product)=>{setVariantProduct(product);const{data}=await supabase.from('product_variants').select('*').eq('product_id',product.id).order('created_at');setVariants((data||[]) as Variant[])};
  const openProductEditor=async(product:Product)=>{
    await openVariants(product);
    setView("product");
    window.history.pushState({},"",`/dashboard/products/${product.id}`);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const closeProductEditor=()=>{
    setVariantProduct(null);
    setView("catalogue");
    window.history.pushState({},"","/dashboard");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const addVariant=async()=>{if(!variantProduct||!user||!variantDraft.name.trim())return;const{error}=await supabase.from('product_variants').insert({...variantDraft,product_id:variantProduct.id,created_by:user.id});if(!error){setVariantDraft({name:'',sku:'',local_price:0,weight_grams:0,stock:0,active:true});await openVariants(variantProduct)}};
  const saveVariant=async(id:string,key:keyof Variant,value:string|number|boolean)=>{await supabase.from('product_variants').update({[key]:value,updated_at:new Date().toISOString()}).eq('id',id)};
  const updateVariant=(id:string,key:keyof Variant,value:string|number|boolean)=>setVariants(rows=>rows.map(x=>x.id===id?{...x,[key]:value}:x));
  const deleteVariant=async(id:string)=>{await supabase.from('product_variants').delete().eq('id',id);if(variantProduct)await openVariants(variantProduct)};
  const addCategory=async()=>{
    const name=categoryDraft.trim();
    if(!name||!user)return;
    setSyncStatus("Menambah kategori…");
    const{error}=await supabase.from("product_categories").insert({name,default_margin_percent:/makanan|minuman|snack/i.test(name)?20:25,created_by:user.id});
    setSyncStatus(error?"Kategori sudah ada atau gagal disimpan":"Kategori ditambahkan");
    if(!error){setCategoryDraft("");await loadSharedData(activeTripCode)}
  };
  const renameCategory=async(category:ProductCategory,name:string)=>{
    const next=name.trim();if(!next||next===category.name)return;
    setSyncStatus("Mengganti nama kategori…");
    const{error}=await supabase.from("product_categories").update({name:next,updated_at:new Date().toISOString()}).eq("id",category.id);
    if(!error)await supabase.from("products").update({category:next}).eq("category",category.name);
    setSyncStatus(error?"Gagal mengganti kategori":"Kategori dan produk diperbarui");
    if(!error)await loadSharedData(activeTripCode);
  };
  const deleteCategory=async(category:ProductCategory)=>{
    if(catalogue.some(p=>p.category===category.name)){setSyncStatus("Pindahkan produknya dulu sebelum menghapus kategori");return}
    const{error}=await supabase.from("product_categories").delete().eq("id",category.id);
    setSyncStatus(error?"Gagal menghapus kategori":"Kategori dihapus");
    if(!error)await loadSharedData(activeTripCode);
  };
  useEffect(()=>{
    if(!catalogue.length)return;
    const match=window.location.pathname.match(/^\/dashboard\/products\/([^/]+)$/);
    if(!match)return;
    const product=catalogue.find(x=>x.id===match[1]);
    if(!product||variantProduct?.id===product.id)return;
    setVariantProduct(product);
    setView("product");
    supabase.from("product_variants").select("*").eq("product_id",product.id).order("created_at").then(({data})=>setVariants((data||[]) as Variant[]));
  },[catalogue,variantProduct?.id]);
  useEffect(()=>{
    const handleBack=()=>{
      const match=window.location.pathname.match(/^\/dashboard\/products\/([^/]+)$/);
      if(match){const product=catalogue.find(x=>x.id===match[1]);if(product){setVariantProduct(product);setView("product");return}}
      setVariantProduct(null);
      setView("catalogue");
    };
    window.addEventListener("popstate",handleBack);
    return()=>window.removeEventListener("popstate",handleBack);
  },[catalogue]);
  const saveSetting = async (key: string, value: number) => {
    setSyncStatus("Menyimpan pengaturan…");
    const { error } = await supabase
      .from("trips")
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq("code", activeTripCode);
    setSyncStatus(error ? "Gagal menyimpan" : "Pengaturan tersimpan");
  };
  const selectTrip = (code: string) => {
    setActiveTripCode(code);
    setView("trip");
    setNav(false);
  };
  const changeCountry = async (country: string) => {
    const d = destinations.find((x) => x.country === country);
    if (!d) return;
    setSyncStatus("Mengganti negara…");
    const { error } = await supabase
      .from("trips")
      .update({
        country: d.country,
        city: d.city,
        currency_code: d.currency,
        currency_symbol: d.symbol,
        name: `${d.country} Edit 01`,
        updated_at: new Date().toISOString(),
      })
      .eq("code", activeTripCode);
    setSyncStatus(
      error ? "Gagal mengganti negara" : "Negara dan kurs diperbarui",
    );
    if (!error) await loadSharedData(activeTripCode);
  };
  const saveTripField = async (
    key: "city" | "departure_date" | "return_date" | "status",
    value: string,
  ) => {
    setSyncStatus("Menyimpan trip…");
    const { error } = await supabase
      .from("trips")
      .update({ [key]: value || null, updated_at: new Date().toISOString() })
      .eq("code", activeTripCode);
    setSyncStatus(error ? "Gagal menyimpan" : "Trip tersimpan");
    if (!error) await loadSharedData(activeTripCode);
  };
  const addTrip = async () => {
    if (!user) return;
    const d =
      destinations.find((x) => x.country === tripDraft.country) ||
      destinations[0];
    const next =
      Math.max(0, ...trips.map((t) => Number(t.code.replace(/\D/g, "")) || 0)) +
      1;
    const code = `TRIP-${String(next).padStart(3, "0")}`;
    setSyncStatus("Membuat trip…");
    const { error } = await supabase
      .from("trips")
      .insert({
        code,
        name: tripDraft.name || `${d.country} Edit`,
        country: d.country,
        city: tripDraft.city || d.city,
        currency_code: d.currency,
        currency_symbol: d.symbol,
        departure_date: tripDraft.departure_date || null,
        return_date: tripDraft.return_date || null,
        created_by: user.id,
      });
    if (error) {
      setSyncStatus("Gagal membuat trip");
      return;
    }
    setTripModal(false);
    setActiveTripCode(code);
    setView("trip");
  };
  useEffect(() => {
    setTargetFund(plannedCapital);
  }, [plannedCapital]);
  if(!dashboardRoute)return <Landing/>;
  if (authLoading)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark">E</div>
          <h1>Menyiapkan workspace…</h1>
        </div>
      </div>
    );
  if(recoveryMode)return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">E</div><span>RESET PASSWORD</span><h1>Buat password baru</h1><p>Gunakan minimal 8 karakter. Setelah disimpan kamu langsung masuk ke dashboard.</p><label>Password baru<input autoFocus type="password" value={newPassword} placeholder="Minimal 8 karakter" onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submitNewPassword()}}/></label><button disabled={newPassword.length<8} onClick={submitNewPassword}>Simpan password baru</button>{authMessage&&<small>{authMessage}</small>}</div></div>;
  if (!user)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark">E</div>
          <span>ELSEWHERE & CO.</span>
          <h1>
            {authMode === "login"
              ? "Masuk ke dashboard"
              : "Buat password pertama"}
          </h1>
          <p>
            {authMode === "login"
              ? "Gunakan email tim dan password yang sudah kamu buat."
              : "Khusus pertama kali. Buat password minimal 8 karakter untuk email yang telah didaftarkan."}
          </p>
          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
            >
              Masuk
            </button>
            <button
              className={authMode === "signup" ? "active" : ""}
              onClick={() => {
                setAuthMode("signup");
                setAuthMessage("");
              }}
            >
              Buat akun pertama kali
            </button>
          </div>
          <label>
            Email
            <input
              type="email"
              value={loginEmail}
              placeholder="nama@email.com"
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginPassword}
              placeholder="Minimal 8 karakter"
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAuth();
              }}
            />
          </label>
          <button
            disabled={!loginEmail.trim() || loginPassword.length < 8}
            onClick={submitAuth}
          >
            {authMode === "login" ? "Masuk" : "Buat akun & masuk"}
          </button>
          {authMode==="login"&&<button className="forgot-password" onClick={requestPasswordReset}>Lupa password?</button>}
          {authMessage && <small>{authMessage}</small>}
        </div>
      </div>
    );
  if (memberLoading)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark">E</div>
          <h1>Memeriksa akses…</h1>
        </div>
      </div>
    );
  if (!isMember)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark">E</div>
          <span>AKSES BELUM AKTIF</span>
          <h1>Email belum terdaftar</h1>
          <p>
            {user.email} sudah berhasil login, tetapi belum dimasukkan sebagai
            anggota Elsewhere.
          </p>
          <button onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (nav ? "open" : "")}>
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <b>Elsewhere & Co.</b>
            <span>good things, found elsewhere.</span>
          </div>
          <button className="close-nav" onClick={() => setNav(false)}>
            <X size={18} />
          </button>
        </div>
        <nav>
          <p>Workspace</p>
          <a
            className={view === "dashboard" ? "active" : ""}
            onClick={() => {
              setView("dashboard");
              setVariantProduct(null);
              window.history.pushState({},"","/dashboard");
              setNav(false);
            }}
          >
            <LayoutDashboard />
            Dashboard
          </a>
          <a>
            <Users />
            Leads & waitlist <em>48</em>
          </a>
          <a>
            <ShoppingBag />
            Orders <em>14</em>
          </a>
          <a
            className={view === "catalogue" || view === "product" ? "active" : ""}
            onClick={() => {
              setView("catalogue");
              setVariantProduct(null);
              window.history.pushState({},"","/dashboard");
              setNav(false);
            }}
          >
            <PackageSearch />
            Product catalogue <em>{catalogue.length}</em>
          </a>
          <p>Trip management</p>
          <a
            className={view === "trip" ? "active" : ""}
            onClick={() => {
              setView("trip");
              setVariantProduct(null);
              window.history.pushState({},"","/dashboard");
              setNav(false);
            }}
          >
            <MapPinned />
            Trips <em>{String(trips.length).padStart(3, "0")}</em>
          </a>
          <p>Growth</p>
          <a>
            <CalendarDays />
            Content plan
          </a>
          <a>
            <BarChart3 />
            Performance
          </a>
          <a>
            <ClipboardList />
            Launch checklist
          </a>
        </nav>
        <div className="trip-card">
          <span>{activeTrip?.name || "Malaysia Edit 01"}</span>
          <strong>{activeTrip?.country || "Malaysia"}</strong>
          <small>
            {currency} ·{" "}
            {activeTrip?.departure_date
              ? new Date(
                  activeTrip.departure_date + "T00:00:00",
                ).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })
              : "Tanggal belum diisi"}
          </small>
          <div>
            <i />
          </div>
          <button
            onClick={() => {
              setView("trip");
              setNav(false);
            }}
          >
            View trip plan <ChevronRight size={15} />
          </button>
        </div>
        <div className="profile">
          <div>NS</div>
          <span>
            <b>Ni'mah</b>
            <small>Founder</small>
          </span>
          <ChevronRight size={16} />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button className="menu-btn" onClick={() => setNav(true)}>
            <Menu />
          </button>
          <div>
            <p>{today}</p>
            <h1>Good morning, Ni'mah.</h1>
          </div>
          <div className="top-actions">
            <label>
              <Search size={17} />
              <input placeholder="Search anything…" />
            </label>
            <button className="icon-btn">
              <Bell size={19} />
              <i />
            </button>
            <button className="primary">
              <Plus size={18} /> Add lead
            </button>
            <button
              className="logout-btn"
              onClick={() => supabase.auth.signOut()}
            >
              Keluar
            </button>
          </div>
        </header>
        {view === "trip" ? (
          <section className="trip-workspace">
            <div className="trip-switcher">
              <label>
                Pilih trip
                <select
                  value={activeTripCode}
                  onChange={(e) => selectTrip(e.target.value)}
                >
                  {trips.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} · {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => setTripModal(true)}>
                <Plus size={15} /> Buat trip baru
              </button>
            </div>
            <div className="trip-hero">
              <div>
                <span>{activeTripCode} PLANNING</span>
                <h1>
                  {activeTrip?.city || "Kuala Lumpur"},{" "}
                  {activeTrip?.country || "Malaysia"}
                </h1>
                <p>
                  {activeTrip?.departure_date
                    ? new Date(
                        activeTrip.departure_date + "T00:00:00",
                      ).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Tanggal berangkat belum diisi"}{" "}
                  · {currency} · Kurs otomatis
                </p>
              </div>
              <div className="trip-custom">
                <label>
                  Negara
                  <select
                    value={activeTrip?.country || "Malaysia"}
                    onChange={(e) => changeCountry(e.target.value)}
                  >
                    {destinations.map((d) => (
                      <option key={d.country}>{d.country}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Kota
                  <input
                    value={activeTrip?.city || ""}
                    onChange={(e) =>
                      setTrips((rows) =>
                        rows.map((t) =>
                          t.code === activeTripCode
                            ? { ...t, city: e.target.value }
                            : t,
                        ),
                      )
                    }
                    onBlur={(e) => saveTripField("city", e.target.value)}
                  />
                </label>
                <label>
                  Berangkat
                  <input
                    type="date"
                    value={activeTrip?.departure_date || ""}
                    onChange={(e) =>
                      saveTripField("departure_date", e.target.value)
                    }
                  />
                </label>
                <label>
                  Pulang
                  <input
                    type="date"
                    value={activeTrip?.return_date || ""}
                    onChange={(e) =>
                      saveTripField("return_date", e.target.value)
                    }
                  />
                </label>
                <div className="trip-sync">
                  <div className="trip-status">
                    <i /> {activeTrip?.status || "Planning"}
                  </div>
                  <small>{syncStatus}</small>
                </div>
              </div>
            </div>
            <div className="capital-cards">
              <article>
                <span>Total modal direncanakan</span>
                <strong>{format(plannedCapital)}</strong>
                <small>Otomatis dari seluruh estimasi kebutuhan</small>
              </article>
              <article>
                <span>Aktual tercatat</span>
                <strong>{format(actualCapital)}</strong>
                <small>
                  {actualCapital
                    ? `${Math.round((actualCapital / plannedCapital) * 100)}% dari budget`
                    : "Isi setelah harga final diketahui"}
                </small>
              </article>
              <article className="paid">
                <span>Modal sudah dibayar</span>
                <strong>{format(paidCapital)}</strong>
                <small>
                  {Math.round((paidCapital / plannedCapital) * 100)}% sudah
                  keluar
                </small>
              </article>
              <article className="remaining">
                <span>Masih perlu disiapkan</span>
                <strong>{format(capitalRemaining)}</strong>
                <small>Target modal dikurangi yang sudah dibayar</small>
              </article>
            </div>
            <article className="panel trip-budget">
              <div className="panel-head">
                <div>
                  <span>Capital requirements</span>
                  <h2>Daftar modal {activeTripCode}</h2>
                  <p>
                    Ubah estimasi sekarang, isi aktual saat invoice keluar, lalu
                    tandai ketika sudah dibayar.
                  </p>
                </div>
                <button
                  className="outline-add"
                  onClick={() => setExpenseModal(true)}
                >
                  <Plus size={15} /> Tambah keperluan
                </button>
              </div>
              <div className="budget-table">
                <div className="budget-row budget-head">
                  <span>Kategori</span>
                  <span>Keperluan</span>
                  <span>Estimasi</span>
                  <span>Aktual</span>
                  <span>Status</span>
                  <span />
                </div>
                {expenses.map((row) => (
                  <div className="budget-row" key={row.id}>
                    <select
                      value={row.category}
                      onChange={(e) => {
                        updateExpense(row.id, "category", e.target.value);
                        saveExpense(row.id, "category", e.target.value);
                      }}
                    >
                      <option>Transportasi</option>
                      <option>Akomodasi</option>
                      <option>Operasional</option>
                      <option>Belanja produk</option>
                      <option>Cadangan</option>
                      <option>Lainnya</option>
                    </select>
                    <input
                      className="expense-name"
                      value={row.item}
                      onChange={(e) =>
                        updateExpense(row.id, "item", e.target.value)
                      }
                      onBlur={(e) =>
                        saveExpense(row.id, "item", e.target.value)
                      }
                    />
                    <label>
                      <small>Rp</small>
                      <input
                        type="number"
                        value={row.estimate || ""}
                        placeholder="Masukkan estimasi"
                        onChange={(e) =>
                          updateExpense(
                            row.id,
                            "estimate",
                            Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          saveExpense(
                            row.id,
                            "estimate",
                            Number(e.target.value),
                          )
                        }
                      />
                    </label>
                    <label>
                      <small>Rp</small>
                      <input
                        type="number"
                        value={row.actual || ""}
                        onChange={(e) =>
                          updateExpense(
                            row.id,
                            "actual",
                            Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          saveExpense(row.id, "actual", Number(e.target.value))
                        }
                        placeholder="Masukkan aktual"
                      />
                    </label>
                    <select
                      className={
                        row.status === "Sudah dibayar" ? "is-paid" : ""
                      }
                      value={row.status}
                      onChange={(e) => {
                        updateExpense(row.id, "status", e.target.value);
                        saveExpense(row.id, "status", e.target.value);
                      }}
                    >
                      <option>Belum dibayar</option>
                      <option>DP dibayar</option>
                      <option>Sudah dibayar</option>
                    </select>
                    <button
                      className="delete-expense"
                      onClick={() => deleteExpense(row.id)}
                      aria-label="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="budget-footer">
                <div>
                  <span>Total estimasi</span>
                  <strong>{format(plannedCapital)}</strong>
                </div>
                <div>
                  <span>Total aktual</span>
                  <strong>{format(actualCapital)}</strong>
                </div>
                <div>
                  <span>Selisih budget</span>
                  <strong
                    className={actualCapital > plannedCapital ? "over" : ""}
                  >
                    {format(plannedCapital - actualCapital)}
                  </strong>
                </div>
              </div>
            </article>
            <div className="trip-note">
              <Sparkles size={18} />
              <div>
                <b>Terhubung ke Dashboard</b>
                <p>
                  Total modal direncanakan {format(plannedCapital)} otomatis
                  menjadi target dana {activeTrip?.name}. Kalau estimasi
                  berubah, target kalkulator harga order trip ini ikut berubah.
                </p>
              </div>
            </div>
            {expenseModal && (
              <div
                className="modal-backdrop"
                onMouseDown={() => setExpenseModal(false)}
              >
                <div
                  className="expense-modal"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="modal-title">
                    <div>
                      <span>{activeTripCode} · {activeTrip?.country}</span>
                      <h2>Tambah keperluan</h2>
                    </div>
                    <button onClick={() => setExpenseModal(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-form">
                    <label>
                      Nama keperluan
                      <input
                        autoFocus
                        value={expenseDraft.item}
                        placeholder="Contoh: Bagasi tambahan"
                        onChange={(e) =>
                          setExpenseDraft((x) => ({
                            ...x,
                            item: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Kategori
                      <select
                        value={expenseDraft.category}
                        onChange={(e) =>
                          setExpenseDraft((x) => ({
                            ...x,
                            category: e.target.value,
                          }))
                        }
                      >
                        <option>Transportasi</option>
                        <option>Akomodasi</option>
                        <option>Operasional</option>
                        <option>Belanja produk</option>
                        <option>Cadangan</option>
                        <option>Lainnya</option>
                      </select>
                    </label>
                    <label>
                      Estimasi biaya (Rp)
                      <input
                        type="number"
                        value={expenseDraft.estimate || ""}
                        placeholder="Contoh: 500000"
                        onChange={(e) =>
                          setExpenseDraft((x) => ({
                            ...x,
                            estimate: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Biaya aktual (opsional)
                      <input
                        type="number"
                        value={expenseDraft.actual || ""}
                        placeholder="Isi nanti jika belum tahu"
                        onChange={(e) =>
                          setExpenseDraft((x) => ({
                            ...x,
                            actual: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={expenseDraft.status}
                        onChange={(e) =>
                          setExpenseDraft((x) => ({
                            ...x,
                            status: e.target.value,
                          }))
                        }
                      >
                        <option>Belum dibayar</option>
                        <option>DP dibayar</option>
                        <option>Sudah dibayar</option>
                      </select>
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => setExpenseModal(false)}>
                      Batal
                    </button>
                    <button
                      className="save-expense"
                      disabled={!expenseDraft.item.trim()}
                      onClick={addExpense}
                    >
                      Simpan keperluan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : view === "product" && variantProduct ? (
          <section className="product-editor-page">
            <div className="product-editor-topbar">
              <button onClick={closeProductEditor}><ArrowLeft size={16}/> Kembali ke katalog</button>
              <small>{syncStatus}</small>
              <button className={`publish-toggle ${variantProduct.published ? "live" : ""}`} onClick={()=>togglePublish(variantProduct)}>
                {variantProduct.published ? "Sudah tayang ✓" : "Approve & tayang"}
              </button>
            </div>
            <div className="product-editor-heading">
              <div><span>PRODUCT EDITOR · {variantProduct.product_code}</span><h1>Edit produk</h1><p>Semua detail dan varian produk ada di satu halaman ini.</p></div>
              <span className={`status-badge ${variantProduct.published ? "live" : ""}`}>{variantProduct.published ? "Tampil di landing page" : "Masih draft"}</span>
            </div>
            <div className="product-editor-layout">
              <aside className="product-photo-editor panel">
                <div className="editor-photo-frame">
                  {variantProduct.photo_url ? <img src={variantProduct.photo_url} alt={variantProduct.name}/> : <div><PackageSearch size={34}/><span>Belum ada foto</span></div>}
                </div>
                <label className="photo-upload-button">Ganti / upload foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)uploadPhoto(variantProduct,file)}}/></label>
                {variantProduct.source_url && <a href={variantProduct.source_url} target="_blank" rel="noreferrer">Buka halaman sumber <ChevronRight size={14}/></a>}
                <small>Foto hasil scraping sudah ditampilkan otomatis. Kamu tetap bisa menggantinya dengan foto sendiri.</small>
              </aside>
              <div className="product-editor-main">
                <article className="panel editor-section">
                  <div className="editor-section-title"><div><span>INFORMASI UTAMA</span><h2>Data produk</h2></div><small>Tersimpan otomatis saat pindah kolom</small></div>
                  <div className="editor-form-grid">
                    <label className="wide">Nama produk<input value={variantProduct.name} onChange={e=>updateEditorProduct(variantProduct.id,"name",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"name",e.target.value)}/></label>
                    <label>Brand<input value={variantProduct.brand} onChange={e=>updateEditorProduct(variantProduct.id,"brand",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"brand",e.target.value)}/></label>
                    <label>Kategori<select value={variantProduct.category} onChange={e=>{const c=categories.find(x=>x.name===e.target.value);updateEditorProduct(variantProduct.id,"category",e.target.value);updateEditorProduct(variantProduct.id,"margin_percent",c?.default_margin_percent??25);saveProduct(variantProduct.id,"category",e.target.value);saveProduct(variantProduct.id,"margin_percent",c?.default_margin_percent??25)}}>{categories.map(c=><option key={c.id}>{c.name}</option>)}</select></label>
                    <label>Tipe produk<input value={variantProduct.product_type} onChange={e=>updateEditorProduct(variantProduct.id,"product_type",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"product_type",e.target.value)}/></label>
                    <label>Lokasi / toko<input value={variantProduct.store_location} onChange={e=>updateEditorProduct(variantProduct.id,"store_location",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"store_location",e.target.value)}/></label>
                    <label>Harga toko ({currency})<input type="number" value={variantProduct.local_price || ""} placeholder="0" onChange={e=>updateEditorProduct(variantProduct.id,"price_thb",Number(e.target.value))} onBlur={e=>saveProduct(variantProduct.id,"price_thb",Number(e.target.value))}/></label>
                    <label>Berat dasar (gram)<input type="number" value={variantProduct.weight_grams || ""} placeholder="Wajib untuk hitung cargo" onChange={e=>updateEditorProduct(variantProduct.id,"weight_grams",Number(e.target.value))} onBlur={e=>saveProduct(variantProduct.id,"weight_grams",Number(e.target.value))}/></label>
                    <label>Margin (%)<input type="number" value={variantProduct.margin_percent ?? ""} placeholder={variantProduct.category === "Makanan & Minuman" ? "20" : "25"} onChange={e=>updateEditorProduct(variantProduct.id,"margin_percent",e.target.value === "" ? null : Number(e.target.value))} onBlur={e=>saveProduct(variantProduct.id,"margin_percent",e.target.value === "" ? null : Number(e.target.value))}/></label>
                    <label>Status<select value={variantProduct.status} onChange={e=>{updateEditorProduct(variantProduct.id,"status",e.target.value);saveProduct(variantProduct.id,"status",e.target.value)}}><option>Draft</option><option>Ready</option><option>Archived</option></select></label>
                    <label>Warna<input value={variantProduct.color} onChange={e=>updateEditorProduct(variantProduct.id,"color",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"color",e.target.value)}/></label>
                    <label>Ukuran<input value={variantProduct.size} onChange={e=>updateEditorProduct(variantProduct.id,"size",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"size",e.target.value)}/></label>
                    <label className="wide">Link produk<input value={variantProduct.source_url} onChange={e=>updateEditorProduct(variantProduct.id,"source_url",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"source_url",e.target.value)}/></label>
                    <label className="wide">Catatan<textarea value={variantProduct.notes} onChange={e=>updateEditorProduct(variantProduct.id,"notes",e.target.value)} onBlur={e=>saveProduct(variantProduct.id,"notes",e.target.value)}/></label>
                  </div>
                  <div className="editor-price-strip">
                    <div><span>Harga barang</span><b>{format(productPricing(variantProduct).productCost)}</b></div>
                    <div><span>Cargo</span><b>{format(productPricing(variantProduct).cargo)}</b></div>
                    <div><span>Modal</span><b>{format(productPricing(variantProduct).capital)}</b></div>
                    <div className="recommended"><span>Harga jual rekomendasi</span><strong>{format(productPricing(variantProduct).sell)}</strong></div>
                  </div>
                </article>
                <article className="panel editor-section">
                  <div className="editor-section-title"><div><span>VARIAN PRODUK</span><h2>Ukuran, berat & harga</h2></div><small>Setiap varian dihitung terpisah</small></div>
                  <p className="modal-help">Contoh: Milo 400g dan 900g, atau pakaian ukuran S, M, dan L. Isi berat setiap varian agar cargo akurat.</p>
                  <div className="variant-table-head"><span>Nama varian</span><span>Harga {currency}</span><span>Berat</span><span>Stok</span><span>Harga jual</span><span/></div>
                  <div className="variant-list">{variants.map(v=>{const calc=productPricing({local_price:v.local_price,price_thb:v.local_price,weight_grams:v.weight_grams,category:variantProduct.category,margin_percent:variantProduct.margin_percent});return <div className="variant-row" key={v.id}><input value={v.name} onChange={e=>updateVariant(v.id,'name',e.target.value)} onBlur={e=>saveVariant(v.id,'name',e.target.value)} placeholder="Nama/ukuran"/><input type="number" value={v.local_price||''} onChange={e=>updateVariant(v.id,'local_price',Number(e.target.value))} onBlur={e=>saveVariant(v.id,'local_price',Number(e.target.value))} placeholder={currency}/><input type="number" value={v.weight_grams||''} onChange={e=>updateVariant(v.id,'weight_grams',Number(e.target.value))} onBlur={e=>saveVariant(v.id,'weight_grams',Number(e.target.value))} placeholder="gram"/><input type="number" value={v.stock||''} onChange={e=>updateVariant(v.id,'stock',Number(e.target.value))} onBlur={e=>saveVariant(v.id,'stock',Number(e.target.value))} placeholder="stok"/><strong>{format(calc.sell)}</strong><button className="delete-expense" onClick={()=>deleteVariant(v.id)}><Trash2 size={15}/></button></div>})}</div>
                  <div className="variant-add"><input value={variantDraft.name} onChange={e=>setVariantDraft(x=>({...x,name:e.target.value}))} placeholder="Contoh: Size M"/><input type="number" value={variantDraft.local_price||''} onChange={e=>setVariantDraft(x=>({...x,local_price:Number(e.target.value)}))} placeholder={`Harga ${currency}`}/><input type="number" value={variantDraft.weight_grams||''} onChange={e=>setVariantDraft(x=>({...x,weight_grams:Number(e.target.value)}))} placeholder="Berat gram"/><input type="number" value={variantDraft.stock||''} onChange={e=>setVariantDraft(x=>({...x,stock:Number(e.target.value)}))} placeholder="Stok"/><button onClick={addVariant}><Plus size={14}/> Tambah varian</button></div>
                </article>
                <div className="editor-danger-zone"><button onClick={async()=>{await deleteProduct(variantProduct.id);closeProductEditor()}}><Trash2 size={14}/> Hapus produk</button></div>
              </div>
            </div>
          </section>
        ) : view === "catalogue" ? (
          <section className="catalogue-workspace">
            <div className="catalogue-hero">
              <div>
                <span>SHARED PRODUCT DATABASE</span>
                <h1>{activeTrip?.country} Product Catalogue</h1>
                <p>
                  Input data penting saja. Kurs, cargo, modal, target untung,
                  dan harga jual dihitung otomatis.
                </p>
              </div>
              <div>
                <small>{syncStatus}</small>
                <button onClick={() => setProductModal(true)}>
                  <Plus size={16} /> Tambah produk
                </button>
              </div>
            </div>
            <div className="catalogue-summary">
              <article>
                <span>Total produk</span>
                <strong>{catalogue.length}</strong>
                <small>
                  {catalogue.filter((x) => x.status === "Ready").length} siap
                  dijual
                </small>
              </article>
              <article>
                <span>Kurs {currency}</span>
                <strong>
                  Rp{rate.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </strong>
                <small>{rateStatus}</small>
              </article>
              <article>
                <span>Cargo fashion</span>
                <strong>{format(cargoRate)}/kg</strong>
                <small>Non-fashion + Rp5.000/kg</small>
              </article>
              <article>
                <span>Margin otomatis</span>
                <strong>20–25%</strong>
                <small>Makanan 20% · kategori lain 25%</small>
              </article>
            </div>
            <article className="panel catalogue-organizer">
              <div className="catalogue-filters">
                <div><span>LIHAT PRODUK BERDASARKAN</span><h2>Kategori & brand</h2></div>
                <label>Kategori<select value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setBrandFilter("Semua brand")}}><option>Semua kategori</option>{categories.map(c=><option key={c.id}>{c.name}</option>)}</select></label>
                <label>Brand<select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option>Semua brand</option>{availableBrands.map(b=><option key={b}>{b}</option>)}</select></label>
                <button onClick={()=>setManageCategories(x=>!x)}>{manageCategories?"Tutup pengaturan":"Atur kategori"}</button>
              </div>
              {manageCategories&&<div className="category-manager"><div className="category-add"><input value={categoryDraft} onChange={e=>setCategoryDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCategory()}} placeholder="Nama kategori baru"/><button onClick={addCategory}><Plus size={14}/> Tambah kategori</button></div>{categories.map(c=><div className="category-manage-row" key={c.id}><input defaultValue={c.name} onBlur={e=>renameCategory(c,e.target.value)}/><span>{catalogue.filter(p=>p.category===c.name).length} produk</span><span>Margin {c.default_margin_percent}%</span><button onClick={()=>deleteCategory(c)} disabled={catalogue.some(p=>p.category===c.name)}><Trash2 size={14}/></button></div>)}</div>}
            </article>
            <article className="panel catalogue-panel">
              <div className="catalogue-table">
                <div className="catalogue-row catalogue-head">
                  <span>Produk</span>
                  <span>Kategori</span>
                  <span>Harga {currency}</span>
                  <span>Berat</span>
                  <span>Harga jual</span>
                  <span>Status</span>
                  <span>Landing page</span>
                  <span>Aksi</span>
                </div>
                {categories.filter(c=>categoryFilter==="Semua kategori"||c.name===categoryFilter).map(category=>{
                  const categoryProducts=visibleCatalogue.filter(p=>p.category===category.name);
                  const brands=Array.from(new Set(categoryProducts.map(p=>p.brand||"Tanpa brand"))).sort();
                  const opened=openCategories.has(category.name);
                  return <section className={`catalogue-category ${opened?"open":""}`} key={category.id}>
                    <button className="catalogue-category-row" onClick={()=>toggleCategory(category.name)}>
                      <span className="category-chevron">{opened?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</span>
                      <span><b>{category.name}</b><small>{brands.length} brand</small></span>
                      <strong>{categoryProducts.length} produk</strong>
                      <small>{opened?"Tutup kategori":"Buka kategori"}</small>
                    </button>
                    {opened&&<div className="catalogue-category-content">
                      {categoryProducts.length===0?<div className="empty-category">Belum ada produk dalam kategori ini.</div>:brands.map(brand=>{
                        const brandProducts=categoryProducts.filter(p=>(p.brand||"Tanpa brand")===brand);
                        return <div className="catalogue-brand-group" key={brand}>
                          <div className="catalogue-brand-row"><span>BRAND</span><b>{brand}</b><small>{brandProducts.length} produk</small></div>
                          {brandProducts.map(p=>{const calc=productPricing(p);return <div className="catalogue-row" key={p.id}>
                            <div className="product-identity"><div className="catalogue-thumb">{p.photo_url?<img src={p.photo_url} alt=""/>:<PackageSearch size={18}/>}</div><span><b>{p.name}</b><small>{p.product_code}</small></span></div>
                            <span className="catalogue-pill">{p.category}</span>
                            <b>{currencySymbol}{Number(p.local_price||p.price_thb).toLocaleString("id-ID")}</b>
                            <span className={!p.weight_grams?"needs-data":""}>{p.weight_grams?`${p.weight_grams} g`:"Belum diisi"}</span>
                            <strong>{format(calc.sell)}</strong>
                            <span className={`status-badge ${p.status==="Ready"?"ready":""}`}>{p.status}</span>
                            <span className={`status-badge ${p.published?"live":""}`}>{p.published?"Tayang":"Belum tayang"}</span>
                            <button className="edit-product-button" onClick={()=>openProductEditor(p)}><Pencil size={14}/> Edit</button>
                          </div>})}
                        </div>
                      })}
                    </div>}
                  </section>
                })}
              </div>
            </article>
            {productModal && (
              <div
                className="modal-backdrop"
                onMouseDown={() => setProductModal(false)}
              >
                <div
                  className="expense-modal product-modal"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="modal-title">
                    <div>
                      <span>PRODUCT CATALOGUE</span>
                      <h2>Tambah produk</h2>
                    </div>
                    <button onClick={() => setProductModal(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-form">
                    <label>
                      Nama produk *
                      <input
                        autoFocus
                        value={productDraft.name}
                        placeholder="Contoh: Gentlewoman tote"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Brand
                      <input
                        value={productDraft.brand}
                        placeholder="Contoh: Gentlewoman"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            brand: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Kategori
                      <select
                        value={productDraft.category}
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            category: e.target.value,
                          }))
                        }
                      >
                        {categories.map(c=><option key={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label>
                      Harga toko ({currency}) *
                      <input
                        type="number"
                        value={productDraft.price_thb || ""}
                        placeholder="Contoh: 790"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            price_thb: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Estimasi berat (gram) *
                      <input
                        type="number"
                        value={productDraft.weight_grams || ""}
                        placeholder="Contoh: 300"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            weight_grams: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Tipe produk
                      <input
                        value={productDraft.product_type}
                        placeholder="Contoh: Tote bag"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            product_type: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Lokasi toko
                      <input
                        value={productDraft.store_location}
                        placeholder="Nama mall / lantai"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            store_location: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Link produk
                      <input
                        value={productDraft.source_url}
                        placeholder="https://..."
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            source_url: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Warna
                      <input
                        value={productDraft.color}
                        placeholder="Opsional"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            color: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Ukuran
                      <input
                        value={productDraft.size}
                        placeholder="Opsional"
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            size: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={productDraft.status}
                        onChange={(e) =>
                          setProductDraft((x) => ({
                            ...x,
                            status: e.target.value as
                              | "Draft"
                              | "Ready"
                              | "Archived",
                          }))
                        }
                      >
                        <option>Draft</option>
                        <option>Ready</option>
                      </select>
                    </label>
                  </div>
                  <div className="preview-price">
                    <span>Preview harga jual otomatis</span>
                    <strong>
                      {format(
                        productPricing({
                          ...productDraft,
                          margin_percent: null,
                        }).sell,
                      )}
                    </strong>
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => setProductModal(false)}>
                      Batal
                    </button>
                    <button
                      className="save-expense"
                      disabled={
                        !productDraft.name.trim() || !productDraft.price_thb
                      }
                      onClick={addProduct}
                    >
                      Simpan produk
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="phase-banner">
              <div>
                <span>Current phase</span>
                <strong>Demand validation</strong>
                <p>
                  Collect 25+ product requests and identify repeated buyer pain
                  points.
                </p>
              </div>
              <div className="phase-progress">
                <span>
                  <b>Day 1</b> of 61
                </span>
                <div>
                  <i />
                </div>
                <small>Next milestone: Audience building · 13 Sep</small>
              </div>
            </section>
            <section className="metrics">
              <Metric
                label="Total leads"
                value="48"
                note="↑ 12 this week"
                tone="positive"
              />
              <Metric
                label="Paid orders"
                value="14"
                note="28% of final target"
              />
              <Metric
                label="Gross order value"
                value="Rp11,8jt"
                note="Rp10,2jt remaining"
              />
              <Metric
                label="Cash collected"
                value="Rp7,4jt"
                note="63% collection rate"
              />
            </section>
            <section className="goal-panel">
              <div className="goal-main">
                <span>Target dana {activeTrip?.name}</span>
                <strong>{format(targetFund)}</strong>
                <p>
                  Sudah terkumpul <b>{format(collected)}</b> dari {confirmedOrders} paid orders
                </p>
                <div className="goal-bar">
                  <i
                    style={{
                      width:
                        Math.min(100, (collected / Math.max(1,targetFund)) * 100) + "%",
                    }}
                  />
                </div>
                <div className="goal-stats">
                  <span>
                    <b>{Math.round((collected / Math.max(1,targetFund)) * 100)}%</b>{" "}
                    tercapai
                  </span>
                  <span>
                    <b>{format(remaining)}</b> masih dibutuhkan
                  </span>
                </div>
              </div>
              <div className="goal-settings">
                <label>
                  Target dana dari {activeTripCode}
                  <input type="number" value={targetFund} readOnly />
                </label>
                <label>
                  Dana terkumpul
                  <input
                    type="number"
                    value={collected || ""}
                    placeholder="Masukkan dana"
                    onChange={(e) => setCollected(Number(e.target.value))}
                    onBlur={(e) =>
                      saveSetting("collected_fund", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Target total order
                  <input
                    type="number"
                    value={orderTarget || ""}
                    placeholder="Masukkan target"
                    onChange={(e) => setOrderTarget(Number(e.target.value))}
                    onBlur={(e) =>
                      saveSetting("target_orders", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Tarif cargo fashion / kg
                  <input
                    type="number"
                    value={cargoRate || ""}
                    placeholder="95000"
                    onChange={(e) => setCargoRate(Number(e.target.value))}
                    onBlur={(e) =>
                      saveSetting(
                        "fashion_cargo_per_kg",
                        Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
            </section>
            <section className="finance-panel">
              <div className="finance-title">
                <div>
                  <span>Order price calculator</span>
                  <h2>Hitung harga jual satu barang</h2>
                  <p>
                    Masukkan harga dalam {currency} dan berat gram. Kurs {activeTrip?.country}, cargo, dan target margin dihitung otomatis.
                  </p>
                </div>
                <button onClick={refreshRate}>
                  <RefreshCw size={15} /> Refresh kurs
                </button>
              </div>
              <div className="order-calc">
                <div className="order-inputs">
                  <label>
                    Kategori barang
                    <select
                      value={productCategory}
                      onChange={(e) =>
                        setProductCategory(e.target.value)
                      }
                    >
                      {categories.map(c=><option key={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Harga barang ({currency})
                    <input
                      type="number"
                      value={itemBaht || ""}
                      placeholder="Contoh: 200"
                      onChange={(e) => setItemBaht(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Berat barang (gram)
                    <input
                      type="number"
                      value={itemGrams || ""}
                      placeholder="Contoh: 350"
                      onChange={(e) => setItemGrams(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Margin otomatis (%)
                    <input
                      type="number"
                      value={calculatorMargin}
                      readOnly
                    />
                  </label>
                  <div className="mini-rate">
                    <span>Kurs otomatis</span>
                    <b>
                      {currencySymbol}1 = Rp
                      {rate.toLocaleString("id-ID", {
                        maximumFractionDigits: 2,
                      })}
                    </b>
                    <input aria-label="Kurs manual ke rupiah" type="number" value={rate||""} onChange={(e)=>{setRate(Number(e.target.value));setRateStatus("Kurs manual untuk kalkulasi ini")}} />
                    <small>{rateStatus}</small>
                  </div>
                </div>
                <div className="cost-lines">
                  <div>
                    <span>Harga barang rupiah</span>
                    <b>{format(itemCost)}</b>
                  </div>
                  <div>
                    <span>
                      Cargo {itemGrams}g · {format(effectiveCargoRate)}/kg
                    </span>
                    <b>{format(itemCargo)}</b>
                  </div>
                  <div>
                    <span>Modal setelah cargo</span>
                    <b>{format(landed)}</b>
                  </div>
                  <div>
                    <span>Untung {calculatorMargin}%</span>
                    <b>{format(targetProfit)}</b>
                  </div>
                </div>
                <div className="price-result">
                  <Plane size={20} />
                  <span>Harga jual rekomendasi</span>
                  <strong>{format(suggestedPrice)}</strong>
                  <p>
                    Target untung dipakai <b>{format(targetProfit)}</b> ·{" "}
                    {adaptiveMargin.toFixed(1)}%
                  </p>
                  <small>
                    Harga jual = harga barang + cargo berdasarkan {itemGrams} gram + margin {calculatorMargin}%. Tidak lagi dipaksa mengejar nominal untung per order.
                  </small>
                </div>
              </div>
            </section>
            <section className="grid-two">
              <article className="panel funnel">
                <div className="panel-head">
                  <div>
                    <span>Sales funnel</span>
                    <h2>From interest to paid order</h2>
                  </div>
                  <button>
                    View leads <ChevronRight size={15} />
                  </button>
                </div>
                <div className="funnel-chart">
                  {stages.map((s, i) => (
                    <div className="funnel-row" key={s[0]}>
                      <span>{s[0]}</span>
                      <div>
                        <i
                          style={{
                            width: (Number(s[1]) / 48) * 100 + "%",
                            background: String(s[2]),
                          }}
                        />
                      </div>
                      <b>{s[1]}</b>
                      <small>
                        {i
                          ? Math.round(
                              (Number(s[1]) / Number(stages[i - 1][1])) * 100,
                            ) + "%"
                          : "100%"}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="insight">
                  <Sparkles size={17} />
                  <p>
                    <b>Main opportunity:</b> 15 waitlist members haven’t become
                    hot leads. Send the catalogue teaser and ask for their
                    maximum budget.
                  </p>
                </div>
              </article>
              <article className="panel tasks">
                <div className="panel-head">
                  <div>
                    <span>Action center</span>
                    <h2>Do these today</h2>
                  </div>
                  <small>
                    {done}/{tasks.length} done
                  </small>
                </div>
                <div className="task-progress">
                  <i style={{ width: (done / tasks.length) * 100 + "%" }} />
                </div>
                <div className="task-list">
                  {tasks.map((t, i) => (
                    <button
                      key={t.text}
                      className={t.done ? "done" : ""}
                      onClick={() =>
                        setTasks((a) =>
                          a.map((v, n) =>
                            n === i ? { ...v, done: !v.done } : v,
                          ),
                        )
                      }
                    >
                      <span className="check">
                        {t.done ? <CheckCircle2 /> : <i />}
                      </span>
                      <span>
                        {t.text}
                        <small>{t.tag}</small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </div>
                <button className="add-task">
                  <Plus size={16} /> Add task
                </button>
              </article>
            </section>
            <section className="grid-lower">
              <article className="panel products">
                <div className="panel-head">
                  <div>
                    <span>Demand intelligence</span>
                    <h2>Most requested products</h2>
                  </div>
                  <button>
                    See all <ChevronRight size={15} />
                  </button>
                </div>
                <div className="table">
                  <div className="tr th">
                    <span>Product</span>
                    <span>Requests</span>
                    <span>Avg budget</span>
                    <span>Priority</span>
                  </div>
                  {products.map((p) => (
                    <div className="tr" key={p[0]}>
                      <span>
                        <b>{p[0]}</b>
                        <small>{p[1]}</small>
                      </span>
                      <span>{p[2]}</span>
                      <span>{p[3]}</span>
                      <span>
                        <em className={"badge " + p[4].toLowerCase()}>
                          {p[4]}
                        </em>
                      </span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel capacity">
                <div className="panel-head">
                  <div>
                    <span>Order capacity</span>
                    <h2>Trip workload</h2>
                  </div>
                  <CircleDollarSign />
                </div>
                <div
                  className="capacity-ring"
                  style={{ "--pct": pct * 3.6 + "deg" } as React.CSSProperties}
                >
                  <div>
                    <strong>{pct}%</strong>
                    <span>used</span>
                  </div>
                </div>
                <div className="capacity-copy">
                  <b>{confirmedOrders} confirmed orders</b>
                  <span>{Math.max(0, capacity - confirmedOrders)} slots remaining</span>
                </div>
                <label>
                  Maximum capacity{" "}
                  <input
                    type="number"
                    min="15"
                    max="200"
                    value={capacity || ""}
                    placeholder="50"
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </label>
              </article>
            </section>
            <section className="panel leads">
              <div className="panel-head">
                <div>
                  <span>Sales pipeline</span>
                  <h2>Leads needing attention</h2>
                </div>
                <button>
                  Open CRM <ChevronRight size={15} />
                </button>
              </div>
              <div className="lead-table">
                <div className="lead-row head">
                  <span>Customer</span>
                  <span>Request</span>
                  <span>Stage</span>
                  <span>Potential value</span>
                  <span>Next action</span>
                </div>
                {leads.map((l, i) => (
                  <div className="lead-row" key={l[0]}>
                    <span>
                      <i className={"avatar a" + i}>{l[0][0]}</i>
                      <b>{l[0]}</b>
                    </span>
                    <span>{l[1]}</span>
                    <span>
                      <em className="status">{l[2]}</em>
                    </span>
                    <span>
                      <b>{l[3]}</b>
                    </span>
                    <span className={l[4] === "Hari ini" ? "urgent" : ""}>
                      {l[4]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {tripModal && (
          <div className="modal-backdrop" onMouseDown={() => setTripModal(false)}>
            <div className="expense-modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-title">
                <div><span>NEW INTERNATIONAL TRIP</span><h2>Buat trip baru</h2></div>
                <button onClick={() => setTripModal(false)}><X size={18}/></button>
              </div>
              <div className="modal-form">
                <label>Nama trip<input value={tripDraft.name} placeholder="Contoh: Malaysia Edit 02" onChange={(e)=>setTripDraft(x=>({...x,name:e.target.value}))}/></label>
                <label>Negara<select value={tripDraft.country} onChange={(e)=>{const d=destinations.find(x=>x.country===e.target.value)!;setTripDraft(x=>({...x,country:d.country,city:d.city,name:`${d.country} Edit`}))}}>{destinations.map(d=><option key={d.country}>{d.country}</option>)}</select></label>
                <label>Kota<input value={tripDraft.city} onChange={(e)=>setTripDraft(x=>({...x,city:e.target.value}))}/></label>
                <label>Tanggal berangkat<input type="date" value={tripDraft.departure_date} onChange={(e)=>setTripDraft(x=>({...x,departure_date:e.target.value}))}/></label>
                <label>Tanggal pulang<input type="date" value={tripDraft.return_date} onChange={(e)=>setTripDraft(x=>({...x,return_date:e.target.value}))}/></label>
                <div className="currency-preview"><span>Mata uang otomatis</span><strong>{destinations.find(d=>d.country===tripDraft.country)?.currency}</strong><small>Kurs ke rupiah akan diperbarui otomatis</small></div>
              </div>
              <div className="modal-actions"><button onClick={()=>setTripModal(false)}>Batal</button><button className="save-expense" onClick={addTrip}>Buat & buka trip</button></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
