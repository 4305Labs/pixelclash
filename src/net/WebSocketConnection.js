// ===========================================================================
// WebSocketConnection (browser side) — wraps the browser's built-in WebSocket
// in our simple connection interface (send / onMessage / onClose). It buffers
// any messages sent before the socket finishes opening, then flushes them.
// ===========================================================================

import { NET } from "../config.js";

// Work out which server address to connect to. Three cases, in priority order:
//
//   1. An explicit override — a `?server=...` URL query param, or a global
//      `window.PIXELCLASH_SERVER` you can set in index.html. Use this when the
//      web page and the game server live on DIFFERENT hosts (the usual setup
//      once you deploy: page on GitHub Pages, server on Render). Example:
//      `window.PIXELCLASH_SERVER = "wss://pixelclash.onrender.com";`
//
//   2. Page served over HTTPS (e.g. GitHub Pages) with no override — browsers
//      forbid an insecure `ws://` from a secure page, so use `wss://` on the
//      same host and the standard port (443), which your host terminates TLS on.
//
//   3. Local development over plain HTTP — `ws://<host>:<port>`. On your Mac
//      that's "localhost"; a phone on your Wi-Fi opening your Mac's IP reuses
//      that IP automatically.
export function defaultServerUrl() {
  if (typeof window !== "undefined" && typeof location !== "undefined") {
    const fromQuery = new URLSearchParams(location.search || "").get("server");
    if (fromQuery) return fromQuery;
    if (window.PIXELCLASH_SERVER) return window.PIXELCLASH_SERVER;
  }
  const host = (typeof location !== "undefined" && location.hostname) || "localhost";
  if (typeof location !== "undefined" && location.protocol === "https:") {
    return `wss://${host}`;
  }
  return `ws://${host}:${NET.port}`;
}

export class WebSocketConnection {
  constructor(url = defaultServerUrl()) {
    this.url = url;
    this.ws = new WebSocket(url);
    this.queue = [];
    this._onMessage = () => {};
    this._onClose = () => {};
    this._onOpen = () => {};

    this.ws.onopen = () => {
      this._onOpen();
      for (const m of this.queue) this.ws.send(m);
      this.queue = [];
    };
    this.ws.onmessage = (e) => {
      try {
        this._onMessage(JSON.parse(e.data));
      } catch {
        /* ignore malformed messages */
      }
    };
    this.ws.onclose = () => this._onClose();
  }

  send(msg) {
    const data = JSON.stringify(msg);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.queue.push(data); // not open yet — send when it opens
  }

  onMessage(cb) {
    this._onMessage = cb;
  }
  onClose(cb) {
    this._onClose = cb;
  }
  onOpen(cb) {
    this._onOpen = cb;
  }
  close() {
    this.ws.close();
  }
}
