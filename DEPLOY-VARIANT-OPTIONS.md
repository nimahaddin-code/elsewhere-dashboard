# Handoff: Variant Options and Photo Upload

## Scope

This release adds:

- Two product option dimensions, for example `Style` and `Ukuran`.
- One editable row per sellable combination.
- Variant-level photo upload to the existing `product-images` bucket.
- Variant-level photo URL support with product-photo fallback.
- Public catalogue selectors that behave like Style -> Size selection.
- Scroll restoration when leaving and returning to the product editor.
- Editable trip status, including `Open PO`.

This release does not include the social-slide generator from upstream commit `6e178d4`. Do not expect `SMART CATALOGUE STUDIO` in this branch.

## Source and deployment target

- Branch: `landing-dashboard-integration`
- Fork remote: `origin`
- Build: `npm run build:vercel`
- Output: `dist-vercel`
- Node: 22.13 or newer
- Vercel preset: Vite, not Next.js

Deploy the frontend from the commit being handed over. Environment variables are read during build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_WHATSAPP_NUMBER`

Use only the Supabase publishable key in Vercel. Never put a secret or service-role key in frontend environment variables.

## Database migration order

Before changing the live database, create a full backup of schema, policies, data, and any required Storage objects. Do not commit `.env.local`, passwords, service-role keys, or database backups.

Run each SQL file once, in this order, in the Supabase SQL Editor. Stop on the first error:

1. `supabase/migrations/202609120001_commerce.sql`
2. `supabase/migrations/202609130001_preorder_and_rates.sql`
3. `supabase/migrations/202609130002_scheduled_rates.sql`
4. `supabase/migrations/202609140001_variant_photos_rounding.sql`
5. `supabase/migrations/202609150001_variant_options.sql`

If the earlier commerce migrations are already installed, do not rerun them. Confirm the database is already on the expected migration level before running file 5.

Migration 5 is additive and preserves existing product names, variant names, photo URLs, orders, and order snapshots. It adds:

- `products.option1_label`
- `products.option2_label`
- `product_variants.option1_value`
- `product_variants.option2_value`

It also updates the public `commerce_catalogue()` RPC to return these fields. It does not change checkout function signatures or old order snapshots.

## Padini setup example

For a product such as Padini Sweater:

1. Open the product editor.
2. Set `Pilihan 1` to `Style`.
3. Set `Pilihan 2` to `Ukuran`.
4. Add one row for every sellable combination:

| Style | Ukuran | SKU |
| --- | --- | --- |
| Style 1 | S | `PAD-SW-001-S` |
| Style 1 | M | `PAD-SW-001-M` |
| Style 1 | L | `PAD-SW-001-L` |
| Style 2 | S | `PAD-SW-002-S` |
| Style 2 | M | `PAD-SW-002-M` |
| Style 2 | L | `PAD-SW-002-L` |

Each row owns its price, weight, sale mode, stock or preorder quota, active flag, and photo. A customer first chooses Style and then chooses a Size available for that Style.

The current editor creates combinations manually. It does not generate a Cartesian matrix automatically.

## Photo upload

In each variant row, use the file input to upload a JPG, PNG, or WEBP file. The file is stored under the product path in `product-images`, and its public URL is saved to `product_variants.photo_url`.

A direct HTTP/HTTPS image URL can also be entered. If the variant URL is empty or the image fails, the public catalogue falls back to the product photo.

Check Storage policies and the existing `product-images` bucket before production use. Do not make the private `order-receipts` bucket public.

## Verification after deployment

1. Log in as an owner/editor.
2. Open Trips and set the active Malaysia trip to `Open PO`.
3. Open a published `Ready` product.
4. Set the two option labels and create at least two combinations.
5. Upload different photos for two combinations.
6. Confirm that each editor row shows the matching photo and values after refresh.
7. Open `/` without login.
8. Select option 1 and option 2. Confirm that photo, price, and availability change with the selected combination.
9. Submit a test preorder with a zero-stock unlimited-preorder variant.
10. Confirm the order appears in `/dashboard` and that retrying the same request does not create a duplicate.
11. Confirm an old order still shows its original product name, variant name, and price.
12. Confirm a nonmember cannot access staff data or private receipts.

Useful SQL checks:

```sql
select public.commerce_rate_status('MYR');

select code, status, option1_label, option2_label
from public.products p
join public.trips t on t.code = p.trip_code
where p.option1_label is not null or p.option2_label is not null;

select p.name, v.name, v.option1_value, v.option2_value, v.photo_url
from public.products p
join public.product_variants v on v.product_id = p.id
where p.name ilike '%Padini%'
order by p.name, v.created_at;
```

## Rollback

Do not drop commerce tables or delete order history. Stop new checkout first, preserve and reconcile new orders and payments, then restore schema or policies only through the database administrator and the recorded backup.

The option columns are additive. If the frontend must be rolled back, old frontend code can continue reading the existing `name` field; option columns can remain unused. Do not roll back by deleting variant photos or mutating verified payment records.

## Local validation

```sh
npm ci
npm run typecheck
npm test
npm run build:vercel
```

The local tests use PGlite and do not prove hosted Supabase extension, Storage, HTTP provider, pg_cron, or multi-session PostgreSQL behavior. Perform the live checklist above in staging before production.
