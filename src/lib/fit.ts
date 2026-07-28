import { useLayoutEffect, useRef } from 'react';

/**
 * Scale a block's content to the space the block was given.
 *
 * The operator shapes the space first: resize a block and its content resizes
 * to suit, in both directions — it grows to fill a generous block and shrinks
 * to fit a tight one. A block never needs to grow to accommodate a fixed
 * amount of content, which is what keeps the template stable while song
 * content varies underneath it.
 *
 * Implemented as a binary search over a `--fit` multiplier that every live
 * text style is expressed in terms of. Nine passes lands within ~0.4% of the
 * true maximum, and it writes straight to the DOM rather than through state,
 * so a re-fit costs no React renders.
 */

/*
 * The band content may scale within.
 *
 * The ceiling is 1: a tier renders at exactly its defined size, and the only
 * thing fitting ever does is shrink content that would otherwise be clipped
 * by a block too small for it. Letting content grow to fill spare room —
 * which this did, up to 2.6x — meant the same tier came out at seven
 * different sizes on one screen, and the page read as a pile of unrelated
 * decisions rather than one type scale.
 *
 * A block still never grows to fit its content, and content still adapts to
 * the room it is given. It just adapts in one direction.
 */
export const FIT_MIN = 0.62;
export const FIT_MAX = 1;
const PASSES = 9;

export function useFitToBox<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = (v: number) => el.style.setProperty('--fit', v.toFixed(3));

    const fit = () => {
      // Before first layout the box has no size and everything "overflows";
      // the observer will call back once it does.
      if (el.clientHeight === 0 || el.clientWidth === 0) return;

      let lo = FIT_MIN;
      let hi = FIT_MAX;
      for (let i = 0; i < PASSES; i++) {
        const mid = (lo + hi) / 2;
        apply(mid);
        const fits =
          el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth;
        if (fits) lo = mid;
        else hi = mid;
      }
      apply(lo);
    };

    fit();

    // The element's own box is set by the grid cell, not by its content, so
    // re-fitting cannot resize the thing being observed — no feedback loop.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);

  return ref;
}
