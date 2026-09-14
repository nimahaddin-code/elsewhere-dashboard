# Elsewhere Dashboard

Elsewhere & Co. international jastip catalogue and operations dashboard.

The public catalogue is at `/`; staff sign in at `/dashboard`. A customer selects one product variant, submits contact/shipping information and receives an order reference. Staff manage that order, manually record and verify payments, and progress shipping with a courier and tracking number.

## Local development

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
cp .env.example .env.local
# Fill the public Supabase URL and publishable key.
npm run dev:vercel
```

`npm run build:vercel` is the build used by the existing Vercel configuration. The original `npm run dev` / `npm run build` Cloudflare/Vinext workflow remains available.

```sh
npm run typecheck
npm test
npm run build:vercel
```

## Activate the database integration

Apply the migrations in filename order during the same maintenance window as the matching frontend deployment. See [DEPLOY.md](DEPLOY.md) for the handoff, backup requirements and verification. Hosted migrations have not been applied by this change.

Existing members retain their access. Only owner/editor roles may mutate commerce records; signup alone does not grant membership. Configure the three public environment variables from `.env.example`, and allow the deployed `/dashboard` URL in Supabase Auth redirect URLs.

Select **Malaysia trip**, set the trip to **Open PO**, and publish Ready products with active variants, valid price and weight. Existing trip statuses and product publication decisions are preserved. All existing variants are converted to unlimited preorder; new variants default to unlimited preorder. Both Malaysia cargo rates are Rp90,000/kg.

The private `order-receipts` bucket limits uploads to 5 MB JPG/PNG/WEBP/PDF. Product photo uploads continue using the existing `product-images` bucket. Check that existing buckets and policies match this setup. Security-definer RPCs have a fixed search path and explicit execute grants; see the [Supabase function guidance](https://supabase.com/docs/guides/database/functions) and [Storage access-control documentation](https://supabase.com/docs/guides/storage/security/access-control).

## Pricing and inventory rules

- Catalogue and checkout use the same database price function, rounding selling prices up to the next Rp1,000; dashboard calculations mirror it and are tested for parity. Product custom margin overrides the default (20% food/drinks; 25% otherwise). Fashion aliases include `Pakaian`, `Tas`, and `Sepatu`. Currency and both cargo rates come from the product's current trip.
- The customer's submitted price is checked, never trusted. An order stores immutable product names, quantity, unit price, and pricing inputs. Future product/FX edits cannot rewrite that order's price.
- Active variants from published Ready products in Open PO trips appear publicly. No cost price, margin, customer data or private trip finance is returned by the public catalogue RPC.
- Unlimited preorder uses a null capacity and never sells out from stock counts. For optionally capped variants, stock/capacity means the total sellable allocation for the trip, **including units already ordered**. All noncancelled orders consume it, including completed orders. Do not enter “remaining stock” as the total allocation. Database row locks prevent simultaneous submissions overselling the allocation.
- One order contains one variant with 1–20 units. Repeating a request token returns the original order without another reservation. Keep the form open and use retry after a network error.
- New orders expire after 48 hours if still new and without any payment records (hourly cleanup). Confirmed orders and orders with pending/verified payments are preserved.
- Checkout permits three new orders per phone per 15 minutes, ten per day and 60 globally per minute. Retries of the same request do not consume another order. This is basic database throttling, not a CAPTCHA or protection against distributed abuse.
- Supabase checks ExchangeRate-API hourly; the free provider updates daily. Catalogue prices follow fresh rates automatically, while saved orders retain their original price. Missing or over-48-hour-old rates block checkout. Clients cannot set the rate.

## Payments and fulfillment

Payment recording and verification are distinct. Only verified payments contribute to cash collected. Pending records also count against the maximum recordable balance, preventing duplicate DP/pelunasan entries; erroneous unverified records can be removed. Verified records cannot be silently deleted or edited.

Status flow: `new → confirmed → purchased → arrived → packed → shipped → completed`. Shipping requires full verified payment and courier/tracking details. Cancellation is allowed only from new/confirmed with no payment records. Refunds and paid-order cancellation require a future explicit refund workflow; do not mutate verified ledger records manually through the app.

Domestic shipping fees are confirmed separately and are **not** included in the goods invoice, payment totals or dashboard revenue in this release. There is no payment gateway or courier API. WhatsApp links open a draft for the user/staff to send; the app does not send messages automatically. Without a configured business number, customer order creation still works and staff can initiate confirmation from Orders.

Core overview metrics now derive from orders/payments for the selected trip. Existing marketing/demo panels remain marked as examples; they are not customer analytics. The public catalogue refreshes every 30 seconds/on window focus using its safe RPC. Staff order lists refresh every 15 seconds and after mutations. No new Realtime publication configuration is required.

## Validation and rollback

`npm test` runs the actual migration and RPCs in an isolated PostgreSQL-compatible PGlite database with synthetic Supabase auth/storage scaffolding. It checks visibility, RLS, price parity and snapshots, capacity/retries, payment verification, cancellation and shipping gates. This does not prove compatibility with an uninspected hosted schema or test true concurrent PostgreSQL sessions. Perform the staging walkthrough above before production.

For rollback, stop new submissions and preserve/export any orders and payment records. Redeploying the old frontend alone will not work with the new anonymous access restrictions. Restore the recorded pre-migration policies/schema through the database administrator after reconciling transactions; do not drop commerce tables containing real orders. The pre-migration `collected_fund` and `confirmed_orders` fields are preserved but no longer used as live transaction totals.
