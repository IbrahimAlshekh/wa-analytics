export interface Message {
  id: number;
  accountId: number;
  contactId?: number;
  chatJid: string;
  messageId: string;
  senderJid: string;
  isFromMe: boolean;
  timestamp: number;
  text?: string;
  mediaType?: string;
  mediaPath?: string;
  receivedAt: number;
  quotedMessageId?: string;
}

export interface MessageEvent {
  id: number;
  accountId: number;
  contactId?: number;
  targetMessageId: string;
  kind: "reaction" | "delete" | "edit";
  actorJid: string;
  isFromMe: boolean;
  emoji?: string;
  newText?: string;
  observedAt: number;
}

export interface MessagesPage {
  messages: Message[];
  events: MessageEvent[];
}
