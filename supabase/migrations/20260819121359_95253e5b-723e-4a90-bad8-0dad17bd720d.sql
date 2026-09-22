CREATE UNIQUE INDEX IF NOT EXISTS customers_business_tg_user_idx ON public.customers (business_id, telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_business_chat_idx ON public.conversations (business_id, telegram_chat_id);
CREATE INDEX IF NOT EXISTS conversations_customer_idx ON public.conversations (business_id, customer_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_business_customer_status_idx ON public.leads (business_id, customer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_business_active_idx ON public.products (business_id, is_active, is_archived);
CREATE INDEX IF NOT EXISTS telegram_bots_business_active_idx ON public.telegram_bots (business_id, is_active);
CREATE INDEX IF NOT EXISTS orders_business_created_idx ON public.orders (business_id, created_at DESC);