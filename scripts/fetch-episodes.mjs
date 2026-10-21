#!/usr/bin/env node
// Refreshes public/data/episodes.json from each show's real RSS feed.
//
// Runs entirely server-side (Node, not the browser) so this never hits the
// CORS problems that plague in-browser podcast embeds - and so the live
// site never depends on a third-party embed script being up. Run this
// before every deploy: `npm run fetch:episodes`.

import { readFile, writeFile, rename } from "node:fs/promises";
import { resolveFeedUrl, USER_AGENT } from "./lib/itunes.mjs";
import { parseFeed } from "./lib/xml.mjs";
import { buildShowEntry, carryOverShowEntry } from "./lib/normalize.mjs";

const CONFIG_PATH = new URL("../data/shows.config.json", import.meta.url);
const OUTPUT_PATH = new URL("../public/data/episodes.json", import.meta.url);
const TMP_PATH = new URL("../public/data/episodes.json.tmp", import.meta.url);

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function fetchFeedText(feedUrl, attempt = 1) {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, text/xml, */*" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt < 2) {
      console.warn(`  retrying ${feedUrl} after error: ${err.message}`);
      return fetchFeedText(feedUrl, attempt + 1);
    }
    throw err;
  }
}

async function processShow(show, previousEntry, now) {
  try {
    const { feedUrl, source } = await resolveFeedUrl(show);
    const xmlText = await fetchFeedText(feedUrl);
    const parsed = parseFeed(xmlText);
    const entry = buildShowEntry(show, parsed, feedUrl, now);
    console.log(
      `  ok  ${show.slug} (${entry.episodes.length} episodes, feed via ${source})`
    );
    return entry;
  } catch (err) {
    console.warn(`  FAIL ${show.slug}: ${err.message} - carrying over last-known-good data`);
    return carryOverShowEntry(show, previousEntry, now);
  }
}

async function main() {
  const config = await readJson(CONFIG_PATH);
  if (!config?.shows?.length) {
    throw new Error("data/shows.config.json is missing or has no shows");
  }
  const previous = await readJson(OUTPUT_PATH);
  const previousBySlug = new Map((previous?.shows ?? []).map((s) => [s.slug, s]));

  const now = new Date().toISOString();
  console.log(`Fetching ${config.shows.length} show feeds...`);

  // Promise.allSettled (via per-show try/catch above): one bad feed must
  // never take down the other five.
  const shows = await Promise.all(
    config.shows.map((show) => processShow(show, previousBySlug.get(show.slug), now))
  );

  const output = { generatedAt: now, shows };

  // Atomic write: write to a temp file, then rename over the real one, so a
  // crash mid-write can never leave episodes.json truncated or corrupt.
  await writeFile(TMP_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  await rename(TMP_PATH, OUTPUT_PATH);

  const failed = shows.filter((s) => !s.lastFetchOk).map((s) => s.slug);
  console.log(`\nWrote public/data/episodes.json (${shows.length} shows).`);
  if (failed.length) {
    console.log(`Shows using carried-over data this run: ${failed.join(", ")}`);
  } else {
    console.log("All shows fetched fresh successfully.");
  }
}

main().catch((err) => {
  console.error("fetch-episodes.mjs failed:", err);
  process.exitCode = 1;
});
