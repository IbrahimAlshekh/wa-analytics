import type {
  Account,
  AccountSchedule,
  AnalyticsReport,
  Contact,
  Message,
  Story,
  TimelineEntry,
} from "./types";

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function seedRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export const NOW = () => Math.floor(Date.now() / 1000);
const DAY = 86400;

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const ACCOUNTS: Account[] = [
  {
    id: 1,
    jid: "491711100001@s.whatsapp.net",
    label: "Personal",
    trackingActive: true,
    connected: true,
    createdAt: NOW() - 90 * DAY,
  },
  {
    id: 2,
    jid: "491711100002@s.whatsapp.net",
    label: "Work",
    trackingActive: true,
    connected: true,
    createdAt: NOW() - 60 * DAY,
  },
];

// ─── Contacts ─────────────────────────────────────────────────────────────────

function mkContact(
  id: number,
  phone: string,
  displayName: string,
  daysAgo: number,
): Contact {
  return {
    id,
    jid: `${phone}@s.whatsapp.net`,
    phone,
    displayName,
    addedAt: NOW() - daysAgo * DAY,
    trackingEnabled: true,
  };
}

const BASE_CONTACTS: Record<number, Contact[]> = {
  1: [
    mkContact(1, "491730100001", "Sara Müller", 45),
    mkContact(2, "491730100002", "سارة الأحمد", 42),
    mkContact(3, "491730100003", "Lucas Weber", 38),
    mkContact(4, "491730100004", "محمد العلي", 35),
    mkContact(5, "491730100005", "Emma Schmidt", 30),
    mkContact(6, "491730100006", "فاطمة الحسن", 28),
    mkContact(7, "491730100007", "Jonas Fischer", 20),
    mkContact(8, "491730100008", "Lena Becker", 15),
  ],
  2: [
    mkContact(9, "491730100009", "Stefan Braun", 50),
    mkContact(10, "491730100010", "خالد المنصور", 42),
    mkContact(11, "491730100011", "Anna Koch", 30),
    mkContact(12, "491730100012", "يوسف إبراهيم", 25),
    mkContact(13, "491730100013", "Max Richter", 18),
  ],
};

// Mutable copy — mutations operate here
export const CONTACTS: Record<number, Contact[]> = {
  1: BASE_CONTACTS[1].map((c) => ({ ...c })),
  2: BASE_CONTACTS[2].map((c) => ({ ...c })),
};

export function getAllContacts(): Contact[] {
  return Object.values(CONTACTS).flat();
}

export function getContactsByAccount(accountId: number): Contact[] {
  return CONTACTS[accountId] ?? [];
}

export function nextContactId(): number {
  return Math.max(0, ...getAllContacts().map((c) => c.id)) + 1;
}

// ─── Message pools ────────────────────────────────────────────────────────────

// [text, isFromMe]
const MSG_POOLS: Record<number, [string, boolean][]> = {
  // Sara Müller — cheerful English
  1: [
    ["Hey! How's it going? 😊", false],
    ["Really well, thanks! How about you?", true],
    ["Pretty good! Did you see the game last night?", false],
    ["Yes!! What a match 🎉", true],
    ["Are you free this weekend?", false],
    ["Saturday works for me, what did you have in mind?", true],
    ["Let's go to that new café downtown", false],
    ["Love that idea! 3pm?", true],
    ["Perfect, see you then!", false],
    ["Can't wait 😁", true],
    ["By the way, did you finish that book?", false],
    ["Almost! It gets really good in the last third", true],
    ["I told you! The ending is wild", false],
    ["No spoilers please 😂", true],
    ["You'll love it, just finish it!", false],
    ["Okay okay. Did you send the link to the playlist?", true],
    ["Just sent it!", false],
    ["Thanks, you're the best ❤️", true],
    ["Anytime! Talk soon", false],
    ["Take care! 👋", true],
    ["Hey are you coming tomorrow?", false],
    ["Yes! Wouldn't miss it", true],
    ["Great, I'll save you a seat", false],
    ["You're amazing 😊", true],
    ["See you at 7!", false],
    ["See you there!", true],
    ["Running 10 min late, sorry!", false],
    ["No worries, take your time", true],
    ["Thanks for being patient 🙏", false],
    ["Always 😊", true],
  ],
  // سارة الأحمد — Arabic conversation
  2: [
    ["السلام عليكم ورحمة الله", false],
    ["وعليكم السلام ورحمة الله وبركاته ❤️", true],
    ["كيف حالك؟ اشتقت لك كثيراً", false],
    ["بخير الحمد لله، وأنتِ؟ أنا أيضاً اشتقت", true],
    ["تمام الحمد لله، هل أنتِ متاحة غداً؟", false],
    ["إن شاء الله، ماذا تريدين؟", true],
    ["أريد أن نقابل بعض ونتحدث", false],
    ["بكل سرور! في أي وقت؟", true],
    ["العاشرة صباحاً؟", false],
    ["تمام، إن شاء الله سأكون هناك", true],
    ["ممتاز! كم اشتقت للقائك", false],
    ["وأنا أيضاً 😊", true],
    ["هل سمعتِ الأخبار؟", false],
    ["لا، ماذا حدث؟", true],
    ["شيء رائع، سأخبرك عندما نلتقي", false],
    ["لا تتركيني بالتشويق هكذا! 😂", true],
    ["هههههه، سأخبرك غداً إن شاء الله", false],
    ["حسناً حسناً 😄", true],
    ["أرسلي لي العنوان من فضلك", false],
    ["تفضلي، أرسلته على الواتساب", true],
    ["شكراً جزيلاً يا حبيبتي", false],
    ["العفو، في أي خدمة 💕", true],
    ["كيف حال الأسرة؟", false],
    ["بخير والحمد لله، جميعهم يسلمون عليكِ", true],
    ["سلّميهم مني وقولي لهم اشتقت", false],
    ["سأفعل إن شاء الله ❤️", true],
    ["إلى اللقاء غداً", false],
    ["إلى اللقاء، تصبحي على خير", true],
  ],
  // Lucas — dev-oriented English
  3: [
    ["Hey, got a sec?", true],
    ["Sure! What's up?", false],
    ["I'm getting a weird error in the build pipeline", true],
    ["What's the error message?", false],
    ["Something about a missing env variable in CI", true],
    ["Did you add it to the secrets in GitHub?", false],
    ["Oh… no 😅 doing that now", true],
    ["That'll fix it!", false],
    ["You're a lifesaver 🙏", true],
    ["No problem! Let me know if it builds", false],
    ["Built! 🎉 You genius", true],
    ["Classic 😄", false],
    ["Are you joining the standup at 10?", true],
    ["Yes, be there!", false],
    ["Should we demo the new feature?", true],
    ["Absolutely, it looks great!", false],
    ["Thanks, took a while but happy with it", true],
    ["The team will love it", false],
    ["Hope so! Talk in a bit", true],
    ["👍", false],
    ["Can you review my PR when you get a chance?", true],
    ["Just approved it, left a couple of comments", false],
    ["Good points, updating now", true],
    ["Looks good to me!", false],
    ["Merging 🚀", true],
    ["Nice! Deploying to staging?", false],
    ["On it now", true],
    ["Let me know when it's live", false],
    ["Done, check it out!", true],
    ["Looks perfect 👌", false],
  ],
  // محمد العلي — mixed Arabic/English
  4: [
    ["هلا والله! كيف الأحوال؟", false],
    ["هلا بك! بخير والحمد لله", true],
    ["شو جديد؟", false],
    ["والله ما في جديد كثير، الحياة عادية 😄", true],
    ["هههه، أنا كذلك", false],
    ["متى ترجع؟", false],
    ["الأسبوع الجاي إن شاء الله", true],
    ["أوه nice! لازم نتقابل", false],
    ["بالتأكيد، بس خبرني وقتك", true],
    ["أي وقت تحدد أنت", false],
    ["طيب الخميس مساء؟", true],
    ["تمام! وين نقابل؟", false],
    ["المقهى القديم؟", true],
    ["Perfect, ما شاء الله", false],
    ["عال العال 😊", true],
    ["لا تنسى يا رجل", false],
    ["كيف أنسى! 😂", true],
    ["كيف الشغل؟", false],
    ["الحمد لله، busy بس زين", true],
    ["زين، keep it up!", false],
    ["شكراً، وأنت كيف؟", true],
    ["الحمد لله خير", false],
    ["دام الخير", true],
    ["بشرك بشيء", false],
    ["شو؟ قول!", true],
    ["ما أقول لك هههه، بكره تعرف", false],
    ["لا والله ما أصبر! 😂", true],
    ["هههه، الوقت يجي 😄", false],
  ],
  // Emma Schmidt — English
  5: [
    ["Hey Emma! Hope you're doing well 😊", true],
    ["Doing great, thanks! You?", false],
    ["Really good! Busy week though", true],
    ["Same here! Are you coming to the event Friday?", false],
    ["Yes, wouldn't miss it!", true],
    ["Perfect! Should be a great evening", false],
    ["Agreed! Do we need to bring anything?", true],
    ["Just yourselves 😊", false],
    ["Easy enough! See you there", true],
    ["Looking forward to it!", false],
    ["Quick question — do you know a good restaurant nearby?", true],
    ["There's a lovely Italian place two blocks from the venue", false],
    ["Oh perfect! What's it called?", true],
    ["La Piazza — highly recommend the pasta", false],
    ["Noted! Thank you so much 🙏", true],
    ["Anytime! Say hi to everyone for me", false],
    ["Will do!", true],
    ["How did the presentation go?", false],
    ["Really well actually! They loved the concept", true],
    ["That's amazing, congratulations! 🎉", false],
    ["Thanks! Couldn't have done it without the team", true],
    ["You're too humble 😄", false],
    ["Haha, maybe a little 😂", true],
    ["Talk soon!", false],
    ["Absolutely, take care!", true],
  ],
  // فاطمة الحسن — Arabic
  6: [
    ["أهلاً فاطمة! كيف حالك؟", true],
    ["أهلاً وسهلاً! بخير الحمد لله، وأنتِ؟", false],
    ["تمام شكراً ❤️", true],
    ["هل أنهيتِ المشروع؟", false],
    ["نعم أخيراً! كان صعباً جداً", true],
    ["ماشاء الله! أنتِ دائماً مميزة", false],
    ["شكراً لك، أنتِ تحفزينني", true],
    ["هذا واجبي 😊", false],
    ["هل تريدين مني أن أراجعه؟", false],
    ["لو سمحتِ، سأكون ممتنة جداً", true],
    ["أرسليه لي الآن", false],
    ["إليكِ! شكراً جزيلاً", true],
    ["قرأته، رائع جداً! ملاحظة بسيطة فقط", false],
    ["قوليها من فضلك", true],
    ["الصفحة الثالثة، الفقرة الثانية", false],
    ["آه فهمت، سأعدلها", true],
    ["عدلتها، هل هكذا أفضل؟", true],
    ["ممتاز! الآن مثالي", false],
    ["الله يبارك فيكِ", true],
    ["وفيكِ، بالتوفيق يا حبيبتي 💕", false],
    ["إلى اللقاء قريباً إن شاء الله", true],
    ["إن شاء الله، سلامتكِ", false],
  ],
  // Jonas Fischer — casual English
  7: [
    ["Jonas! Long time no speak!", true],
    ["I know! How've you been?", false],
    ["Great! Moving to a new place next month", true],
    ["Oh nice! Where?", false],
    ["Just closer to the centre, finally!", true],
    ["That's the dream! Need any help moving?", false],
    ["Would love that if you're free?", true],
    ["Just say the date and I'm there!", false],
    ["14th of next month?", true],
    ["Done, put it in the calendar", false],
    ["You're a legend 🙏", true],
    ["What are friends for! 😄", false],
    ["Did you try that new ramen place?", true],
    ["Not yet! Is it good?", false],
    ["Incredible. Best ramen I've had in years", true],
    ["Okay I need to go this week", false],
    ["Let's go together!", true],
    ["Yes! Wednesday evening?", false],
    ["Perfect. 7pm?", true],
    ["It's a plan 🍜", false],
    ["Can't wait!", true],
  ],
  // Lena Becker — English
  8: [
    ["Hi Lena! How are you?", true],
    ["Hey! I'm good, thanks! You?", false],
    ["Doing well! Did you see my message yesterday?", true],
    ["Sorry, was swamped! What's up?", false],
    ["Just wondering if you got the invitation?", true],
    ["Yes! I'm coming for sure 😊", false],
    ["Yay! It'll be so much fun", true],
    ["I know! What time does it start?", false],
    ["7pm, but people arrive from 6:30", true],
    ["Great, I'll be there at 6:30 then", false],
    ["Perfect! 🎉", true],
    ["Do I need to bring anything?", false],
    ["Just yourself! We have everything covered", true],
    ["You're so thoughtful ❤️", false],
    ["Of course! See you then", true],
  ],
  // Stefan Braun — Work English
  9: [
    ["Stefan, do you have the Q3 report ready?", true],
    ["Almost! Sending it by noon", false],
    ["Great, the meeting is at 2pm", true],
    ["I'll have it to you well before that", false],
    ["Thanks. Also, client called this morning", true],
    ["Which one?", false],
    ["Hoffmann Industries. They want to reschedule Thursday", true],
    ["I'll reach out and propose next week", false],
    ["Perfect, please copy me on that email", true],
    ["Will do. Anything else?", false],
    ["That's it for now, thanks Stefan", true],
    ["No problem!", false],
    ["Report sent! Check your inbox", false],
    ["Got it, reviewing now", true],
    ["Looks solid. Well done!", true],
    ["Appreciate it 👍", false],
    ["See you at 2", true],
    ["I'll be there.", false],
  ],
  // خالد المنصور — Work Arabic
  10: [
    ["صباح الخير خالد", true],
    ["صباح النور، كيف حالك؟", false],
    ["بخير الحمد لله، هل راجعت العرض؟", true],
    ["نعم، راجعته. ممتاز!", false],
    ["هل لديك أي ملاحظات؟", true],
    ["ملاحظة بسيطة في الصفحة الخامسة", false],
    ["ما هي؟", true],
    ["الأرقام لا تتطابق مع التقرير السابق", false],
    ["شكراً، سأراجعها وأرسل نسخة محدثة", true],
    ["ممتاز، اتصل بي إذا احتجت مساعدة", false],
    ["بإذن الله، شكراً خالد", true],
    ["على الرحب والسعة", false],
    ["هل موعد الاجتماع لا يزال الخميس؟", true],
    ["نعم، الساعة العاشرة صباحاً", false],
    ["حسناً، سأكون حاضراً إن شاء الله", true],
    ["بالتوفيق 👍", false],
  ],
  // Anna Koch — Work English
  11: [
    ["Hi Anna, just checking in on the project status", true],
    ["Hi! We're on track, should deliver by Thursday", false],
    ["That's great to hear!", true],
    ["One small dependency on legal approval though", false],
    ["I'll nudge them now", true],
    ["Thank you, that would really help", false],
    ["Done, they said by tomorrow EOD", true],
    ["Perfect! Then we're fine", false],
    ["Great. Let me know if you need anything", true],
    ["Will do, thanks!", false],
    ["The legal approval came through!", false],
    ["Excellent! Full steam ahead then", true],
    ["Absolutely 🚀", false],
    ["See you at the review meeting", true],
    ["Looking forward to it!", false],
  ],
  // يوسف إبراهيم — mix
  12: [
    ["يوسف، صباح الخير!", true],
    ["صباح الخير! كيف الأحوال؟", false],
    ["الحمد لله، هل أنهيت العقد؟", true],
    ["نعم، أرسلته بالبريد الإلكتروني", false],
    ["وصلني، سأراجعه اليوم", true],
    ["ممتاز، أي استفسار لا تتردد", false],
    ["شكراً يوسف", true],
    ["بخدمتكم دائماً 😊", false],
    ["هل ستكون في المؤتمر القادم؟", true],
    ["نعم بإذن الله، وأنت؟", false],
    ["كذلك، سنلتقي هناك", true],
    ["تمام، بالتوفيق للجميع", false],
  ],
  // Max Richter — casual work English
  13: [
    ["Hey Max, quick question", true],
    ["Sure, shoot!", false],
    ["Did you push the latest config to staging?", true],
    ["Just did it 5 mins ago", false],
    ["Ah great, I was looking at the wrong branch 😅", true],
    ["Haha happens to the best of us!", false],
    ["Thanks for the quick reply", true],
    ["Always! You good otherwise?", false],
    ["Yeah, just a busy sprint", true],
    ["Same! Almost at the finish line though", false],
    ["Can't wait for the release 🚀", true],
    ["Friday can't come soon enough!", false],
    ["Agreed! Talk soon", true],
    ["👍", false],
  ],
};

// ─── Message cache ─────────────────────────────────────────────────────────────

const _msgCache: Record<string, Message[]> = {};

export function getMessages(accountId: number, contactId: number): Message[] {
  const key = `${accountId}:${contactId}`;
  if (_msgCache[key]) return _msgCache[key];

  const contact = getAllContacts().find((c) => c.id === contactId);
  if (!contact) return (_msgCache[key] = []);

  const pool = MSG_POOLS[contactId] ?? MSG_POOLS[1];
  const rng = seedRng(contactId * 3137 + accountId * 7);
  const r = (a: number, b: number) => Math.floor(a + rng() * (b - a));
  const account = ACCOUNTS.find((a) => a.id === accountId);

  const msgs: Message[] = [];
  const targetCount = 30 + r(0, 40); // 30–70 messages
  let t = NOW() - 30 * DAY;

  for (let i = 0; i < targetCount; i++) {
    // Naturalistic gap: 10 min to 4 hr, with bursts (2 quick replies)
    const gap = i % 3 === 2 ? r(600, 1800) : r(60, 300);
    t += gap;
    if (t > NOW()) break;

    const [text, isFromMe] = pool[i % pool.length];
    msgs.push({
      id: contactId * 10000 + accountId * 1000 + i,
      accountId,
      contactId,
      chatJid: contact.jid,
      messageId: `msg_${contactId}_${accountId}_${i}`,
      senderJid: isFromMe ? (account?.jid ?? "") : contact.jid,
      isFromMe,
      timestamp: t,
      text,
      receivedAt: t + 1,
    });
  }

  return (_msgCache[key] = msgs);
}

export function addMessage(accountId: number, contactId: number, msg: Message) {
  const key = `${accountId}:${contactId}`;
  if (!_msgCache[key]) getMessages(accountId, contactId);
  _msgCache[key].push(msg);
}

// ─── Timeline cache ────────────────────────────────────────────────────────────

const _tlCache: Record<string, TimelineEntry[]> = {};

export function getTimelineEntries(accountId: number, contactId: number): TimelineEntry[] {
  const key = `${accountId}:${contactId}`;
  if (_tlCache[key]) return _tlCache[key];

  const rng = seedRng(contactId * 7919 + accountId * 31);
  const r = (a: number, b: number) => Math.floor(a + rng() * (b - a));
  const entries: TimelineEntry[] = [];
  const base = NOW();

  // Presence events — 2 to 5 sessions/day for the last 30 days
  for (let d = 30; d >= 0; d--) {
    const dayStart = base - d * DAY;
    const sessions = 2 + r(0, 4);
    for (let s = 0; s < sessions; s++) {
      const hourOffset = r(7, 23) * 3600 + r(0, 3600);
      const onAt = dayStart + hourOffset;
      if (onAt > base) continue;
      const dur = r(120, 3600); // 2 min – 1 hr online
      entries.push({ kind: "presence", at: onAt, state: "available" });
      const offAt = Math.min(onAt + dur, base);
      entries.push({ kind: "presence", at: offAt, state: "unavailable", lastSeen: offAt });
    }
  }

  // Two "about" changes
  entries.push({ kind: "about", at: base - 20 * DAY, text: "Available 🌟" });
  entries.push({ kind: "about", at: base - 5 * DAY, text: "Busy with work 💼" });

  // One picture change
  entries.push({ kind: "picture", at: base - 10 * DAY, pictureId: "pic_demo_001" });

  // Message entries from the messages cache (just a handful for the timeline)
  const msgs = getMessages(accountId, contactId);
  for (const m of msgs.slice(-8)) {
    entries.push({
      kind: "message",
      at: m.timestamp,
      isFromMe: m.isFromMe,
      text: m.text,
      mediaType: m.mediaType,
    });
  }

  entries.sort((a, b) => a.at - b.at);
  return (_tlCache[key] = entries);
}

export function addTimelineEntry(accountId: number, contactId: number, entry: TimelineEntry) {
  const key = `${accountId}:${contactId}`;
  if (!_tlCache[key]) getTimelineEntries(accountId, contactId);
  _tlCache[key].push(entry);
}

// ─── Schedules ─────────────────────────────────────────────────────────────────

export const SCHEDULES: Record<number, AccountSchedule> = {
  1: { forceOffline: false, slots: [{ id: 1, startMin: 480, endMin: 1200 }] },
  2: { forceOffline: false, slots: [{ id: 2, startMin: 540, endMin: 1080 }] },
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const STORIES: Record<string, Story[]> = {
  "1:1": [
    {
      id: 1,
      accountId: 1,
      contactId: 1,
      senderJid: "491730100001@s.whatsapp.net",
      storyId: "story_1_1",
      caption: "Beautiful morning ☀️",
      postedAt: NOW() - 3600 * 4,
      receivedAt: NOW() - 3600 * 4 + 30,
    },
    {
      id: 2,
      accountId: 1,
      contactId: 1,
      senderJid: "491730100001@s.whatsapp.net",
      storyId: "story_1_2",
      caption: "Coffee and good vibes ☕",
      postedAt: NOW() - DAY,
      receivedAt: NOW() - DAY + 30,
    },
  ],
  "1:2": [
    {
      id: 3,
      accountId: 1,
      contactId: 2,
      senderJid: "491730100002@s.whatsapp.net",
      storyId: "story_2_1",
      caption: "يوم جميل 🌸",
      postedAt: NOW() - 3600 * 6,
      receivedAt: NOW() - 3600 * 6 + 30,
    },
  ],
  "1:4": [
    {
      id: 4,
      accountId: 1,
      contactId: 4,
      senderJid: "491730100004@s.whatsapp.net",
      storyId: "story_4_1",
      caption: "الحمد لله على كل شيء 🤲",
      postedAt: NOW() - 3600 * 10,
      receivedAt: NOW() - 3600 * 10 + 30,
    },
  ],
  "2:10": [
    {
      id: 5,
      accountId: 2,
      contactId: 10,
      senderJid: "491730100010@s.whatsapp.net",
      storyId: "story_10_1",
      caption: "اجتماع منتج اليوم 💼",
      postedAt: NOW() - 3600 * 3,
      receivedAt: NOW() - 3600 * 3 + 30,
    },
  ],
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const _analyticsCache: Record<string, AnalyticsReport> = {};

export function getAnalytics(accountId: number, contactId: number, range: string): AnalyticsReport {
  const key = `${accountId}:${contactId}:${range}`;
  if (_analyticsCache[key]) return _analyticsCache[key];

  const rng = seedRng(contactId * 5381 + accountId * 97 + range.length * 31);
  const r = (a: number, b: number) => Math.floor(a + rng() * (b - a));

  const meTotal = r(200, 700);
  const themTotal = r(200, 700);
  const base = NOW();

  const peaksMe = [9, 12, 18, 21];
  const peaksThem = [10, 13, 17, 22];
  const hourHistMe = Array.from({ length: 24 }, (_, h) =>
    peaksMe.includes(h) ? r(20, 55) : r(1, 12),
  );
  const hourHistThem = Array.from({ length: 24 }, (_, h) =>
    peaksThem.includes(h) ? r(20, 55) : r(1, 12),
  );

  const report: AnalyticsReport = {
    range: range as AnalyticsReport["range"],
    startUnix: base - 30 * DAY,
    endUnix: base,
    timeline: {
      firstMsgUnix: base - 60 * DAY,
      lastMsgUnix: base - 3600,
      spanDays: 60,
      daysWithComms: r(32, 56),
      longestStreakDays: r(5, 18),
      highestVolumeDayDate: "2025-04-15",
      highestVolumeDayCount: r(25, 75),
    },
    volume: {
      me: {
        messages: meTotal,
        words: meTotal * r(8, 14),
        avgWordsPerMsg: r(8, 14),
        voiceNotes: r(5, 25),
        photos: r(10, 45),
        videos: r(2, 12),
        stickers: r(5, 35),
        documents: r(0, 8),
        links: r(5, 18),
        questions: r(10, 35),
        sharePct: Math.round((meTotal / (meTotal + themTotal)) * 100),
      },
      them: {
        messages: themTotal,
        words: themTotal * r(8, 14),
        avgWordsPerMsg: r(8, 14),
        voiceNotes: r(5, 25),
        photos: r(10, 45),
        videos: r(2, 12),
        stickers: r(5, 35),
        documents: r(0, 8),
        links: r(5, 18),
        questions: r(10, 35),
        sharePct: Math.round((themTotal / (meTotal + themTotal)) * 100),
      },
    },
    temporal: {
      hourHistMe,
      hourHistThem,
      dowMe: [r(15, 50), r(40, 75), r(40, 75), r(40, 75), r(40, 75), r(25, 60), r(15, 45)],
      dowThem: [r(15, 50), r(40, 75), r(40, 75), r(40, 75), r(40, 75), r(25, 60), r(15, 45)],
      nightPctMe: r(10, 28),
      nightPctThem: r(12, 32),
      monthly: [
        { month: "2024-12", me: r(50, 140), them: r(50, 140), total: r(100, 280), meSharePct: r(40, 60) },
        { month: "2025-01", me: r(60, 160), them: r(60, 160), total: r(120, 320), meSharePct: r(40, 60) },
        { month: "2025-02", me: r(55, 150), them: r(55, 150), total: r(110, 300), meSharePct: r(40, 60) },
        { month: "2025-03", me: r(60, 160), them: r(60, 160), total: r(120, 320), meSharePct: r(40, 60) },
        { month: "2025-04", me: r(65, 170), them: r(65, 170), total: r(130, 340), meSharePct: r(40, 60) },
        { month: "2025-05", me: r(30, 90), them: r(30, 90), total: r(60, 180), meSharePct: r(40, 60) },
      ],
    },
    emotion: {
      countsMe: {
        love: r(5, 28), miss: r(2, 14), happy: r(10, 45), sad: r(1, 8),
        care: r(5, 18), encourage: r(3, 14), apology: r(1, 7), gratitude: r(10, 38),
      },
      countsThem: {
        love: r(5, 28), miss: r(2, 14), happy: r(10, 45), sad: r(1, 8),
        care: r(5, 18), encourage: r(3, 14), apology: r(1, 7), gratitude: r(10, 38),
      },
      laughterMsgsMe: r(20, 75),
      laughterMsgsThem: r(20, 75),
      questionsMe: r(10, 38),
      questionsThem: r(10, 38),
    },
    initiation: {
      initiatedMe: r(30, 95),
      initiatedThem: r(30, 95),
      initiationMeSharePct: r(40, 62),
      avgRespMeSec: r(120, 850),
      avgRespThemSec: r(60, 580),
      medianRespMeSec: r(60, 580),
      medianRespThemSec: r(30, 280),
      sessions: r(50, 190),
      avgSessionMsgs: r(4, 11),
      longestSilenceSec: r(DAY, DAY * 4),
      avgSilenceSec: r(3600, DAY),
      medianRespAllSec: r(60, 280),
    },
    language: {
      topEmojisMe: [
        { token: "😊", count: r(20, 55) },
        { token: "❤️", count: r(10, 38) },
        { token: "😂", count: r(8, 32) },
        { token: "🙏", count: r(5, 22) },
        { token: "👍", count: r(5, 20) },
      ],
      topEmojisThem: [
        { token: "😊", count: r(20, 55) },
        { token: "😍", count: r(10, 38) },
        { token: "🙏", count: r(8, 30) },
        { token: "❤️", count: r(5, 25) },
        { token: "😁", count: r(5, 20) },
      ],
      topWordsMe: [
        { token: "thanks", count: r(20, 55) },
        { token: "great", count: r(15, 40) },
        { token: "sure", count: r(10, 32) },
        { token: "perfect", count: r(8, 28) },
        { token: "absolutely", count: r(5, 20) },
      ],
      topWordsThem: [
        { token: "okay", count: r(20, 55) },
        { token: "yes", count: r(15, 40) },
        { token: "love", count: r(10, 32) },
        { token: "amazing", count: r(8, 28) },
        { token: "definitely", count: r(5, 20) },
      ],
      topDomainsMe: [
        { token: "github.com", count: r(3, 10) },
        { token: "youtube.com", count: r(2, 8) },
      ],
      topDomainsThem: [
        { token: "instagram.com", count: r(3, 10) },
        { token: "x.com", count: r(2, 8) },
      ],
    },
    indicators: {
      wordBalancePct: r(40, 62),
      msgBalancePct: Math.round((meTotal / (meTotal + themTotal)) * 100),
      dailyConsistencyPct: r(62, 92),
      medianRespAllSec: r(60, 280),
      initiationMePct: r(40, 62),
      syncLaughDays: r(5, 20),
      totalQuestions: r(22, 78),
      totalLaughter: r(32, 115),
      meShareTrendPct: r(-5, 5),
    },
  };

  return (_analyticsCache[key] = report);
}
