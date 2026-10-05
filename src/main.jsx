import { createElement, render } from "preact";
import App from "./App.jsx";
import "./styles.css";

render(createElement(App), document.getElementById("app"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Could not install the service worker:", error);
    });
  });
}
