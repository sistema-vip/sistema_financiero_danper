// app/config.ts
export const SUPABASE_URL = "https://zckwtqbmuclowncghusm.supabase.co";
export const SUPABASE_KEY = "sb_publishable_vqV4d4Ljgz3O1-1LRS0u2A_SQERJiAY";

export const SUPABASE_HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation" // Esto le dice a Supabase que nos devuelva el dato recién guardado
};