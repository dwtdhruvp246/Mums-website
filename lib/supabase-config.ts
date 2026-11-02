export type PublicSupabaseConfig={url:string;publishableKey:string};

/** Only browser-safe credentials may be returned by the public config endpoint. */
export function publicSupabaseConfig(values:Record<string,unknown>):PublicSupabaseConfig|null{
  const rawUrl=String(values.SUPABASE_URL??"").trim();
  const key=String(values.SUPABASE_PUBLISHABLE_KEY??values.SUPABASE_ANON_KEY??"").trim();
  if(!rawUrl||!key)return null;
  let url:URL;
  try{url=new URL(rawUrl);}catch{return null;}
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return null;
  if(key.startsWith("sb_secret_")||key.length>8192)return null;
  if(!key.startsWith("sb_publishable_")){
    try{const segment=key.split(".")[1];if(!segment)return null;const padded=segment.replaceAll("-","+").replaceAll("_","/");const payload=JSON.parse(atob(padded.padEnd(Math.ceil(padded.length/4)*4,"=")));if(payload.role!=="anon")return null;}catch{return null;}
  }
  return {url:url.origin,publishableKey:key};
}
