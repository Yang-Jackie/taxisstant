import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import "./boundary/leafletSetup";
import "./boundary/i18n"; // every word, in English and Chinese, before anything renders
import { App } from "./App";
import { ControllersContext, initControllers, startControllers } from "./startup";

const controllers = initControllers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ControllersContext.Provider value={controllers}>
      <App />
    </ControllersContext.Provider>
  </StrictMode>,
);

void startControllers(controllers);
