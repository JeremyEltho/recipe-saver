import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NewRecipe, Recipe } from "./types";

/**
 * Server-side recipe storage backed by Supabase (Postgres + PostgREST).
 *
 * Persistence is optional: when the Supabase env vars are absent (e.g.
 * local dev before you've added keys) every function reports "not
 * configured" and the client transparently falls back to browser
 * localStorage. Set the env vars and these light up — no code change.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL      e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     server-only key (bypasses RLS)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const TABLE = "recipes";

export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select("id, title, url, video_id, markdown, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRecipe);
}

export async function createRecipe(input: NewRecipe): Promise<Recipe> {
  const { data, error } = await getClient()
    .from(TABLE)
    .insert({
      title: input.title,
      url: input.url,
      video_id: input.videoId,
      markdown: input.markdown,
    })
    .select("id, title, url, video_id, markdown, created_at")
    .single();
  if (error) throw new Error(error.message);
  return toRecipe(data);
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await getClient().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecipe(row: any): Recipe {
  return {
    id: String(row.id),
    title: row.title,
    url: row.url,
    videoId: row.video_id,
    markdown: row.markdown,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
