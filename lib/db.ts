import { sql } from "@vercel/postgres";
import { randomUUID } from "crypto";
import type { NewRecipe, Recipe } from "./types";

/**
 * Server-side recipe storage backed by Vercel Postgres.
 *
 * Persistence is optional: when no Postgres connection string is present
 * (e.g. local dev or a fresh deploy without a database attached) every
 * function reports "not configured" and the client transparently falls
 * back to browser localStorage. Attach a Postgres store in the Vercel
 * dashboard and these functions light up automatically — no code change.
 */

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL
  );
}

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      url         TEXT NOT NULL,
      video_id    TEXT NOT NULL,
      markdown    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  initialized = true;
}

export async function listRecipes(): Promise<Recipe[]> {
  await ensureTable();
  const { rows } = await sql`
    SELECT id, title, url, video_id, markdown, created_at
    FROM recipes
    ORDER BY created_at DESC;
  `;
  return rows.map(toRecipe);
}

export async function createRecipe(input: NewRecipe): Promise<Recipe> {
  await ensureTable();
  const id = randomUUID();
  const { rows } = await sql`
    INSERT INTO recipes (id, title, url, video_id, markdown)
    VALUES (${id}, ${input.title}, ${input.url}, ${input.videoId}, ${input.markdown})
    RETURNING id, title, url, video_id, markdown, created_at;
  `;
  return toRecipe(rows[0]);
}

export async function deleteRecipe(id: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM recipes WHERE id = ${id};`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecipe(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    videoId: row.video_id,
    markdown: row.markdown,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}
