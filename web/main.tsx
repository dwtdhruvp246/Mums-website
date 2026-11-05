import { createRoot } from "react-dom/client";
import AuthWorkspace from "../app/auth-workspace";
import PwaInstall from "../app/pwa-install";
import type { PublicSupabaseConfig } from "../lib/supabase-config";
import "../app/globals.css";
import "../app/layout-refinements.css";
import "../app/auth.css";
import "../app/menu-import.css";
import "../app/pwa.css";

declare const __CATERING_SUPABASE_CONFIG__:PublicSupabaseConfig;
const config=__CATERING_SUPABASE_CONFIG__;
const root=document.getElementById("root");
if(!root)throw new Error("The app entry point is missing.");
createRoot(root).render(<><PwaInstall /><AuthWorkspace publicConfig={config}/></>);
