#!/usr/bin/env node
// Refreshes public/data/episodes.json (each show's newest episodes, for the
// landing page) and public/data/shows/<slug>.json (each show's full back
// catalog, for its episodes page) from each show's real RSS feed.
//
// Runs entirely server-side (Node, not the browser) so this never hits the
// CORS problems that plague in-browser podcast embeds - and so the live
// site never depends on a third-party embed script being up. Run this
// before every deploy: `npm run fetch:episodes`.

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { resolveFeedUrl, USER_AGENT } from "./lib/itunes.mjs";
import { parseFeed } from "./lib/xml.mjs";
import { buildShowEntry, carryOverShowEntry, toLandingEntry } from "./lib/normalize.mjs";

const CONFIG_PATH = new URL("../data/shows.config.json", import.meta.url);
const OUTPUT_PATH = new URL("../public/data/episodes.json", import.meta.url);
const ARCHIVE_DIR = new URL("../public/data/shows/", import.meta.url);

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Atomic write: write to a temp file, then rename over the real one, so a
// crash mid-write can never leave a JSON file truncated or corrupt.
async function writeJsonAtomic(url, data) {
  const tmp = new URL(`${url.href}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(tmp, url);
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
    await writeJsonAtomic(new URL(`${show.slug}.json`, ARCHIVE_DIR), entry);
    console.log(
      `  ok  ${show.slug} (${entry.episodes.length} episodes, feed via ${source})`
    );
    return toLandingEntry(entry);
  } catch (err) {
    // The show's archive file is left untouched, so its episodes page keeps
    // serving the last-known-good back catalog too.
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
  await mkdir(ARCHIVE_DIR, { recursive: true });
  console.log(`Fetching ${config.shows.length} show feeds...`);

  // Promise.allSettled (via per-show try/catch above): one bad feed must
  // never take down the other five.
  const shows = await Promise.all(
    config.shows.map((show) => processShow(show, previousBySlug.get(show.slug), now))
  );

  await writeJsonAtomic(OUTPUT_PATH, { generatedAt: now, shows });

  const failed = shows.filter((s) => !s.lastFetchOk).map((s) => s.slug);
  console.log(`\nWrote public/data/episodes.json and public/data/shows/ (${shows.length} shows).`);
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
