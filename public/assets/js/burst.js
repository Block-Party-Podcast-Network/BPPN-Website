/** Confetti bursts for the hero logo and the masthead wordmark.
 *
 * The pieces are the brand's own confetti vocabulary, the same pieces that
 * fall behind the hero and frame the wordmark art: paper rectangles,
 * soft-gold bars, and teal shards, in the site's gold/teal palette.
 *
 * Usage: put data-burst="big" or data-burst="small" on anything; it fires
 * on click/tap from the pointer's position.
 *
 * - The particle layer is position:fixed on <body>, not inside the clicked
 *   element, so pieces aren't clipped by the hero's own bounds.
 * - It's aria-hidden and pointer-events:none: invisible to assistive tech
 *   and it can never swallow a click meant for the page.
 * - prefers-reduced-motion is checked at fire time, so changing the system
 *   setting takes effect without a reload. */

const HUES = ["#e8b34d", "#ffe6a2", "#1d7485", "#7fd0d9"]; // --gold, --gold-soft, --teal-deep, --teal-tint

// Each shape is drawn on its own small viewBox; `w`/`h` set its rough
// on-screen size range before the per-piece random scale.
const SHAPES = [
  { viewBox: "0 0 8 13", w: 8, h: 13, svg: '<rect width="8" height="13" />' }, // paper rectangle
  { viewBox: "0 0 6 26", w: 6, h: 26, svg: '<rect width="6" height="26" rx="3" />' }, // confetti bar
  { viewBox: "0 0 22 12", w: 22, h: 12, svg: '<path d="M1.5 4.2 19.8 0.6l1.6 7.8L3.3 11.4Z" />' }, // shard
  { viewBox: "0 0 12 12", w: 12, h: 12, svg: '<path d="M0.8 1.4 11 0.4 6.2 11.6Z" />' }, // bunting flag
];

const SIZES = {
  big: { count: 46, dist: [110, 330], duration: [1100, 1700], lift: [60, 140] },
  small: { count: 14, dist: [40, 110], duration: [700, 1000], lift: [15, 45] },
};

// A ceiling on pieces alive at once, so rapid clicking can't pile up
// hundreds of animating nodes. Counted from the DOM rather than a running
// total, so a piece removed some other way can never leave it stuck.
const MAX_LIVE = 140;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let layer = null;
function getLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement("div");
  layer.className = "burst-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

function makePiece() {
  const shape = pick(SHAPES);
  const scale = rand(0.7, 1.25);
  const piece = document.createElement("span");
  piece.className = "burst-bit";
  piece.style.width = `${shape.w * scale}px`;
  piece.style.height = `${shape.h * scale}px`;
  piece.innerHTML = `<svg viewBox="${shape.viewBox}" fill="${pick(HUES)}" preserveAspectRatio="none">${shape.svg}</svg>`;
  return piece;
}

export function burst(x, y, size = "big") {
  if (reduced()) return;
  const opts = SIZES[size] ?? SIZES.big;
  const host = getLayer();
  const n = Math.min(opts.count, MAX_LIVE - host.childElementCount);

  for (let i = 0; i < n; i++) {
    const piece = makePiece();
    host.appendChild(piece);

    // Thrown up and out, then gravity takes the tail of the arc back down
    // past where it started, the way real confetti falls.
    const angle = rand(0, Math.PI * 2);
    const dist = rand(...opts.dist);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist * 0.75 - rand(...opts.lift);
    const fall = rand(...opts.lift) * 1.6;
    const spin = rand(-540, 540);
    // scaleY swinging through near-zero reads as paper flipping over.
    const flip = rand(0.15, 0.5);

    // Easing per keyframe, not on the whole animation: a fast pop out, then
    // a slow drift down. A whole-animation ease-out would rush every piece
    // through its arc in the first fraction of the duration.
    const anim = piece.animate(
      [
        {
          transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.3) rotate(0deg)`,
          opacity: 0,
          easing: "cubic-bezier(0.15, 0.85, 0.3, 1)",
        },
        {
          transform: `translate(${x + dx * 0.7}px, ${y + dy * 0.7}px) translate(-50%, -50%) scale(1, 1) rotate(${spin * 0.4}deg)`,
          opacity: 1,
          offset: 0.3,
          easing: "cubic-bezier(0.4, 0, 0.7, 1)",
        },
        {
          transform: `translate(${x + dx * 0.9}px, ${y + dy * 0.6 + fall * 0.4}px) translate(-50%, -50%) scale(1, ${flip}) rotate(${spin * 0.7}deg)`,
          opacity: 1,
          offset: 0.62,
        },
        {
          transform: `translate(${x + dx}px, ${y + dy * 0.5 + fall}px) translate(-50%, -50%) scale(0.9, 1) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration: rand(...opts.duration), fill: "forwards" }
    );

    const done = () => piece.remove();
    anim.addEventListener("finish", done);
    anim.addEventListener("cancel", done);
  }
}

// Restarts a CSS keyframe animation class on every click, even mid-run.
function replayClass(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // force a reflow so re-adding the class restarts it
  el.classList.add(className);
}

document.querySelectorAll("[data-burst]").forEach((el) => {
  el.addEventListener("click", (e) => {
    // Keyboard "clicks" report 0,0; burst from the element's centre instead.
    let { clientX: x, clientY: y } = e;
    if (e.detail === 0) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    burst(x, y, el.dataset.burst);
    replayClass(el, "is-bursting");
  });
  el.addEventListener("animationend", () => el.classList.remove("is-bursting"));
});
