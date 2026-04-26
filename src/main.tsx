import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { initializeApiStorage } from "./services/api";
import { api } from "./services/api";

const bootstrap = async () => {
  await initializeApiStorage();
  createRoot(document.getElementById("root")!).render(<App />);
};

void bootstrap();
