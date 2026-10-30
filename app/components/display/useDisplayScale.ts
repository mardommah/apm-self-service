import { useEffect, useState } from "react";

export const DISPLAY_WIDTH = 1920;
export const DISPLAY_HEIGHT = 1080;

/** DESIGN.md §9.1: the TV layout is drawn at 1920×1080 and scaled as a whole to fit smaller screens. */
export function useDisplayScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / DISPLAY_WIDTH, window.innerHeight / DISPLAY_HEIGHT));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}
