import { createHash } from "node:crypto";

const MAX_EPISODES_PER_SHOW = 10;
const DESCRIPTION_MAX_CHARS = 280;

/** itunes:duration shows up as raw seconds ("2172") on some hosts and as
 * "HH:MM:SS" / "MM:SS" strings on others. Normalize once here so the
 * frontend never has to guess a feed's format. */
export function parseDurationToSeconds(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Feed descriptions are frequently CDATA-wrapped HTML (links, <p>, <br>).
 * Strip tags and collapse whitespace for the plain-text card summary -
 * the raw HTML is never sent to the browser, so there's nothing for the
 * frontend to accidentally render unsafely. */
export function htmlToPlainText(html, maxChars = DESCRIPTION_MAX_CHARS) {
  if (!html) return "";
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + "…";
}

/** Defensive unwrap for fields that fast-xml-parser can hand back as
 * {"#text": ...} (when the tag carries attributes, e.g. <guid isPermaLink>)
 * instead of a plain string. Anything else is coerced to a string. */
function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object" && "#text" in value) return textOf(value["#text"]);
  return "";
}

function stableEpisodeId(item) {
  const guid = textOf(item.guid);
  if (guid) return guid;
  const enclosureUrl = item.enclosure?.["@_url"];
  return createHash("sha1").update(enclosureUrl || textOf(item.title)).digest("hex").slice(0, 16);
}

function toIsoDate(pubDate) {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildEpisode(item) {
  const enclosure = item.enclosure ?? {};
  return {
    id: stableEpisodeId(item),
    title: htmlToPlainText(textOf(item.title), 200) || "Untitled episode",
    pubDate: toIsoDate(textOf(item.pubDate)),
    durationSeconds: parseDurationToSeconds(textOf(item["itunes:duration"])),
    audioUrl: enclosure["@_url"] ?? null,
    audioType: enclosure["@_type"] ?? "audio/mpeg",
    description: htmlToPlainText(textOf(item["content:encoded"] ?? item.description)),
  };
}

/**
 * Combines a show's editorial config with its freshly parsed feed into the
 * shape data/episodes.json stores. Episodes without a playable enclosure are
 * dropped (a feed entry with no audio isn't useful to a native player),
 * then sorted newest-first and capped at MAX_EPISODES_PER_SHOW.
 */
export function buildShowEntry(show, { channel, items }, resolvedFeedUrl, now) {
  const episodes = items
    .map(buildEpisode)
    .filter((ep) => ep.audioUrl)
    .sort((a, b) => new Date(b.pubDate ?? 0) - new Date(a.pubDate ?? 0))
    .slice(0, MAX_EPISODES_PER_SHOW);

  return {
    slug: show.slug,
    name: show.name,
    tagline: show.tagline,
    logo: show.logo,
    platformLinks: show.platformLinks ?? {},
    resolvedFeedUrl,
    lastFetchedAt: now,
    lastFetchOk: true,
    episodes,
  };
}

/** Used when a show's fetch/parse fails: keep whatever we had last time
 * (or an empty shell if this is the very first run) rather than let one
 * bad feed blank out that show's card. */
export function carryOverShowEntry(show, previousEntry, now) {
  return {
    slug: show.slug,
    name: show.name,
    tagline: show.tagline,
    logo: show.logo,
    platformLinks: show.platformLinks ?? {},
    resolvedFeedUrl: previousEntry?.resolvedFeedUrl ?? null,
    lastFetchedAt: previousEntry?.lastFetchedAt ?? now,
    lastFetchOk: false,
    episodes: previousEntry?.episodes ?? [],
  };
}
