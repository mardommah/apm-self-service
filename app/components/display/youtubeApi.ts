declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

/** Loads the YouTube IFrame Player API once; a failed load can be retried. */
export function loadYouTubeApi(): Promise<any> {
  apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      script.remove();
      apiPromise = null;
      reject(new Error("YouTube API unavailable"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const titleCache = new Map<string, Promise<string>>();

/** The IFrame API only exposes video IDs for the playlist, so titles come from oEmbed (no API key). */
export function fetchVideoTitle(videoId: string): Promise<string> {
  if (!titleCache.has(videoId)) {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    titleCache.set(
      videoId,
      fetch(url)
        .then((res) => (res.ok ? res.json() : { title: "" }))
        .then((data) => data.title ?? "")
        .catch(() => {
          titleCache.delete(videoId);
          return "";
        }),
    );
  }
  return titleCache.get(videoId)!;
}
