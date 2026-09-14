import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { calculatePrice } from '../lib/pricing.ts';
const db = new PGlite();
const member = '10000000-0000-4000-8000-000000000001',
  outsider = '10000000-0000-4000-8000-000000000002';
const product = '20000000-0000-4000-8000-000000000001',
  variant = '30000000-0000-4000-8000-000000000001';
await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
 grant usage on schema public,auth,storage to anon,authenticated;
 create table public.workspace_members(email text primary key,role text);
 create table public.trips(code text primary key,name text,country text,currency_code text,departure_date date,return_date date,status text,fashion_cargo_per_kg numeric,nonfashion_cargo_per_kg numeric);
 create table public.trip_expenses(id uuid primary key);
 create table public.products(id uuid primary key,trip_code text references trips(code),name text,brand text,category text,photo_url text,published boolean,status text,approved_at timestamptz,margin_percent numeric);
 create table public.product_variants(id uuid primary key,product_id uuid references products(id),name text,local_price numeric,weight_grams numeric,stock integer,active boolean,created_at timestamptz default now());
 create table public.product_categories(id uuid primary key);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 -- Deliberately broad old policies: new restrictive guards must constrain these.
 create policy old_open on storage.objects for all to anon,authenticated using(true) with check(true);
 create policy old_open on products for all to anon,authenticated using(true) with check(true);
 insert into workspace_members values('team@example.com','editor'),('viewer@example.com','viewer');
 insert into trips values('TRIP-001','Malaysia Edit','Malaysia','MYR',null,null,'Open PO',95000,110000);
 insert into products values('${product}','TRIP-001','Test Bag','Elsewhere','Pakaian','',true,'Ready',now(),30);
 insert into product_variants(id,product_id,name,local_price,weight_grams,stock,active) values('${variant}','${product}','M',100,500,2,true);
`);
await db.exec(
  await readFile(
    new URL(
      '../supabase/migrations/202609120001_commerce.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
await db.exec(
  `update trips set exchange_rate_idr=3500; update product_variants set preorder_capacity=2;`,
);
async function role(name, uid = '', email = '') {
  await db.exec('reset role');
  await db.query(
    `select set_config('test.uid',$1,false),set_config('test.email',$2,false)`,
    [uid, email],
  );
  await db.exec(`set role ${name}`);
}
async function owner() {
  await db.exec('reset role');
}
async function catalogue() {
  return (await db.query('select commerce_catalogue() as data')).rows[0].data;
}
let price = 516750;
async function place(id = crypto.randomUUID(), quantity = 1, expected = price) {
  return (
    await db.query(
      'select commerce_place_order($1,$2,$3,$4,$5,$6,$7,$8) as data',
      [
        id,
        variant,
        quantity,
        expected,
        'Pelanggan',
        '628123456789',
        'Jalan Contoh 123, Makassar 90111',
        '',
      ],
    )
  ).rows[0].data;
}
await test('legacy public catalogue exposes only approved open-trip products', async () => {
  await role('anon');
  const c = await catalogue();
  assert.equal(c.length, 1);
  assert.equal(c[0].product_variants[0].unit_price_idr, price);
  assert.equal('local_price' in c[0].product_variants[0], false);
  assert.equal('margin_percent' in c[0], false);
  await assert.rejects(db.query('select * from products'), /permission denied/);
  await assert.rejects(db.query('select * from orders'), /permission denied/);
});
await test('draft, archived, inactive variants and closed trips cannot be ordered', async () => {
  for (const [change, restore] of [
    [
      'update products set published=false',
      'update products set published=true',
    ],
    [
      "update products set status='Archived'",
      "update products set status='Ready'",
    ],
    [
      "update trips set status='Completed'",
      "update trips set status='Open PO'",
    ],
    [
      'update product_variants set active=false',
      'update product_variants set active=true',
    ],
  ]) {
    await owner();
    await db.exec(change);
    await role('anon');
    await assert.rejects(place(), /tidak menerima/);
    const c = await catalogue();
    assert.ok(c.length === 0 || c[0].product_variants.length === 0);
    await owner();
    await db.exec(restore);
  }
});
await test('missing rate fails closed; changed price and invalid quantity are rejected', async () => {
  await owner();
  await db.exec('update trips set exchange_rate_idr=null');
  await role('anon');
  assert.equal((await catalogue())[0].product_variants[0].unit_price_idr, null);
  await assert.rejects(place(), /Harga belum siap/);
  await owner();
  await db.exec('update trips set exchange_rate_idr=3500');
  await role('anon');
  await assert.rejects(place(crypto.randomUUID(), 1, 1), /Harga berubah/);
  await assert.rejects(place(crypto.randomUUID(), 0), /valid/);
  await assert.rejects(place(crypto.randomUUID(), 21), /valid/);
});
let orderId, code;
await test('checkout snapshots price, reserves capacity and retries without a duplicate', async () => {
  await role('anon');
  const token = crypto.randomUUID();
  const first = await place(token, 2);
  code = first.order_code;
  assert.deepEqual(await place(token, 2), first);
  assert.equal(first.total_idr, price * 2);
  assert.equal((await catalogue())[0].product_variants[0].available, 0);
  await assert.rejects(place(), /kuota tidak mencukupi/);
  await owner();
  const rows = (await db.query('select * from orders')).rows;
  assert.equal(rows.length, 1);
  orderId = rows[0].id;
  await db.exec('update trips set exchange_rate_idr=3600');
  assert.equal(
    Number(
      (await db.query('select unit_price_idr from order_items')).rows[0]
        .unit_price_idr,
    ),
    price,
  );
  await db.exec('update trips set exchange_rate_idr=3500');
});
await test('nonmembers cannot read PII, change products, enroll themselves, or use staff RPCs', async () => {
  await role('authenticated', outsider, 'outsider@example.com');
  assert.equal((await db.query('select * from orders')).rows.length, 0);
  assert.equal((await db.query('select * from products')).rows.length, 0);
  assert.equal(
    (await db.query('select * from workspace_members')).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      "insert into workspace_members values('outsider@example.com','admin')",
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.query('select commerce_update_order($1,$2)', [orderId, 'confirmed']),
    /Akses ditolak/,
  );
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name) values('order-receipts','leak')",
    ),
    /row-level security/,
  );
});
let paymentId;
await test('payments are pending first, idempotent, capped, and explicitly verified', async () => {
  await role('authenticated', member, 'team@example.com');
  assert.equal((await db.query('select * from orders')).rows.length, 1);
  const token = crypto.randomUUID();
  const args = [token, orderId, 100000, 'DP bank', null];
  paymentId = (
    await db.query('select commerce_record_payment($1,$2,$3,$4,$5) as id', args)
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        'select commerce_record_payment($1,$2,$3,$4,$5) as id',
        args,
      )
    ).rows[0].id,
    paymentId,
  );
  assert.equal(
    (await db.query('select verified_at from order_payments')).rows[0]
      .verified_at,
    null,
  );
  await assert.rejects(
    db.query('select commerce_record_payment($1,$2,$3,$4)', [
      crypto.randomUUID(),
      orderId,
      price * 2,
      'Too much',
    ]),
    /melebihi/,
  );
  await db.query('select commerce_verify_payment($1)', [paymentId]);
  await db.query('select commerce_verify_payment($1)', [paymentId]);
  assert.ok(
    (await db.query('select verified_at from order_payments')).rows[0]
      .verified_at,
  );
  await assert.rejects(
    db.query('select commerce_remove_pending_payment($1)', [paymentId]),
    /belum diverifikasi/,
  );
  await assert.rejects(
    db.query('select commerce_update_order($1,$2)', [orderId, 'cancelled']),
    /Pembatalan/,
  );
});
await test('fulfillment is sequential and shipping requires paid balance and tracking', async () => {
  await assert.rejects(
    db.query('select commerce_update_order($1,$2)', [orderId, 'packed']),
    /berurutan/,
  );
  for (const status of ['confirmed', 'purchased', 'arrived', 'packed'])
    await db.query('select commerce_update_order($1,$2)', [orderId, status]);
  await assert.rejects(
    db.query('select commerce_update_order($1,$2,$3,$4)', [
      orderId,
      'shipped',
      'JNE',
      'TEST123',
    ]),
    /Lunasi/,
  );
  const final = (
    await db.query('select commerce_record_payment($1,$2,$3,$4) as id', [
      crypto.randomUUID(),
      orderId,
      price * 2 - 100000,
      'Pelunasan',
    ])
  ).rows[0].id;
  await db.query('select commerce_verify_payment($1)', [final]);
  await assert.rejects(
    db.query('select commerce_update_order($1,$2)', [orderId, 'shipped']),
    /resi/,
  );
  await assert.rejects(
    db.query('select commerce_update_order($1,$2,$3,$4)', [
      orderId,
      'shipped',
      null,
      null,
    ]),
    /resi/,
  );
  await db.query('select commerce_update_order($1,$2,$3,$4)', [
    orderId,
    'shipped',
    'JNE',
    'TEST123',
  ]);
  await db.query('select commerce_update_order($1,$2,$3,$4)', [
    orderId,
    'completed',
    'JNE',
    'TEST123',
  ]);
  await assert.rejects(
    db.query('select commerce_update_order($1,$2)', [orderId, 'new']),
    /ditutup/,
  );
});
await test('stock mode uses stock; unpaid cancellation restores availability and pending errors can be removed', async () => {
  await owner();
  await db.exec("update product_variants set stock=3,sale_mode='stock'");
  await role('anon');
  await place();
  assert.equal((await catalogue())[0].product_variants[0].available, 0);
  await role('authenticated', member, 'team@example.com');
  const id = (await db.query("select id from orders where status='new'"))
    .rows[0].id;
  const pending = (
    await db.query('select commerce_record_payment($1,$2,$3,$4) as id', [
      crypto.randomUUID(),
      id,
      100,
      'Mistake',
    ])
  ).rows[0].id;
  await db.query('select commerce_remove_pending_payment($1)', [pending]);
  await db.query('select commerce_update_order($1,$2)', [id, 'cancelled']);
  await role('anon');
  assert.equal((await catalogue())[0].product_variants[0].available, 1);
});
await test('existing viewers remain read-only despite old broad policies', async () => {
 await role('authenticated', outsider, 'viewer@example.com');
 assert.ok((await db.query('select * from orders')).rows.length > 0);
 assert.equal((await db.query('update products set name = $1 where id = $2 returning id', ['Changed by viewer', product])).rows.length, 0);
 await assert.rejects(db.query('select commerce_update_order($1,$2)', [orderId,'confirmed']), /owner\/editor/);
 await assert.rejects(db.query('select commerce_record_payment($1,$2,$3,$4)', [crypto.randomUUID(),orderId,1,'Forbidden']), /owner\/editor/);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('order-receipts','forbidden')"), /row-level security/);
});
await test('Malaysia settings and unlimited preorder migration preserve existing orders', async () => {
 await owner();
 const before = (await db.query('select count(*)::int as n from orders')).rows[0].n;
 await db.exec(await readFile(new URL('../supabase/migrations/202609130001_preorder_and_rates.sql',import.meta.url),'utf8'));
 const t=(await db.query('select * from trips')).rows[0];
 assert.equal(t.name,'Malaysia trip'); assert.equal(Number(t.fashion_cargo_per_kg),90000); assert.equal(Number(t.nonfashion_cargo_per_kg),90000);
 assert.equal((await db.query('select count(*)::int as n from orders')).rows[0].n,before);
 await role('anon');
 const c=await catalogue(); assert.equal(c[0].product_variants[0].available,null); assert.equal(c[0].product_variants[0].unit_price_idr,null);
 await assert.rejects(place(), /Harga belum siap/);
});
const payload = (rate=3500, age=0) => ({result:'success',base_code:'MYR',time_last_update_unix:Math.floor(Date.now()/1000)-age,rates:{IDR:rate}});
async function acceptRate(rate=3500){ await owner(); await db.query('select commerce_accept_rate($1,$2)', ['MYR',payload(rate)]); }
const orderFor = async (phone, token=crypto.randomUUID(), quantity=20, expected=513500) => (await db.query('select commerce_place_order($1,$2,$3,$4,$5,$6,$7,$8) as data',[token,variant,quantity,expected,'Preorder Customer',phone,'Jalan Contoh 123, Makassar 90111',''])).rows[0].data;
await test('FX responses are validated and clients cannot overwrite rates', async () => {
 await acceptRate();
 await assert.rejects(db.query('select commerce_accept_rate($1,$2)',['MYR',{...payload(),base_code:'USD'}]),/Invalid rate/);
 await assert.rejects(db.query('select commerce_accept_rate($1,$2)',['MYR',payload(0)]),/Invalid or stale/);
 await assert.rejects(db.query('select commerce_accept_rate($1,$2)',['MYR',payload(3500,49*3600)]),/Invalid or stale/);
 await role('authenticated',member,'team@example.com');
 await assert.rejects(db.query('select commerce_accept_rate($1,$2)',['MYR',payload(1)]),/permission denied/);
 // Existing broad table policy cannot override the authoritative rate cache.
 await owner(); await db.exec('update trips set exchange_rate_idr=1');
 assert.equal(Number((await db.query('select exchange_rate_idr from trips')).rows[0].exchange_rate_idr),3500);
 await role('anon'); assert.equal((await catalogue())[0].product_variants[0].unit_price_idr,513500);
});
let repeatToken=crypto.randomUUID(), unlimitedOrder;
await test('unlimited preorder ignores stock but server throttles repeated submissions', async () => {
 await role('anon');
 unlimitedOrder=await orderFor('628111111111',repeatToken);
 await orderFor('628111111111'); await orderFor('628111111111');
 assert.equal((await catalogue())[0].product_variants[0].available,null);
 await assert.rejects(orderFor('628111111111'),/Terlalu banyak/);
 await assert.rejects(orderFor('08111111111'),/Terlalu banyak/);
 assert.deepEqual(await orderFor('628111111111',repeatToken),unlimitedOrder);
});
await test('FX refresh updates catalogue prices but never existing order snapshots', async () => {
 await acceptRate(3600); await role('anon');
 assert.equal((await catalogue())[0].product_variants[0].unit_price_idr,526500);
 await assert.rejects(orderFor('628222222222'),/Harga berubah/);
 await owner();
 const old=(await db.query('select total_idr from orders where order_code=$1',[unlimitedOrder.order_code])).rows[0]; assert.equal(Number(old.total_idr),513500*20);
 await db.exec("update commerce_exchange_rates set source_updated_at=now()-interval '49 hours'");
 await role('anon'); assert.equal((await catalogue())[0].product_variants[0].unit_price_idr,null);
 await assert.rejects(orderFor('628222222222'),/Harga belum siap/);
});
await test('expiry cancels only unconfirmed orders without payment records', async () => {
 await owner();
 const rows=(await db.query("select id from orders where phone='628111111111' order by created_at,id")).rows;
 await db.exec("update orders set created_at=now()-interval '49 hours' where phone='628111111111'");
 await db.query("update orders set status='confirmed' where id=$1",[rows[1].id]);
 await db.query("insert into order_payments(request_id,order_id,amount_idr,reference,created_by) values($1,$2,100,'Pending DP',$3)",[crypto.randomUUID(),rows[2].id,member]);
 assert.equal((await db.query('select commerce_expire_unpaid_orders() as n')).rows[0].n,1);
 assert.equal((await db.query('select status from orders where id=$1',[rows[0].id])).rows[0].status,'cancelled');
 assert.equal((await db.query('select status from orders where id=$1',[rows[1].id])).rows[0].status,'confirmed');
 assert.equal((await db.query('select status from orders where id=$1',[rows[2].id])).rows[0].status,'new');
});
await test('hourly infrastructure seeds rates and preserves last good rate on provider failure', async () => {
 await owner();
 await db.exec(`create schema extensions; create schema cron;
 create table cron.test_jobs(name text, schedule text, command text);
 create function cron.schedule(n text,s text,c text) returns bigint language plpgsql as $$ begin insert into cron.test_jobs values(n,s,c); return 1; end $$;
 create function extensions.http_set_curlopt(n text,v text) returns boolean language sql as $$ select true $$;
 create table extensions.test_response(status integer,content text);
 create function extensions.http_get(url text) returns table(status integer,content text) language sql as $$ select * from extensions.test_response $$;`);
 await db.query('insert into extensions.test_response values(200,$1)',[JSON.stringify(payload())]);
 const scheduled=await readFile(new URL('../supabase/migrations/202609130002_scheduled_rates.sql',import.meta.url),'utf8');
 // PGlite has no network/cron extensions; execute their actual caller against deterministic stand-ins.
 await db.exec(scheduled.replace(/^create extension .*;$/gm,''));
 assert.equal((await db.query('select count(*)::int as n from cron.test_jobs')).rows[0].n,2);
 assert.equal(Number((await db.query("select commerce_current_rate('MYR') as r")).rows[0].r),3500);
 await db.exec('update extensions.test_response set status=503'); await db.exec('select commerce_refresh_rates()');
 assert.equal(Number((await db.query("select commerce_current_rate('MYR') as r")).rows[0].r),3500);
 assert.ok((await db.query('select last_error from commerce_exchange_rates')).rows[0].last_error);
 await role('anon'); await assert.rejects(db.query('select commerce_refresh_rates()'),/permission denied/);
});

await test('rounding/photo migration preserves existing orders and variant links', async () => {
 await owner();
 const before=(await db.query('select id,total_idr from orders order by id')).rows;
 await db.exec("alter table product_variants add column photo_url text; update product_variants set photo_url='https://example.com/blue.jpg';");
 await db.exec(await readFile(new URL('../supabase/migrations/202609140001_variant_photos_rounding.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select id,total_idr from orders order by id')).rows,before);
 await acceptRate();
 await db.exec("update product_variants set local_price=100, weight_grams=500; update products set margin_percent=30, published=true,status='Ready';");
 await role('anon');
 const v=(await catalogue())[0].product_variants[0];
 assert.equal(v.photo_url,'https://example.com/blue.jpg');
 assert.equal(v.unit_price_idr,514000);
 assert.equal('capital' in v,false); assert.equal('profit' in v,false);
 await assert.rejects(orderFor('628999900001',crypto.randomUUID(),1,513500),/Harga berubah/);
 const order=await orderFor('628999900001',crypto.randomUUID(),1,514000);
 assert.equal(order.total_idr,514000);
});
await test('rounding boundaries and profit match the rounded selling price', async()=>{
 await owner();
 for(const [localPrice, expected] of [[0,0],[1000,1000],[1000.01,2000],[999.99,1000],[123400,124000]]) {
  const input={localPrice,grams:0,category:'Fashion',margin:0,rate:1,fashionCargo:0,otherCargo:0};
  const calc=calculatePrice(input);
  const dbPrice=(await db.query("select commerce_price($1,0,'Fashion',0,1,0,0) as p",[localPrice])).rows[0].p;
  assert.equal(Number(dbPrice),expected);assert.equal(calc.sell,expected);
  assert.ok(Math.abs(calc.profit-(expected-localPrice))<0.00001);
 }
});
await test('pricing parity across aliases, margins, zero weight and rounding', async () => {
  await owner();
  for (const category of [
    'Fashion',
    'Pakaian',
    'Tas',
    'Makanan & Minuman',
    'Beauty',
  ])
    for (const margin of [null, 0, 25.5]) {
      const input = {
        localPrice: 12.37,
        grams: 333,
        category,
        margin,
        rate: 3521.19,
        fashionCargo: 95000,
        otherCargo: 110000,
      };
      const result = (
        await db.query('select commerce_price($1,$2,$3,$4,$5,$6,$7) as price', [
          input.localPrice,
          input.grams,
          category,
          margin,
          input.rate,
          input.fashionCargo,
          input.otherCargo,
        ])
      ).rows[0].price;
      assert.equal(Number(result), calculatePrice(input).sell);
    }
});
await test('fractional rupiah always rounds up to the next thousand', async () => {
  await owner();
  const input = {
    localPrice: 1.005,
    grams: 0,
    category: 'Pakaian',
    margin: 0,
    rate: 100,
    fashionCargo: 0,
    otherCargo: 0,
  };
  const result = (
    await db.query('select commerce_price($1,$2,$3,$4,$5,$6,$7) as price', [
      input.localPrice,
      input.grams,
      input.category,
      input.margin,
      input.rate,
      0,
      0,
    ])
  ).rows[0].price;
  assert.equal(Number(result), 1000);
  assert.equal(calculatePrice(input).sell, 1000);
});
await db.close();
