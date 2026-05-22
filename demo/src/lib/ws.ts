import type { WSEnvelope } from "./types";
import { ACCOUNTS, getContactsByAccount, addMessage, addTimelineEntry, NOW } from "./mockData";
import { registerTrigger } from "./mockEvents";

type Listener = (msg: WSEnvelope) => void;

const AUTO_REPLIES = [
  "Thanks! 😊",
  "Got it 👍",
  "Sure, sounds good!",
  "I'll check that out.",
  "Let me get back to you.",
  "Of course! No problem.",
  "Great idea!",
  "I'll be there.",
  "Can we talk later?",
  "هلا! 👋",
  "تمام، شكراً 😊",
  "إن شاء الله",
  "خير إن شاء الله",
  "أوكي، سأفعل ذلك",
  "Absolutely!",
  "Love that plan 🎉",
  "On it!",
  "Perfect 💯",
];

class MockWSHub {
  private listeners = new Set<Listener>();
  private started = false;
  private replyIdx = 0;

  start() {
    if (this.started) return;
    this.started = true;

    // Register so api.ts can push events through the same listeners
    registerTrigger((msg) => this.emit(msg));

    // Presence simulator — fires every 15–35 s
    const firePresence = () => {
      const acc = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
      const contacts = getContactsByAccount(acc.id);
      if (!contacts.length) return;
      const contact = contacts[Math.floor(Math.random() * contacts.length)];
      const now = NOW();
      const state: "available" | "unavailable" = Math.random() > 0.45 ? "available" : "unavailable";

      addTimelineEntry(acc.id, contact.id, {
        kind: "presence",
        at: now,
        state,
        ...(state === "unavailable" ? { lastSeen: now } : {}),
      });

      this.emit({
        type: "presence",
        accountId: acc.id,
        contactId: contact.id,
        jid: contact.jid,
        state,
        observedAt: now,
        ...(state === "unavailable" ? { lastSeen: now } : {}),
      });

      setTimeout(firePresence, 15_000 + Math.random() * 20_000);
    };

    // Incoming-message simulator — fires every 45–90 s
    const fireMessage = () => {
      const acc = ACCOUNTS[0]; // always account 1 for incoming demo messages
      const contacts = getContactsByAccount(acc.id);
      if (!contacts.length) return;
      const contact = contacts[Math.floor(Math.random() * contacts.length)];
      const now = NOW();
      const text = AUTO_REPLIES[this.replyIdx % AUTO_REPLIES.length];
      this.replyIdx++;

      const msgId = `ws_msg_${Date.now()}`;
      addMessage(acc.id, contact.id, {
        id: Date.now(),
        accountId: acc.id,
        contactId: contact.id,
        chatJid: contact.jid,
        messageId: msgId,
        senderJid: contact.jid,
        isFromMe: false,
        timestamp: now,
        text,
        receivedAt: now,
      });

      this.emit({
        type: "message",
        accountId: acc.id,
        contactId: contact.id,
        chatJid: contact.jid,
        messageId: msgId,
        from: contact.jid,
        isFromMe: false,
        text,
        timestamp: now,
      });

      setTimeout(fireMessage, 45_000 + Math.random() * 45_000);
    };

    // Stagger the first fires so the UI has time to mount
    setTimeout(firePresence, 8_000);
    setTimeout(fireMessage, 35_000);
  }

  private emit(msg: WSEnvelope) {
    this.listeners.forEach((l) => l(msg));
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const ws = new MockWSHub();
