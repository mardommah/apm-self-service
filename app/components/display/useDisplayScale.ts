import { useEffect, useState } from "react";

export const DISPLAY_WIDTH = 1920;
export const DISPLAY_HEIGHT = 1080;

/** DESIGN.md §9.1: the TV layout is drawn at 1920×1080 and scaled as a whole to fit smaller screens. */
export function useDisplayScale() {
  return useDisplayFill().scale;
}

/**
 * Same scale, plus a canvas size (in design px) that fills the whole viewport: a non-16:9 window
 * widens or heightens the canvas instead of showing black bars. Never smaller than 1920×1080.
 */
export function useDisplayFill() {
  const [fit, setFit] = useState({ scale: 1, width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT });
  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / DISPLAY_WIDTH, window.innerHeight / DISPLAY_HEIGHT);
      setFit({ scale, width: window.innerWidth / scale, height: window.innerHeight / scale });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return fit;
}
