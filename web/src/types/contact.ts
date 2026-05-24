export interface Contact {
  id: number;
  jid: string;
  phone: string;
  displayName: string;
  addedAt: number;
  trackingEnabled: boolean;
  latestPicturePath?: string;
}

export interface ContactsPage {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}
