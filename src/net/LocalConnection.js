// ===========================================================================
// LocalConnection — two linked in-memory endpoints that behave like a network
// connection but never touch a real socket. Sending on one delivers to the
// other's message handler on a later microtask (so it feels async, like a real
// network). Used by automated tests to exercise the full netcode without
// needing a server we can bind to.
// ===========================================================================

class LocalConnection {
  constructor() {
    this.peer = null;
    this._onMessage = () => {};
    this._onClose = () => {};
    this.closed = false;
  }

  send(msg) {
    if (this.closed || !this.peer) return;
    // Deep-copy via JSON so the two sides can't accidentally share objects,
    // exactly like a real connection that serializes to text.
    const data = JSON.parse(JSON.stringify(msg));
    queueMicrotask(() => this.peer._onMessage(data));
  }

  onMessage(cb) {
    this._onMessage = cb;
  }
  onClose(cb) {
    this._onClose = cb;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    queueMicrotask(() => this.peer && this.peer._onClose());
  }
}

// Returns { server, client } — two ends wired together.
export function createLocalPair() {
  const server = new LocalConnection();
  const client = new LocalConnection();
  server.peer = client;
  client.peer = server;
  return { server, client };
}
