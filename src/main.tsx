import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initMagic, MagicProvider } from "../dist/index";
import { MarketPlaceInfo, NFTInfo } from "./web3/contract.info.ts";
import "tailwindcss";
initMagic("pk_live_892FF1AE695D43B9", "soneium", "bcrBY4ATH4SxyoPmL1bym");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MagicProvider
      apiKey="pk_live_892FF1AE695D43B9"
      network="soneium"
      MarketPlaceInfo={MarketPlaceInfo}
      NFTInfo={NFTInfo}
    >
      <App />
    </MagicProvider>
  </StrictMode>
);
