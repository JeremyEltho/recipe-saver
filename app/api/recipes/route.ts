import { NextResponse } from "next/server";
import { createRecipe, isDbConfigured, listRecipes } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/recipes — list all saved recipes (newest first).
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, recipes: [] });
  }
  try {
    const recipes = await listRecipes();
    return NextResponse.json({ configured: true, recipes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { configured: true, recipes: [], error: message },
      { status: 500 }
    );
  }
}

// POST /api/recipes — persist a recipe.
export async function POST(req: Request) {
  let body: { title?: string; url?: string; videoId?: string; markdown?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { title, url, videoId, markdown } = body;
  if (!title || !url || !videoId || !markdown) {
    return NextResponse.json(
      { error: "Missing recipe fields." },
      { status: 400 }
    );
  }

  if (!isDbConfigured()) {
    // No server database — client keeps it in localStorage.
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  try {
    const recipe = await createRecipe({ title, url, videoId, markdown });
    return NextResponse.json({ configured: true, recipe }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { configured: true, error: message },
      { status: 500 }
    );
  }
}
