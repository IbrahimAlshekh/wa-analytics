package analytics

import (
	"testing"
	"time"
)

var ts2025 = time.Date(2025, 5, 10, 14, 30, 0, 0, time.Local)   // 14:00 → not night
var tsNight = time.Date(2025, 5, 10, 23, 0, 0, 0, time.Local)   // 23:00 → night

func TestExtractFeatures_EmptyText(t *testing.T) {
	f := ExtractFeatures("", ts2025)
	if f.WordCount != 0 || f.CharCount != 0 || f.HasQuestion || f.HasLaughter {
		t.Errorf("ExtractFeatures(empty): unexpected non-zero fields %+v", f)
	}
}

func TestExtractFeatures_WordCount(t *testing.T) {
	f := ExtractFeatures("بحبك بحبكي كتير", ts2025)
	if f.WordCount != 3 {
		t.Errorf("WordCount: got %d, want 3", f.WordCount)
	}
}

func TestExtractFeatures_LoveCount(t *testing.T) {
	// "بحبك بحبك" contains the love keyword twice — counts should be 2.
	f := ExtractFeatures("بحبك بحبك", ts2025)
	if f.EmotionCounts[CatLove] != 2 {
		t.Errorf("EmotionCounts[love]: got %d, want 2", f.EmotionCounts[CatLove])
	}
	if f.EmotionMask&(1<<CatLove) == 0 {
		t.Error("EmotionMask: love bit not set")
	}
}

func TestExtractFeatures_SorryCount(t *testing.T) {
	f := ExtractFeatures("اسف جداً اسف", ts2025)
	if f.EmotionCounts[CatApology] != 2 {
		t.Errorf("EmotionCounts[apology]: got %d, want 2", f.EmotionCounts[CatApology])
	}
}

func TestExtractFeatures_MultiCategory(t *testing.T) {
	// Message with both love and miss keywords (standalone forms — Arabic conjunctions
	// like "و" are written attached to words in casual Arabic but our tokenizer splits
	// only on non-letter boundaries; the lexicon covers the bare stems).
	f := ExtractFeatures("بحبك اشتقتلك", ts2025)
	if f.EmotionCounts[CatLove] == 0 {
		t.Error("expected love count > 0")
	}
	if f.EmotionCounts[CatMiss] == 0 {
		t.Error("expected miss count > 0")
	}
}

func TestExtractFeatures_NightFlag(t *testing.T) {
	fDay := ExtractFeatures("hello", ts2025)
	if fDay.IsNightMsg {
		t.Errorf("14:00 should not be night (got IsNightMsg=true)")
	}
	fNight := ExtractFeatures("hello", tsNight)
	if !fNight.IsNightMsg {
		t.Errorf("23:00 should be night (got IsNightMsg=false)")
	}
}

func TestExtractFeatures_Question(t *testing.T) {
	f := ExtractFeatures("كيف حالك؟", ts2025)
	if !f.HasQuestion {
		t.Error("expected HasQuestion=true for Arabic question mark")
	}
}

func TestExtractFeatures_Laughter(t *testing.T) {
	f := ExtractFeatures("هههههه كتير ضحكتني", ts2025)
	if !f.HasLaughter {
		t.Error("expected HasLaughter=true")
	}
}

func TestExtractFeatures_URLDomains(t *testing.T) {
	f := ExtractFeatures("شوف هاد https://youtu.be/abc", ts2025)
	if len(f.URLDomains) != 1 || f.URLDomains[0] != "YouTube" {
		t.Errorf("URLDomains: got %v, want [YouTube]", f.URLDomains)
	}
}

func TestExtractFeatures_HourAndDow(t *testing.T) {
	// ts2025 is 14:30 on a Saturday (2025-05-10).
	f := ExtractFeatures("test", ts2025)
	if f.HourLocal != 14 {
		t.Errorf("HourLocal: got %d, want 14", f.HourLocal)
	}
	if f.DowLocal != int(ts2025.Weekday()) {
		t.Errorf("DowLocal: got %d, want %d", f.DowLocal, int(ts2025.Weekday()))
	}
}
