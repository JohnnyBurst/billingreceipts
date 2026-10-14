# Turning on Pro payments (do it in TEST mode first)

1. Stripe dashboard, toggle **Test mode** on. Product catalog > Add product "BillingReceipts Pro":
   one recurring price $9.00 / month and one $79.00 / year. Copy both price IDs (price_...).
2. Supabase SQL Editor: run `supabase/stripe-columns.sql`.
3. Supabase > Edge Functions: create three functions with these names and paste each index.ts:
   `create-checkout`, `billing-portal`, `stripe-webhook` (each file is self-contained; paste the whole file. If the
   editor offers a template, replace its contents).
   Turn **Verify JWT OFF** only for `stripe-webhook`.
4. Supabase > Edge Functions > Secrets, add: STRIPE_SECRET_KEY (sk_test_... or a restricted key),
   STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR, STRIPE_WEBHOOK_SECRET (step 5), SITE_URL=https://billingreceipts.com
5. Stripe > Developers > Webhooks > Add endpoint:
   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
   events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
   Copy its signing secret (whsec_...) into STRIPE_WEBHOOK_SECRET.
6. Stripe > Settings > Billing > Customer portal: turn it on (cancel, payment method, invoices).
7. Test with card 4242 4242 4242 4242, any future date, any CVC. Then repeat with live keys.
