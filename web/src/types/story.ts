export interface Story {
  id: number;
  accountId: number;
  contactId?: number;
  senderJid: string;
  storyId: string;
  mediaType?: string;
  mediaPath?: string;
  caption?: string;
  postedAt: number;
  receivedAt: number;
}
