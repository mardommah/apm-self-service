import { hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { hydrate } from "@tanstack/start-client-core";
import { createRouter } from "./router";

const router = createRouter();
void hydrate(router);

const client = hydrateRoot(document, <RouterProvider router={router} />);

export default client;
