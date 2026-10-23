import { buildNowPlaying, buildEpisodeRow, playEpisode } from "./player.js";

/** Renders a show's player into its slot: the latest episode as the active
 * native player, plus a native <details> disclosure for the next few recent
 * ones (an accordion beats a bare long <ul> for >5 items). The full back
 * catalog lives on the show's own episodes page, linked from the bottom of
 * the disclosure, so this page stays short however long a show has run. */
export function renderShowPlayer(slot, show) {
  slot.textContent = ""; // clear "Loading episodes…"
  slot.setAttribute("aria-busy", "false");

  const episodes = show.episodes ?? [];
  if (episodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "show__player-empty";
    empty.textContent = "No episodes found yet, check the show's own page above.";
    slot.appendChild(empty);
    return;
  }

  const [latest, ...rest] = episodes;
  const nowPlaying = buildNowPlaying(latest, show.name);
  slot.appendChild(nowPlaying.wrap);

  if (!show.lastFetchOk) {
    const notice = document.createElement("p");
    notice.className = "show__player-notice";
    notice.textContent = "Showing the last successfully fetched episodes for this show.";
    slot.appendChild(notice);
  }

  if (rest.length > 0) {
    const details = document.createElement("details");
    details.className = "player__more";
    const summary = document.createElement("summary");
    summary.textContent = `More episodes (${rest.length})`;
    details.appendChild(summary);

    const list = document.createElement("ol");
    list.className = "player__list";
    rest.forEach((episode) => {
      list.appendChild(
        buildEpisodeRow(episode, (selected) => playEpisode(nowPlaying, selected, show.name))
      );
    });
    details.appendChild(list);

    const total = show.episodeCount ?? episodes.length;
    if (total > episodes.length) {
      const all = document.createElement("a");
      all.className = "player__all";
      all.href = `episodes.html?show=${encodeURIComponent(show.slug)}`;
      all.textContent = `See all ${total} episodes`;
      details.appendChild(all);
    }

    slot.appendChild(details);
  }
}

export function renderPlayerError(slot) {
  slot.textContent = "";
  slot.setAttribute("aria-busy", "false");
  const notice = document.createElement("p");
  notice.className = "show__player-empty";
  notice.textContent = "Episode player unavailable right now, use the links above to listen.";
  slot.appendChild(notice);
}
