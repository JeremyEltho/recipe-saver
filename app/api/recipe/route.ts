import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractVideoId } from "@/lib/extractVideoId";
import { fetchTranscript } from "@/lib/transcript";
import { createRecipe, isDbConfigured } from "@/lib/db";
import {
  SYSTEM_PROMPT,
  buildUserContent,
  parseTitle,
} from "@/lib/systemPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// Allow the browser extension (and the web app) to call this cross-origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: { url?: string; transcript?: string; save?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { url, save } = body;
  // A transcript supplied by the extension (pulled from the page DOM on the
  // user's residential IP) bypasses server-side fetching entirely.
  const providedTranscript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!url || typeof url !== "string") {
    return json({ error: "Please provide a YouTube URL." }, 400);
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return json({ error: "That doesn't look like a valid YouTube link." }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(
      { error: "Server is missing GEMINI_API_KEY. Add it to your environment." },
      500
    );
  }

  // 1. Get the transcript: use the one the extension supplied, otherwise fetch.
  let transcript: string;
  if (providedTranscript) {
    transcript = providedTranscript;
  } else {
    try {
      transcript = await fetchTranscript(videoId);
    } catch {
      return json(
        {
          error:
            "Couldn't get a transcript for that video. It may have captions disabled, or the transcript service is unavailable. Tip: use the browser extension to pull it from the page instead.",
        },
        404
      );
    }
  }

  // 2. Ask Gemini to extract the recipe.
  let markdown: string;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(buildUserContent(transcript));
    markdown = result.response.text().trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: `Gemini request failed: ${message}` }, 502);
  }

  if (!markdown) {
    return json({ error: "Gemini returned an empty recipe. Try again." }, 502);
  }

  // Strip stray code fences and leftover prompt placeholders.
  markdown = markdown.replace(/^```(?:markdown)?\s*/i, "").replace(/```$/i, "").trim();
  markdown = cleanRecipeMarkdown(markdown);

  const title = parseTitle(markdown);
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 3. Optionally persist to Supabase (when the extension asks and a DB exists).
  let saved = false;
  if (save && isDbConfigured()) {
    try {
      await createRecipe({ title, url: canonicalUrl, videoId, markdown });
      saved = true;
    } catch {
      // Non-fatal: still return the recipe so the caller can show/keep it.
      saved = false;
    }
  }

  return json({ videoId, url: canonicalUrl, title, markdown, saved });
}

/**
 * Tidy up the model output. The prompt's format example uses square-bracket
 * placeholders (e.g. "[Quantity] [Measurement] [Ingredient]"), which the
 * model sometimes echoes literally or wraps real values in. Strip the
 * leftover example lines and unwrap bracketed tokens — without touching
 * markdown links like [text](url).
 */
function cleanRecipeMarkdown(markdown: string): string {
  const placeholderLine =
    /^\s*[-*]?\s*\[?\s*(Quantity|Action Verb)\b.*$/i;

  const lines = markdown
    .split("\n")
    .filter((line) => !placeholderLine.test(line));

  return lines
    .join("\n")
    // unwrap [token] -> token, but preserve [label](link)
    .replace(/\[([^\]]+)\](?!\()/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
