package analytics

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// laughterRE matches common laughter patterns in Arabic and English.
var laughterRE = regexp.MustCompile(`(?i)(?:ha){2,}|haha|hehe|lol\b|lmao\b|كkkk|هه+|خخ+|هاها+`)

// laughEmojis contains emoji code points associated with laughter.
var laughEmojis = map[string]bool{
	"😂": true, // face with tears of joy
	"🤣": true, // rolling on the floor laughing
	"😅": true, // grinning face with sweat (often used as laugh)
	"😆": true, // grinning squinting face
}

// isDiacritic reports whether r is an Arabic diacritic or tatweel that should
// be stripped before tokenizing (these appear within words in fully-vocalized text).
func isDiacritic(r rune) bool {
	return (r >= 0x064B && r <= 0x065F) || // Arabic harakat (fathatan..sukun + marks)
		r == 0x0670 || // ARABIC LETTER SUPERSCRIPT ALEF
		r == 0x0640 // ARABIC TATWEEL (kashida, stretching character)
}

// isEmojiBase reports whether r is the start of an emoji sequence.
// We use inclusive ranges that cover modern emoji without trying to be exhaustive.
func isEmojiBase(r rune) bool {
	switch {
	case r >= 0x1F300 && r <= 0x1FAFF: // Emoji main block
		return true
	case r >= 0x2600 && r <= 0x27BF: // Miscellaneous Symbols, Dingbats
		return true
	case r >= 0x2300 && r <= 0x23FF: // Miscellaneous Technical (clocks etc.)
		return true
	case r >= 0x2B00 && r <= 0x2BFF: // Miscellaneous Symbols and Arrows
		return true
	case r >= 0x1F004 && r <= 0x1F004: // Mahjong Tile Red Dragon
		return true
	case r >= 0x1F0A0 && r <= 0x1F0FF: // Playing cards
		return true
	case r >= 0x1F1E6 && r <= 0x1F1FF: // Regional indicator letters (flags)
		return true
	case r == 0x00A9 || r == 0x00AE || r == 0x2764: // © ® ❤
		return true
	}
	return false
}

// isEmojiContinuation reports whether r can extend an ongoing emoji cluster
// (variation selector, skin tone, ZWJ, keycap combiner).
func isEmojiContinuation(r rune) bool {
	return r == 0xFE0F || // variation selector-16
		r == 0x200D || // zero-width joiner
		r == 0x20E3 || // combining enclosing keycap
		(r >= 0x1F3FB && r <= 0x1F3FF) // skin tone modifiers
}

// Tokenize splits text into word tokens suitable for frequency analysis.
// Arabic diacritics and tatweel are stripped. ASCII letters are lowercased.
// Tokens shorter than 2 runes are discarded. Emoji runes act as separators.
func Tokenize(text string) []string {
	var tokens []string
	var cur strings.Builder

	flush := func() {
		if cur.Len() == 0 {
			return
		}
		tok := cur.String()
		if utf8.RuneCountInString(tok) >= 2 {
			tokens = append(tokens, tok)
		}
		cur.Reset()
	}

	for _, r := range text {
		if isDiacritic(r) {
			continue
		}
		if isEmojiBase(r) || isEmojiContinuation(r) {
			flush()
			continue
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if r >= 'A' && r <= 'Z' {
				cur.WriteRune(r + 32) // ASCII to lower
			} else {
				cur.WriteRune(r)
			}
		} else {
			flush()
		}
	}
	flush()
	return tokens
}

// ExtractEmojis returns every emoji cluster found in text (with repetitions).
// Variation selectors (U+FE0F) are stripped from individual codepoints for
// normalisation so that ❤ and ❤️ compare equal.
func ExtractEmojis(text string) []string {
	runes := []rune(text)
	var result []string
	i := 0
	for i < len(runes) {
		r := runes[i]
		if !isEmojiBase(r) {
			i++
			continue
		}
		// Build emoji cluster: base + continuations + optional ZWJ+next-base sequences.
		var cluster []rune
		cluster = append(cluster, r)
		i++
		for i < len(runes) {
			next := runes[i]
			if isEmojiContinuation(next) {
				if next != 0xFE0F { // strip variation selector
					cluster = append(cluster, next)
				}
				i++
				// After ZWJ, include the following emoji base if present.
				if next == 0x200D && i < len(runes) && isEmojiBase(runes[i]) {
					cluster = append(cluster, runes[i])
					i++
				}
			} else {
				break
			}
		}
		result = append(result, string(cluster))
	}
	return result
}

// urlHostRE captures the host portion of HTTP/HTTPS URLs.
var urlHostRE = regexp.MustCompile(`https?://([a-zA-Z0-9.\-]+)`)

// ExtractDomains returns deduplicated canonical domain labels from URLs in text.
func ExtractDomains(text string) []string {
	matches := urlHostRE.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]bool)
	var domains []string
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		d := DomainCanonical(m[1])
		if !seen[d] {
			seen[d] = true
			domains = append(domains, d)
		}
	}
	return domains
}

// HasQuestion reports whether text contains a question mark (ASCII or Arabic).
func HasQuestion(text string) bool {
	return strings.ContainsRune(text, '?') || strings.ContainsRune(text, '؟')
}

// HasLaughter reports whether text or its extracted emojis contain laughter signals.
func HasLaughter(emojis []string, text string) bool {
	for _, e := range emojis {
		if laughEmojis[e] {
			return true
		}
	}
	return laughterRE.MatchString(text)
}
