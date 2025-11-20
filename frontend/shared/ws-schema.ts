export type TF = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type WsBarPayload = {
  type: "bar";
  sessionId: string;
  symbol: string;
  tf: TF;
  tsStart: number; // UNIX ms representing NYSE-anchored bucket start
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  barClose: boolean;
};

export type WsSubscribe = { type: "subscribe"; id: string; symbol: string; tf: TF };
export type WsUnsubscribe = { type: "unsubscribe"; id: string };
export type WsServerHello = { type: "hello"; sessionId: string };
export type WsError = { type: "error"; message: string };

export type WsClientMsg = WsSubscribe | WsUnsubscribe;
export type WsServerMsg = WsServerHello | WsBarPayload | WsError;
