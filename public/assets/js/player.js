// Builds the native <audio> player and episode-list rows for one show.
// Deliberately native-controls-first: <audio controls> is keyboard-operable
// and screen-reader-friendly in every browser without us reimplementing
// play/pause/seek/volume by hand.

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDate(isoDate) {
  if (!isoDate) return "Undated";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? "Undated" : dateFormatter.format(d);
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function episodeMetaText(episode) {
  const parts = [formatDate(episode.pubDate)];
  const duration = formatDuration(episode.durationSeconds);
  if (duration) parts.push(duration);
  return parts.join(" · "); // one middle dot, exactly once
}

/** The "now playing" block: label, title, native audio element, meta line.
 * The label tracks real playback state instead of always claiming
 * "Now playing": paused or unstarted, it says whether the loaded episode is
 * the show's latest or one the listener picked from the list. */
export function buildNowPlaying(episode, showName) {
  const wrap = document.createElement("div");
  wrap.className = "player__now";

  const label = document.createElement("p");
  label.className = "player__now-label";

  const title = document.createElement("p");
  title.className = "player__now-title";
  title.textContent = episode.title;

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.setAttribute("aria-label", `Play ${episode.title}, ${showName}`);
  const source = document.createElement("source");
  source.src = episode.audioUrl;
  source.type = episode.audioType || "audio/mpeg";
  audio.appendChild(source);
  const fallback = document.createElement("p");
  const fallbackLink = document.createElement("a");
  fallbackLink.href = episode.audioUrl;
  fallbackLink.textContent = "Download the episode";
  fallback.append("Your browser can't play audio here. ", fallbackLink, " instead.");
  audio.appendChild(fallback);

  const meta = document.createElement("p");
  meta.className = "player__now-meta";
  meta.textContent = episodeMetaText(episode);

  wrap.append(label, title, audio, meta);

  const nowPlaying = { wrap, label, title, audio, source, meta, latestId: episode.id, currentId: episode.id };
  const updateLabel = () => updatePlayerLabel(nowPlaying);
  audio.addEventListener("play", updateLabel);
  audio.addEventListener("pause", updateLabel);
  audio.addEventListener("ended", updateLabel);
  updateLabel();
  return nowPlaying;
}

function updatePlayerLabel(nowPlaying) {
  const { audio, label, currentId, latestId } = nowPlaying;
  if (!audio.paused && !audio.ended) {
    label.textContent = "Now playing";
  } else {
    label.textContent = currentId === latestId ? "Latest episode" : "Selected episode";
  }
}

/** Swaps an existing now-playing block over to a different episode. */
export function playEpisode(nowPlaying, episode, showName) {
  nowPlaying.currentId = episode.id;
  nowPlaying.title.textContent = episode.title;
  nowPlaying.source.src = episode.audioUrl;
  nowPlaying.source.type = episode.audioType || "audio/mpeg";
  nowPlaying.audio.load(); // also stops playback, so the label resets below
  updatePlayerLabel(nowPlaying);
  nowPlaying.audio.setAttribute("aria-label", `Play ${episode.title}, ${showName}`);
  nowPlaying.meta.textContent = episodeMetaText(episode);
  nowPlaying.wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  nowPlaying.audio.focus();
}

/** One row in the "more episodes" disclosure list. Clicking it swaps the
 * now-playing block to that episode rather than spawning a second player. */
export function buildEpisodeRow(episode, onSelect) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "player__list-row";

  const title = document.createElement("span");
  title.className = "player__list-title";
  title.textContent = episode.title;

  const meta = document.createElement("span");
  meta.className = "player__list-meta";
  meta.textContent = episodeMetaText(episode);

  button.append(title, meta);
  button.addEventListener("click", () => onSelect(episode));
  li.appendChild(button);
  return li;
}
