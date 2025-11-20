import type { TF, WsClientMsg, WsServerMsg, WsBarPayload } from "../../../shared/ws-schema";

type SubKey = `${string}:${TF}`;
type Handler = (bar: WsBarPayload) => void;

export class WsStream {
  private ws?: WebSocket;
  private readonly url: string;
  private readonly handlers = new Map<SubKey, Set<Handler>>();
  private queue: WsClientMsg[] = [];
  private connected = false;
  private connectPromise?: Promise<void>;

  constructor(url: string) {
    this.url = url;
  }

  private ensure() {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise<void>((resolve) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.connected = true;
        this.queue.forEach((msg) => this.ws?.send(JSON.stringify(msg)));
        this.queue = [];
        resolve();
      };
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as WsServerMsg;
        if (msg.type === "bar") {
          const key: SubKey = `${msg.symbol}:${msg.tf}`;
          this.handlers.get(key)?.forEach((handler) => handler(msg));
        }
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.connectPromise = undefined;
        setTimeout(() => this.ensure(), 1_000);
      };
      this.ws.onerror = () => this.ws?.close();
    });
    return this.connectPromise;
  }

  async subscribe(symbol: string, tf: TF, onBar: Handler) {
    const key: SubKey = `${symbol}:${tf}`;
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(onBar);

    await this.ensure();
    const payload: WsClientMsg = { type: "subscribe", id: key, symbol, tf };
    if (this.connected) this.ws?.send(JSON.stringify(payload));
    else this.queue.push(payload);

    return () => this.unsubscribe(symbol, tf, onBar);
  }

  async unsubscribe(symbol: string, tf: TF, onBar?: Handler) {
    const key: SubKey = `${symbol}:${tf}`;
    const handlerSet = this.handlers.get(key);
    if (handlerSet && onBar) handlerSet.delete(onBar);

    if (handlerSet && handlerSet.size === 0) {
      this.handlers.delete(key);
      const payload: WsClientMsg = { type: "unsubscribe", id: key };
      if (this.connected) this.ws?.send(JSON.stringify(payload));
      else this.queue.push(payload);
    }
  }
}
