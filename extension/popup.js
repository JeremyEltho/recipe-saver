// Recipe Notebook extension popup.
// Flow: read the transcript from the YouTube page (in the page's own context,
// i.e. the user's residential IP — so YouTube doesn't block it), then POST the
// text to the Recipe Notebook backend for Gemini extraction + saving.

const DEFAULT_API_BASE = "https://recipe-notebook-lovat.vercel.app";

const els = {
  go: document.getElementById("go"),
  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
  error: document.getElementById("error"),
  result: document.getElementById("result"),
  recipe: document.getElementById("recipe"),
  savedBadge: document.getElementById("saved-badge"),
  copy: document.getElementById("copy"),
  settingsToggle: document.getElementById("settings-toggle"),
  settings: document.getElementById("settings"),
  apiBase: document.getElementById("api-base"),
  saveSettings: document.getElementById("save-settings"),
};

/**
 * Runs in the PAGE's MAIN world (not the isolated content-script world), so it
 * can read window.ytInitialPlayerResponse and fetch the caption track using the
 * page's origin and the user's IP. Must be fully self-contained.
 */
async function pullTranscriptFromPage() {
  try {
    const pr = window.ytInitialPlayerResponse;
    const tracks =
      pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || !tracks.length) {
      return { error: "No captions/transcript found on this video." };
    }
    const track =
      tracks.find((t) => (t.languageCode || "").startsWith("en")) || tracks[0];

    const res = await fetch(track.baseUrl + "&fmt=json3");
    if (!res.ok) return { error: "Failed to fetch the transcript track." };
    const data = await res.json();

    const transcript = (data.events || [])
      .filter((e) => e.segs)
      .map((e) => e.segs.map((s) => s.utf8 || "").join(""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!transcript) return { error: "The transcript was empty." };
    return {
      transcript,
      title: pr?.videoDetails?.title || document.title,
      url: location.href,
    };
  } catch (e) {
    return { error: "Could not read the transcript: " + (e?.message || e) };
  }
}

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return (apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setStatus(msg) {
  if (!msg) { hide(els.status); return; }
  els.status.textContent = msg;
  show(els.status);
}

function setError(msg) {
  els.error.textContent = msg;
  show(els.error);
}

function reset() {
  hide(els.error);
  hide(els.result);
  hide(els.savedBadge);
  setStatus("");
}

els.go.addEventListener("click", async () => {
  reset();
  els.go.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.url || !/youtube\.com\/watch/.test(tab.url)) {
      setError("Open a YouTube video page (youtube.com/watch) first.");
      return;
    }

    setStatus("Reading the transcript from the page…");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: pullTranscriptFromPage,
    });

    if (!result || result.error) {
      setError(result?.error || "Couldn't read the transcript.");
      return;
    }

    setStatus("Extracting the recipe with Gemini…");
    const base = await getApiBase();
    const res = await fetch(base + "/api/recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: result.url,
        transcript: result.transcript,
        save: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Extraction failed.");
      return;
    }

    setStatus("");
    els.recipe.textContent = data.markdown;
    if (data.saved) show(els.savedBadge);
    show(els.result);
  } catch (e) {
    setError("Something went wrong: " + (e?.message || e));
  } finally {
    els.go.disabled = false;
  }
});

els.copy.addEventListener("click", () => {
  navigator.clipboard.writeText(els.recipe.textContent || "").then(() => {
    els.copy.textContent = "Copied!";
    setTimeout(() => (els.copy.textContent = "Copy"), 1400);
  });
});

// --- settings (backend URL override) ---------------------------------------
els.settingsToggle.addEventListener("click", () => {
  els.settings.classList.toggle("hidden");
});
els.saveSettings.addEventListener("click", async () => {
  const v = els.apiBase.value.trim();
  await chrome.storage.local.set({ apiBase: v || DEFAULT_API_BASE });
  els.saveSettings.textContent = "Saved";
  setTimeout(() => (els.saveSettings.textContent = "Save"), 1200);
});

(async () => {
  els.apiBase.value = await getApiBase();
})();
