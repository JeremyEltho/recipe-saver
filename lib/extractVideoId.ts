/**
 * Extract a YouTube video id from any common URL shape:
 *   https://www.youtube.com/watch?v=VIDEOID
 *   https://youtu.be/VIDEOID
 *   https://www.youtube.com/embed/VIDEOID
 *   https://www.youtube.com/shorts/VIDEOID
 *   https://m.youtube.com/watch?v=VIDEOID
 * Also accepts a bare 11-character video id.
 * Returns null when no id can be found.
 */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Bare video id (YouTube ids are 11 chars: A-Z a-z 0-9 _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return isValidId(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=ID
    const v = url.searchParams.get("v");
    if (v && isValidId(v)) return v;

    // /embed/ID, /shorts/ID, /v/ID, /live/ID
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["embed", "shorts", "v", "live"].includes(parts[0])) {
      return isValidId(parts[1]) ? parts[1] : null;
    }
  }

  return null;
}

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}
