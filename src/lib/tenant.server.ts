import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Resolves the business the signed-in user belongs to. Throws when the account has no workspace. */
export async function requireBusinessId(supabase: Client): Promise<string> {
  const { data, error } = await supabase.rpc("current_business_id");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No business workspace found for this account.");
  return data as string;
}
