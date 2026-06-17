"use client";

import { useEffect, useMemo, useState } from "react";
import RecipeMarkdown from "@/components/RecipeMarkdown";
import {
  deleteRecipe as removeRecipe,
  loadRecipes,
  saveRecipe,
} from "@/lib/storage";
import type { Recipe } from "@/lib/types";

interface Draft {
  title: string;
  url: string;
  videoId: string;
  markdown: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null); // null = new-recipe page

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load saved recipes once on mount.
  useEffect(() => {
    setMounted(true);
    loadRecipes().then(setRecipes).catch(() => {});
  }, []);

  const activeRecipe = useMemo(
    () => recipes.find((r) => r.id === activeId) ?? null,
    [recipes, activeId]
  );

  async function handleExtract() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube link first.");
      return;
    }
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      setDraft({
        title: data.title,
        url: data.url,
        videoId: data.videoId,
        markdown: data.markdown,
      });
    } catch {
      setError("Network error — couldn't reach the kitchen. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveRecipe(draft);
      const fresh = await loadRecipes();
      setRecipes(fresh);
      setDraft(null);
      setUrl("");
      setActiveId(saved.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await removeRecipe(id);
    const fresh = await loadRecipes();
    setRecipes(fresh);
    setActiveId(null);
  }

  function handleCopy(markdown: string) {
    navigator.clipboard?.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function goNew() {
    setActiveId(null);
    setError(null);
  }

  return (
    <div className="desk">
      <header className="masthead">
        <h1>The Recipe Notebook</h1>
        <p>Pulled clean from the chatter of YouTube</p>
      </header>

      <div className="book">
        <div className="spine" aria-hidden>
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
        </div>

        <div className="page">
          {/* binder tabs */}
          <nav className="tabs" aria-label="Saved recipes">
            <button
              className={`tab new-tab ${activeId === null ? "active" : ""}`}
              onClick={goNew}
            >
              + New Recipe
            </button>
            {mounted &&
              recipes.map((r) => (
                <button
                  key={r.id}
                  className={`tab ${activeId === r.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveId(r.id);
                    setError(null);
                  }}
                  title={r.title}
                >
                  {r.title}
                </button>
              ))}
          </nav>

          {/* the active sheet */}
          <div className="sheet" key={activeId ?? "new"}>
            <div className="page-enter">
              {activeId === null ? (
                <NewRecipePage
                  url={url}
                  setUrl={setUrl}
                  loading={loading}
                  error={error}
                  draft={draft}
                  saving={saving}
                  onExtract={handleExtract}
                  onSave={handleSave}
                  onDiscard={() => setDraft(null)}
                  onCopy={handleCopy}
                  copied={copied}
                />
              ) : activeRecipe ? (
                <SavedRecipePage
                  recipe={activeRecipe}
                  onDelete={() => handleDelete(activeRecipe.id)}
                  onCopy={handleCopy}
                  copied={copied}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <p className="colophon">
        {mounted && recipes.length > 0
          ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} in the book`
          : "A little kitchen journal"}
      </p>
    </div>
  );
}

/* ---------- New recipe capture page ---------- */

function NewRecipePage({
  url,
  setUrl,
  loading,
  error,
  draft,
  saving,
  onExtract,
  onSave,
  onDiscard,
  onCopy,
  copied,
}: {
  url: string;
  setUrl: (v: string) => void;
  loading: boolean;
  error: string | null;
  draft: Draft | null;
  saving: boolean;
  onExtract: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onCopy: (md: string) => void;
  copied: boolean;
}) {
  return (
    <div className="ink-in">
      <p className="kicker">New entry</p>
      <h2 className="page-title">What did you watch?</h2>

      <div className="capture">
        <label htmlFor="yt-url">YouTube link</label>
        <div className="url-row">
          <input
            id="yt-url"
            className="url-field"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) onExtract();
            }}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={onExtract}
            disabled={loading}
          >
            {loading ? "Simmering…" : "Extract Recipe"}
          </button>
        </div>
      </div>

      {loading && (
        <p className="simmer" style={{ marginTop: "1.2rem" }}>
          <span className="pot">🍲</span>
          <span className="steam">♨</span>
          Reading the transcript and writing it up…
        </p>
      )}

      {error && <div className="note note-error">{error}</div>}

      {draft && !loading && (
        <div style={{ marginTop: "1.8rem" }}>
          <div className="recipe-head">
            <span className="recipe-meta">Fresh from the video — not saved yet</span>
            <div className="recipe-actions">
              <button className="btn btn-save" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save to notebook"}
              </button>
              <button className="btn btn-ghost" onClick={() => onCopy(draft.markdown)}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button className="btn btn-ghost" onClick={onDiscard}>
                Discard
              </button>
            </div>
          </div>
          <RecipeMarkdown markdown={draft.markdown} />
        </div>
      )}

      {!draft && !loading && !error && (
        <p className="empty-hint">
          Paste a cooking video above and I&apos;ll copy the recipe into the book ✎
        </p>
      )}
    </div>
  );
}

/* ---------- Saved recipe page ---------- */

function SavedRecipePage({
  recipe,
  onDelete,
  onCopy,
  copied,
}: {
  recipe: Recipe;
  onDelete: () => void;
  onCopy: (md: string) => void;
  copied: boolean;
}) {
  const saved = new Date(recipe.createdAt);
  const when = saved.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="ink-in">
      <div className="recipe-head">
        <span className="recipe-meta">
          <span className="stamp">Saved</span> &nbsp;·&nbsp; {when}
        </span>
        <div className="recipe-actions">
          <a
            className="btn btn-ghost"
            href={recipe.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            ▶ Watch
          </a>
          <button className="btn btn-ghost" onClick={() => onCopy(recipe.markdown)}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`Tear "${recipe.title}" out of the notebook?`)) onDelete();
            }}
          >
            Tear out
          </button>
        </div>
      </div>
      <RecipeMarkdown markdown={recipe.markdown} />
    </div>
  );
}
