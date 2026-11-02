import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { publicSupabaseConfig } from "../../lib/supabase-config";
import CateringApp from "../catering-app";
export const dynamic="force-dynamic";
export default function Demo(){
  if(publicSupabaseConfig(env as unknown as Record<string,unknown>))redirect("/");
  return <CateringApp preview/>;
}
