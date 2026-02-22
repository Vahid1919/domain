import React from "react";
import ReactDOM from "react-dom/client";
import BlockedApp from "./App.tsx";
import "@/assets/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BlockedApp />
  </React.StrictMode>,
);
