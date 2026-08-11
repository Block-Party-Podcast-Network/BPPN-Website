import { XMLParser } from "fast-xml-parser";

// Tuned for podcast RSS 2.0 + the itunes: / content: namespaces every host
// in this project uses (Podbean, Libsyn, Anchor, Buzzsprout). Namespaced tags
// come through as literal keys ("itunes:duration"), which normalize.mjs reads
// directly rather than us stripping prefixes and guessing.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // No cdataPropName override: CDATA text merges directly into the tag's
  // string value (fast-xml-parser's default), same as plain text would.
  // We only care about the text content here, never about distinguishing
  // CDATA from regular text nodes.
  parseTagValue: false, // keep everything as strings; normalize.mjs converts deliberately
  trimValues: true,
});

/**
 * Parses raw RSS/Atom XML text into a flat array of { channel, items }.
 * Throws if the feed doesn't look like a valid RSS channel with items -
 * callers should catch this per-show so one malformed feed doesn't take
 * down the whole run.
 */
export function parseFeed(xmlText) {
  const doc = parser.parse(xmlText);
  const channel = doc?.rss?.channel;
  if (!channel) {
    throw new Error("Feed did not parse to an rss > channel structure");
  }
  const rawItems = channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  if (items.length === 0) {
    throw new Error("Feed channel has no <item> entries");
  }
  return { channel, items };
}
