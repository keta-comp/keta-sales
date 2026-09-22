DROP TABLE IF EXISTS public.telegram_bots;
DROP FUNCTION IF EXISTS public.get_my_telegram_bot();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.sync_customer_totals() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.apply_order_stock(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.revert_order_stock(uuid, uuid) FROM authenticated, anon;