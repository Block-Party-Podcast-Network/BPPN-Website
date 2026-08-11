const LOOKUP_URL = "https://itunes.apple.com/lookup?id=";
const USER_AGENT = "BlockPartyPodcastNetwork-EpisodeFetcher/1.0 (+https://blockpartypodcastnetwork.com)";

/**
 * Resolves the RSS feed URL for a show.
 *
 * A show can declare either:
 *   - `feedUrl`: use it directly, no lookup needed.
 *   - `appleId` (+ `fallbackFeedUrl`): resolve the live feed via Apple's iTunes
 *     Lookup API so a show that migrates hosts is picked up automatically.
 *     If the lookup fails or returns no feed, fall back to the pinned URL.
 *
 * Returns { feedUrl, source } where source is one of
 * "config" | "itunes-lookup" | "fallback", useful for logging.
 */
export async function resolveFeedUrl(show) {
  if (show.feedUrl) {
    return { feedUrl: show.feedUrl, source: "config" };
  }

  if (!show.appleId) {
    throw new Error(`Show "${show.slug}" has neither feedUrl nor appleId configured`);
  }

  try {
    const res = await fetch(`${LOOKUP_URL}${encodeURIComponent(show.appleId)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`iTunes lookup returned HTTP ${res.status}`);
    const data = await res.json();
    const feedUrl = data?.results?.[0]?.feedUrl;
    if (feedUrl) return { feedUrl, source: "itunes-lookup" };
    throw new Error("iTunes lookup returned no feedUrl");
  } catch (err) {
    if (show.fallbackFeedUrl) {
      console.warn(
        `  [${show.slug}] iTunes lookup failed (${err.message}), using pinned fallbackFeedUrl`
      );
      return { feedUrl: show.fallbackFeedUrl, source: "fallback" };
    }
    throw err;
  }
}

export { USER_AGENT };
