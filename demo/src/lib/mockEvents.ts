import type { WSEnvelope } from "./types";

type EmitFn = (msg: WSEnvelope) => void;

let _emit: EmitFn | null = null;

export function registerTrigger(fn: EmitFn) {
  _emit = fn;
}

export function pushEvent(msg: WSEnvelope) {
  _emit?.(msg);
}
