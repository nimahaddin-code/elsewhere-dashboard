# Fresh Supabase project setup

Use only on an empty project. Existing projects keep their current core schema and policies.

1. Run `00_core.sql`.
2. Import the source trips/products/variants/categories using their original IDs. Keep the export private and outside Git. Cross-project `created_by` and `approved_by` references must be mapped to real destination users or set to null; do not import auth password records.
3. Run `../migrations/202609120001_commerce.sql` and `../migrations/202609130001_preorder_and_rates.sql`.
4. Run `01_access.sql`, then `../migrations/202609130002_scheduled_rates.sql`.
5. Provision only the intended application owner in workspace_members through the administrator workflow. The owner still needs a Supabase Auth account in this project.
6. Upload copied images into product-images, verify hashes and update product photo_url to the destination URL. Keep external URLs until their copies are verified.
7. Verify row counts, unpublished-product privacy, owner edits, automatic FX and checkout before changing app environment settings.

Prefer combining setup in a single transaction, excluding inner BEGIN/COMMIT markers, so any failure rolls everything back. The core schema was captured from the Elsewhere source project on 2026-09-13. Core creation intentionally fails if tables already exist, preventing accidental merges or overwrites. Rollback before cutover is to retain the old app configuration; do not delete the old project.

The bootstrap copies schema, not existing staff membership, financial history or login accounts. Those require a separate explicitly scoped migration if needed. Product statuses remain unchanged, and blank photo fields stay blank.
