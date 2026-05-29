// ===========================================================================
// WebSocketConnection (browser side) — wraps the browser's built-in WebSocket
// in our simple connection interface (send / onMessage / onClose). It buffers
// any messages sent before the socket finishes opening, then flushes them.
// ===========================================================================

import { NET } from "../config.js";

// Build the server address from the current page's hostname. When you open the
// game on your Mac it's "localhost"; when a phone on your Wi-Fi opens it via
// your Mac's IP, it'll use that same IP automatically.
export function defaultServerUrl() {
  const host = (typeof location !== "undefined" && location.hostname) || "localhost";
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
