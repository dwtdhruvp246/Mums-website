// Retired endpoint: signed-in records use the Supabase client with per-user RLS.
// Keeping this closed prevents access to historical sample database bindings.
export const dynamic="force-dynamic";
function previewOnly(){return Response.json({error:"Open your workspace through the sign-in page."},{status:410,headers:{"Cache-Control":"no-store"}});}
export async function GET(){return previewOnly();}
export async function POST(){return previewOnly();}
