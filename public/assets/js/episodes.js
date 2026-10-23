import { buildNowPlaying, buildEpisodeRow, playEpisode } from "./player.js";

// Labels for the keys used in shows.config.json's platformLinks, in the
// same order the landing page lists them.
const PLATFORM_LABELS = {
  apple: "Apple Podcasts",
  spotify: "Spotify",
  podbean: "Podbean",
  website: "Website",
  linktree: "Linktree",
};

const header = document.querySelector("[data-archive-header]");
const body = document.querySelector("[data-archive-body]");

function showMessage(text) {
  body.textContent = "";
  const p = document.createElement("p");
  p.className = "show__player-empty";
  p.append(text, " ");
  const home = document.createElement("a");
  home.href = "./#shows";
  home.textContent = "Back to all shows";
  p.append(home, ".");
  body.appendChild(p);
}

function renderHeader(show) {
  document.title = `${show.name} episodes | Block Party Podcast Network`;
  const art = header.querySelector("[data-archive-art]");
  art.src = show.logo;
  art.alt = `${show.name} cover art`;
  header.querySelector("[data-archive-name]").textContent = show.name;
  header.querySelector("[data-archive-tagline]").textContent = show.tagline ?? "";

  const links = header.querySelector("[data-archive-links]");
  for (const [key, label] of Object.entries(PLATFORM_LABELS)) {
    const href = show.platformLinks?.[key];
    if (!href) continue;
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    links.appendChild(a);
  }
  header.hidden = false;
}

/** Sticky player card on top, then a search box and every episode below it.
 * Clicking a row loads it into the player and marks it as the current row. */
function renderEpisodes(show) {
  body.textContent = "";
  const episodes = show.episodes ?? [];
  if (episodes.length === 0) {
    showMessage("No episodes found for this show yet.");
    return;
  }

  const playerCard = document.createElement("div");
  playerCard.className = "show__player archive__player";
  const nowPlaying = buildNowPlaying(episodes[0], show.name);
  playerCard.appendChild(nowPlaying.wrap);

  const toolbar = document.createElement("div");
  toolbar.className = "archive__toolbar";
  const searchLabel = document.createElement("label");
  searchLabel.className = "archive__search";
  const searchText = document.createElement("span");
  searchText.className = "archive__search-label";
  searchText.textContent = "Search episodes";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search by title";
  search.autocomplete = "off";
  searchLabel.append(searchText, search);
  const count = document.createElement("p");
  count.className = "archive__count";
  count.setAttribute("aria-live", "polite");
  toolbar.append(searchLabel, count);

  const list = document.createElement("ol");
  list.className = "player__list archive__list";
  let currentRow = null;
  const rows = episodes.map((episode, i) => {
    const li = buildEpisodeRow(episode, (selected) => {
      playEpisode(nowPlaying, selected, show.name);
      setCurrent(li);
    });
    if (i === 0) setCurrent(li);
    list.appendChild(li);
    return { li, title: episode.title.toLowerCase() };
  });

  function setCurrent(li) {
    currentRow?.firstChild.removeAttribute("aria-current");
    li.firstChild.setAttribute("aria-current", "true");
    currentRow = li;
  }

  const noMatches = document.createElement("p");
  noMatches.className = "show__player-empty archive__none";
  noMatches.textContent = "No episodes match that search.";
  noMatches.hidden = true;

  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const row of rows) {
      const match = !query || row.title.includes(query);
      row.li.hidden = !match;
      if (match) shown++;
    }
    count.textContent = query
      ? `${shown} of ${episodes.length} episodes`
      : `${episodes.length} episodes, newest first`;
    noMatches.hidden = shown > 0;
  }
  search.addEventListener("input", applyFilter);
  applyFilter();

  const listCard = document.createElement("div");
  listCard.className = "archive__list-card";
  listCard.append(list, noMatches);

  body.append(playerCard, toolbar, listCard);
}

async function init() {
  const slug = new URLSearchParams(location.search).get("show");
  // Slugs are plain kebab-case; anything else can't be a real show file.
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    showMessage("We couldn't tell which show to list.");
    return;
  }

  let show;
  try {
    const res = await fetch(`./data/shows/${slug}.json`, { cache: "no-cache" });
    if (res.status === 404) {
      showMessage("We couldn't find that show.");
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    show = await res.json();
  } catch (err) {
    console.error(`Could not load data/shows/${slug}.json:`, err);
    showMessage("Episodes are unavailable right now.");
    return;
  }

  renderHeader(show);
  renderEpisodes(show);
}

init();
