import { env } from "cloudflare:workers";
import { publicSupabaseConfig } from "../../../../lib/supabase-config";

export const dynamic="force-dynamic";
export async function GET(){
  const config=publicSupabaseConfig(env as unknown as Record<string,unknown>);
  return Response.json({config},{headers:{"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"}});
}
