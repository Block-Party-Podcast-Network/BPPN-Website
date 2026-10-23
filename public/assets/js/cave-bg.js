/** The .cave-bg layer holds more map art than any one page load needs (13
 * stacked, feathered cave maps - enough to cover a long mobile page). It's
 * absolutely positioned so it never inflates the document's own height, but
 * that means we have to size it to the real page height ourselves, or its
 * `height: 100%` default has nothing meaningful to resolve against. Doing
 * this in JS (rather than baking a height into CSS) also means maps past
 * the real content height stay clipped by `overflow: hidden` and out of
 * play below - so a short page only pays for the maps it actually shows.
 *
 * Lazy loading is hand-rolled with IntersectionObserver rather than the
 * native `loading="lazy"` attribute: these images sit inside a container
 * whose height is set by us just above, and the browser's own lazy-load
 * heuristic runs its first (and decisive) viewport check before that
 * height lands, so every image reads as "far away" and never fetches.
 * Driving it ourselves sidesteps that race. The top map skips all this and
 * loads straight from its src in index.html, since it's always in view. */
const container = document.querySelector(".cave-bg");

if (container) {
  const syncHeight = () => {
    container.style.height = `${document.body.scrollHeight}px`;
  };

  syncHeight();
  window.addEventListener("load", syncHeight);
  window.addEventListener("resize", syncHeight);

  // Catches height changes syncHeight's own callers miss: episode data
  // arriving async, a <details> disclosure opening, fonts swapping in.
  new ResizeObserver(syncHeight).observe(document.body);

  const lazyImgs = container.querySelectorAll("img[data-src]");
  const loadImg = (img) => {
    img.src = img.dataset.src;
    delete img.dataset.src;
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImg(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "800px 0px" }
    );
    lazyImgs.forEach((img) => observer.observe(img));
  } else {
    lazyImgs.forEach(loadImg);
  }
}
