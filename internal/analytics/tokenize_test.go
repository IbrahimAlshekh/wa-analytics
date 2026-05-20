package analytics

import (
	"reflect"
	"testing"
)

func TestTokenize_ArabicDiacritics(t *testing.T) {
	// Diacritics (harakat) between Arabic letters should be stripped so that
	// "كِتَابٌ" tokenizes the same as "كتاب".
	got := Tokenize("كِتَابٌ")
	want := []string{"كتاب"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tokenize(diacritics) = %v, want %v", got, want)
	}
}

func TestTokenize_Tatweel(t *testing.T) {
	// Tatweel (kashida, U+0640) stretches letters visually and must be stripped.
	got := Tokenize("بحـبك")
	want := []string{"بحبك"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tokenize(tatweel) = %v, want %v", got, want)
	}
}

func TestTokenize_ASCIILowercase(t *testing.T) {
	got := Tokenize("Hello World")
	want := []string{"hello", "world"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tokenize(ASCII) = %v, want %v", got, want)
	}
}

func TestTokenize_MinLength(t *testing.T) {
	// Single-rune tokens should be discarded.
	got := Tokenize("a b c ok")
	want := []string{"ok"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tokenize(short) = %v, want %v", got, want)
	}
}

func TestTokenize_Mixed(t *testing.T) {
	// Mixed Arabic + English sentence.
	got := Tokenize("بحبك love you")
	want := []string{"بحبك", "love", "you"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tokenize(mixed) = %v, want %v", got, want)
	}
}

func TestExtractEmojis_Basic(t *testing.T) {
	emojis := ExtractEmojis("هاها 😂 ههه 🤣")
	if len(emojis) != 2 {
		t.Fatalf("ExtractEmojis: got %v, want 2 emojis", emojis)
	}
	if emojis[0] != "😂" || emojis[1] != "🤣" {
		t.Errorf("ExtractEmojis: got %v, want [😂 🤣]", emojis)
	}
}

func TestExtractEmojis_VariationSelector(t *testing.T) {
	// ❤️ (heart + variation selector-16) and ❤ (bare heart) should both extract.
	e1 := ExtractEmojis("❤️")
	e2 := ExtractEmojis("❤")
	if len(e1) == 0 || len(e2) == 0 {
		t.Fatalf("ExtractEmojis variation selector: e1=%v e2=%v", e1, e2)
	}
	// After stripping variation selector they should compare equal.
	if e1[0] != e2[0] {
		t.Errorf("ExtractEmojis: ❤️ normalised to %q, ❤ to %q — should be equal", e1[0], e2[0])
	}
}

func TestExtractEmojis_SkinTone(t *testing.T) {
	// 👍🏽 = thumbs up + medium skin tone modifier — should be one cluster.
	emojis := ExtractEmojis("👍🏽")
	if len(emojis) != 1 {
		t.Errorf("ExtractEmojis(skin tone): got %d emojis, want 1: %v", len(emojis), emojis)
	}
}

func TestExtractEmojis_ZWJ(t *testing.T) {
	// 👨‍👩‍👧 (family via ZWJ) should be one cluster.
	emojis := ExtractEmojis("👨‍👩‍👧")
	if len(emojis) != 1 {
		t.Errorf("ExtractEmojis(ZWJ family): got %d emojis, want 1: %v", len(emojis), emojis)
	}
}

func TestHasQuestion(t *testing.T) {
	if !HasQuestion("كيف حالك؟") {
		t.Error("HasQuestion: missed Arabic question mark")
	}
	if !HasQuestion("how are you?") {
		t.Error("HasQuestion: missed ASCII question mark")
	}
	if HasQuestion("just a statement") {
		t.Error("HasQuestion: false positive on statement")
	}
}

func TestHasLaughter_Emojis(t *testing.T) {
	emojis := ExtractEmojis("هاها 😂 text")
	if !HasLaughter(emojis, "هاها 😂 text") {
		t.Error("HasLaughter: missed laugh emoji")
	}
}

func TestHasLaughter_Arabic(t *testing.T) {
	if !HasLaughter(nil, "هههههه") {
		t.Error("HasLaughter: missed Arabic heh")
	}
	if !HasLaughter(nil, "خخخخ") {
		t.Error("HasLaughter: missed Arabic kha")
	}
}

func TestHasLaughter_English(t *testing.T) {
	if !HasLaughter(nil, "hahaha that was funny") {
		t.Error("HasLaughter: missed hahaha")
	}
	if !HasLaughter(nil, "lol") {
		t.Error("HasLaughter: missed lol")
	}
}

func TestExtractDomains(t *testing.T) {
	text := "check https://youtube.com/watch?v=abc and https://www.instagram.com/p/xyz"
	domains := ExtractDomains(text)
	if len(domains) != 2 {
		t.Fatalf("ExtractDomains: got %v, want 2 domains", domains)
	}
	if domains[0] != "YouTube" {
		t.Errorf("ExtractDomains[0]: got %q, want YouTube", domains[0])
	}
	if domains[1] != "Instagram" {
		t.Errorf("ExtractDomains[1]: got %q, want Instagram", domains[1])
	}
}

func TestExtractDomains_Dedup(t *testing.T) {
	text := "https://youtube.com/a and https://youtube.com/b"
	domains := ExtractDomains(text)
	if len(domains) != 1 || domains[0] != "YouTube" {
		t.Errorf("ExtractDomains dedup: got %v, want [YouTube]", domains)
	}
}
