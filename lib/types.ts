export interface Recipe {
  id: string;
  /** Inferred recipe title (also parsed from the markdown H1). */
  title: string;
  /** Original YouTube URL the recipe was extracted from. */
  url: string;
  /** YouTube video id. */
  videoId: string;
  /** Full recipe body in Markdown. */
  markdown: string;
  /** ISO timestamp of when it was saved. */
  createdAt: string;
}

export type NewRecipe = Omit<Recipe, "id" | "createdAt">;
