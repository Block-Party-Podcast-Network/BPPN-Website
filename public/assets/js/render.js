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
    empty.textContent = "No episodes found yet. Try one of the show's links.";
    slot.appendChild(empty);
    return;
  }

  const [latest, ...rest] = episodes;
  const nowPlaying = buildNowPlaying(latest, show.name);
  slot.appendChild(nowPlaying.wrap);

  if (!show.lastFetchOk) {
    const notice = document.createElement("p");
    notice.className = "show__player-notice";
    notice.textContent = "This show's feed didn't load on the last update, so newer episodes may be missing.";
    slot.appendChild(notice);
  }

  if (rest.length > 0) {
    const details = document.createElement("details");
    details.className = "player__more";
    const summary = document.createElement("summary");
    summary.textContent = "Recent episodes";
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
  notice.textContent = "The player isn't working right now. You can still listen through the show's links.";
  slot.appendChild(notice);
}
