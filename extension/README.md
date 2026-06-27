# Recipe Notebook — Browser Extension

Pull the transcript from the YouTube video you're watching and turn it into a
clean recipe, saved to your Recipe Notebook.

## Why an extension?

YouTube blocks transcript requests coming from datacenter IPs (like Vercel's
servers), so server-side fetching is unreliable. This extension reads the
transcript **in your browser** — on your own residential IP, where YouTube
serves it normally — then sends just the text to the backend for Gemini
extraction and saving. No proxy, no paid transcript API.

## How it works

1. On a `youtube.com/watch` page, the popup injects a tiny function into the
   page's context to read `ytInitialPlayerResponse` and fetch the caption track.
2. The transcript text is POSTed to `POST /api/recipe` with `{ url, transcript, save: true }`.
3. The backend runs Gemini, returns the Markdown recipe, and (when a Supabase
   database is configured) saves it.

## Load it (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and select this `extension/` folder
4. Open a YouTube cooking video, click the extension icon, and hit
   **Pull recipe from this video**

## Settings

Click the ⚙ icon in the popup to point the extension at a different backend
URL (defaults to the production deployment). Useful for local testing against
`http://localhost:3000`.

## Notes

- Works on videos that have captions (manual or auto-generated).
- The recipe is saved server-side only when the backend has a Supabase database
  attached; otherwise the popup still shows the extracted recipe to copy.
