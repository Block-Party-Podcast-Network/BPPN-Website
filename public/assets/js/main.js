import { renderShowPlayer, renderPlayerError } from "./render.js";

const DATA_URL = "./data/episodes.json";

async function init() {
  const slots = document.querySelectorAll("[data-player-slot]");

  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    // Same-origin JSON fetch failing (e.g. opened via file:// with no server)
    // shouldn't blank out the page - the static platform links in each
    // show's markup already work without this. Just say so, per-slot.
    console.error("Could not load data/episodes.json:", err);
    slots.forEach((slot) => renderPlayerError(slot));
    return;
  }

  const showsBySlug = new Map(data.shows.map((show) => [show.slug, show]));

  slots.forEach((slot) => {
    const slug = slot.dataset.slug;
    const show = showsBySlug.get(slug);
    if (show) {
      renderShowPlayer(slot, show);
    } else {
      renderPlayerError(slot);
    }
  });
}

init();
