import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { YoutubeTranscript } from "youtube-transcript";
import { extractVideoId } from "@/lib/extractVideoId";
import {
  SYSTEM_PROMPT,
  buildUserContent,
  parseTitle,
} from "@/lib/systemPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Please provide a YouTube URL." },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "That doesn't look like a valid YouTube link." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY. Add it to your environment." },
      { status: 500 }
    );
  }

  // 1. Fetch the transcript -------------------------------------------------
  let transcript: string;
  try {
    const snippets = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = snippets
      .map((s) => decodeEntities(s.text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't find a transcript for that video. It may have captions disabled.",
      },
      { status: 404 }
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "The transcript for that video was empty." },
      { status: 404 }
    );
  }

  // 2. Ask Gemini to extract the recipe ------------------------------------
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
    return NextResponse.json(
      { error: `Gemini request failed: ${message}` },
      { status: 502 }
    );
  }

  if (!markdown) {
    return NextResponse.json(
      { error: "Gemini returned an empty recipe. Try again." },
      { status: 502 }
    );
  }

  // Strip stray code fences the model sometimes wraps markdown in.
  markdown = markdown.replace(/^```(?:markdown)?\s*/i, "").replace(/```$/i, "").trim();

  return NextResponse.json({
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: parseTitle(markdown),
    markdown,
  });
}

/** Minimal HTML entity decode for transcript text (&amp;#39; etc.). */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
