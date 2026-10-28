import { Fragment, useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { RUNNING_TEXT_MESSAGES } from "~/components/kiosk/runningText";

const SPEED_PX_PER_SEC = 60;

function Messages({ messages, hidden }: { messages: string[]; hidden?: boolean }) {
  return (
    <div aria-hidden={hidden} className="flex shrink-0 items-center gap-7 pr-7">
      {messages.map((m, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">{m}</span>
          <span aria-hidden className="size-2 shrink-0 bg-bp-sky" />
        </Fragment>
      ))}
    </div>
  );
}

export function KioskRunningText({ messages = RUNNING_TEXT_MESSAGES }: { messages?: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (track) track.style.animationDuration = `${track.scrollWidth / 2 / SPEED_PX_PER_SEC}s`;
    if (!reduced) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % messages.length), 6000);
    return () => clearInterval(id);
  }, [reduced, messages]);

  if (messages.length === 0) return null;

  return (
    <div
      role="marquee"
      aria-label="Pengumuman"
      className="flex h-14 items-center overflow-hidden bg-bp-accent-ink lg:col-span-2"
    >
      <div className="flex h-full shrink-0 items-center gap-2.5 bg-white px-[22px] text-bp-accent-ink">
        <Megaphone size={20} aria-hidden />
        <span className="font-caption text-sm uppercase tracking-[1.4px]">Info</span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden pl-7 font-body text-[19px] font-medium text-white">
        {reduced ? (
          <span key={current} className="block animate-[fade_600ms_ease-out] truncate">
            {messages[current]}
          </span>
        ) : (
          <div ref={trackRef} className="marquee-track flex w-max">
            <Messages messages={messages} />
            <Messages messages={messages} hidden />
          </div>
        )}
      </div>
    </div>
  );
}
