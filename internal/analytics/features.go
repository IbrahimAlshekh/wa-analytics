package analytics

import (
	"time"
	"unicode/utf8"
)

// MessageFeatures holds all analytics-relevant features derived from a single message.
// It contains only computed data — no DB state. Fields are cheap to allocate and
// safe for concurrent read access after construction.
type MessageFeatures struct {
	WordCount     int
	CharCount     int
	HasQuestion   bool
	HasLaughter   bool
	Emojis        []string       // all emoji clusters, may contain repeats
	Words         []string       // all tokens (min 2 runes), may contain repeats
	URLDomains    []string       // deduplicated canonical domain labels
	EmotionMask   int            // bitmask of categories present (1<<CatLove etc.)
	EmotionCounts [NumCategories]int // occurrence counts per category
	HourLocal     int            // 0–23, server local TZ
	DowLocal      int            // 0=Sunday, 6=Saturday, server local TZ
	IsNightMsg    bool           // true when HourLocal in [22,23,0,1,2,3]
}

// ExtractFeatures derives analytics features from a message's text and timestamp.
// mediaType is passed separately so it can be used by the DB layer for media counters
// without embedding it here (it's already stored on the Message struct).
func ExtractFeatures(text string, ts time.Time) MessageFeatures {
	var f MessageFeatures

	h := ts.Hour()
	f.HourLocal = h
	f.DowLocal = int(ts.Weekday())
	f.IsNightMsg = h >= 22 || h <= 3

	if text == "" {
		return f
	}

	f.CharCount = utf8.RuneCountInString(text)
	f.Emojis = ExtractEmojis(text)
	f.URLDomains = ExtractDomains(text)
	f.HasQuestion = HasQuestion(text)
	f.HasLaughter = HasLaughter(f.Emojis, text)
	f.Words = Tokenize(text)
	f.WordCount = len(f.Words)

	for _, tok := range f.Words {
		if cats, ok := keywordToCategories[tok]; ok {
			for _, cat := range cats {
				f.EmotionCounts[cat]++
				f.EmotionMask |= 1 << cat
			}
		}
	}

	return f
}
