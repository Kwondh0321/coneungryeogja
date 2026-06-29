import { BrowserRouter, useLocation } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { useEffect } from "react";
import App from "./App";
import "./index.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </HelmetProvider>
);
