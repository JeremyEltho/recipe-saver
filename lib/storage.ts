import type { NewRecipe, Recipe } from "./types";

/**
 * Client-side recipe persistence.
 *
 * localStorage is the always-available source of truth so the notebook
 * works instantly with zero backend setup. When a server database is
 * configured (Vercel Postgres), we mirror writes to it and prefer its
 * copy on load so recipes follow you across devices.
 */

const KEY = "recipe-saver:recipes";

export function loadLocal(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(recipes: Recipe[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(recipes));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Load recipes for display: start from localStorage, then ask the server.
 * If the server has a database, its list wins and the local cache is
 * refreshed to match.
 */
export async function loadRecipes(): Promise<Recipe[]> {
  const local = loadLocal();
  try {
    const res = await fetch("/api/recipes", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.configured && Array.isArray(data.recipes)) {
        saveLocal(data.recipes);
        return data.recipes;
      }
    }
  } catch {
    /* offline or no server — fall back to local cache */
  }
  return local;
}

/** Save a new recipe locally (immediately) and to the server (best effort). */
export async function saveRecipe(input: NewRecipe): Promise<Recipe> {
  const recipe: Recipe = {
    ...input,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };

  const next = [recipe, ...loadLocal().filter((r) => r.videoId !== recipe.videoId)];
  saveLocal(next);

  try {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.configured && data.recipe) {
        // adopt the server's id so future deletes line up
        const reconciled = [
          data.recipe,
          ...loadLocal().filter((r) => r.id !== recipe.id),
        ];
        saveLocal(reconciled);
        return data.recipe;
      }
    }
  } catch {
    /* keep the local copy */
  }
  return recipe;
}

/** Delete locally and on the server. */
export async function deleteRecipe(id: string): Promise<void> {
  saveLocal(loadLocal().filter((r) => r.id !== id));
  try {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  } catch {
    /* local delete already applied */
  }
}
