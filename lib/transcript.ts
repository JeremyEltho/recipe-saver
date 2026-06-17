import { YoutubeTranscript } from "youtube-transcript";

/**
 * Fetch a YouTube transcript as a single plain-text string.
 *
 * YouTube blocks transcript requests coming from datacenter IPs (e.g. Vercel
 * serverless functions), so on the server we go through Supadata, which runs
 * its own proxy infrastructure. When no Supadata key is configured (typical
 * local dev on a residential IP) we fall back to the free `youtube-transcript`
 * library.
 *
 * Set SUPADATA_API_KEY (https://supadata.ai) to enable production fetching.
 */

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;

export async function fetchTranscript(videoId: string): Promise<string> {
  const raw = SUPADATA_API_KEY
    ? await fetchViaSupadata(videoId)
    : await fetchViaLibrary(videoId);

  const cleaned = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) throw new Error("Empty transcript");
  return cleaned;
}

async function fetchViaSupadata(videoId: string): Promise<string> {
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(
    target
  )}&text=true`;

  const res = await fetch(endpoint, {
    headers: { "x-api-key": SUPADATA_API_KEY as string },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  // With text=true the API returns { content: "...", lang, availableLangs }.
  if (typeof data?.content === "string") return data.content;
  // Defensive: some responses return timed segments.
  if (Array.isArray(data?.content)) {
    return data.content.map((s: { text?: string }) => s.text ?? "").join(" ");
  }
  throw new Error("Supadata returned no transcript content");
}

async function fetchViaLibrary(videoId: string): Promise<string> {
  const snippets = await YoutubeTranscript.fetchTranscript(videoId);
  return snippets.map((s) => s.text).join(" ");
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
