import React from "react";
import ReactDOM from "react-dom/client";

import CssBaseline from "@mui/material/CssBaseline";

import "./fonts/fonts.css";
import { GlobalStyles } from "./GlobalStyles";
import { PluginThemeProvider } from "./plugin/PluginThemeProvider";
import { PluginGate } from "./plugin/PluginGate";
import { AccessPrompt } from "./plugin/AccessPrompt";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PluginThemeProvider>
      <CssBaseline />
      <GlobalStyles />
      <PluginGate>
        <AccessPrompt />
      </PluginGate>
    </PluginThemeProvider>
  </React.StrictMode>
);
