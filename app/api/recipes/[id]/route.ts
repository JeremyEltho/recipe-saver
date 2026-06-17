import { NextResponse } from "next/server";
import { deleteRecipe, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

// DELETE /api/recipes/:id — remove a saved recipe.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing recipe id." }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  try {
    await deleteRecipe(id);
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { configured: true, error: message },
      { status: 500 }
    );
  }
}
