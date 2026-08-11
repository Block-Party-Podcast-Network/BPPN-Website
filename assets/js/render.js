import { buildNowPlaying, buildEpisodeRow, formatDate, formatDuration } from "./player.js";

/** Renders a show's player into its slot: the latest episode as the active
 * native player, plus a native <details> disclosure for the rest of the
 * back catalog (an accordion beats a bare long <ul> for >5 items). */
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
        buildEpisodeRow(episode, (selected) => {
          nowPlaying.title.textContent = selected.title;
          nowPlaying.source.src = selected.audioUrl;
          nowPlaying.source.type = selected.audioType || "audio/mpeg";
          nowPlaying.audio.load();
          nowPlaying.audio.setAttribute(
            "aria-label",
            `Play ${selected.title}, ${show.name}`
          );
          const metaParts = [formatDate(selected.pubDate)];
          const duration = formatDuration(selected.durationSeconds);
          if (duration) metaParts.push(duration);
          nowPlaying.meta.textContent = metaParts.join(" · ");
          nowPlaying.wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
          nowPlaying.audio.focus();
        })
      );
    });
    details.appendChild(list);
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
