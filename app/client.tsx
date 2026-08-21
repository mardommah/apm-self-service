import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { createRouter } from "./router";

const router = createRouter();

// Register router globally so StartClient can pick it up
(globalThis as any).__tanstack_router__ = router;

hydrateRoot(document, <StartClient />);
