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

const SUPADATA_BASE = "https://api.supadata.ai/v1";

async function fetchViaSupadata(videoId: string): Promise<string> {
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `${SUPADATA_BASE}/transcript?url=${encodeURIComponent(
    target
  )}&text=true`;
  const headers = { "x-api-key": SUPADATA_API_KEY as string };

  const res = await fetch(endpoint, { headers });

  // Large videos are processed asynchronously: 202 + { jobId }.
  if (res.status === 202) {
    const { jobId } = await res.json();
    if (!jobId) throw new Error("Supadata queued a job without an id");
    return pollSupadataJob(jobId, headers);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata ${res.status}: ${body.slice(0, 200)}`);
  }

  return extractSupadataContent(await res.json());
}

async function pollSupadataJob(
  jobId: string,
  headers: Record<string, string>
): Promise<string> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    const res = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Supadata job ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const status = String(data?.status ?? "").toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error("Supadata transcript job failed");
    }
    if (data?.content || status === "completed" || status === "done") {
      return extractSupadataContent(data);
    }
    // otherwise still queued/active — keep polling
  }
  throw new Error("Supadata transcript timed out");
}

function extractSupadataContent(data: unknown): string {
  const d = data as { content?: unknown };
  if (typeof d?.content === "string") return d.content;
  if (Array.isArray(d?.content)) {
    return (d.content as { text?: string }[]).map((s) => s.text ?? "").join(" ");
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
