package analytics

import "strings"

const (
	CatLove      = 0
	CatMiss      = 1
	CatHappy     = 2
	CatSad       = 3
	CatCare      = 4
	CatEncourage = 5
	CatApology   = 6
	CatGratitude = 7
	NumCategories = 8
)

// emotionKeywords maps each category index to a list of single tokens (Arabic + English).
// Tokens must already be in their tokenized form (diacritics stripped, ASCII lowercased).
var emotionKeywords = [NumCategories][]string{
	CatLove: {
		// Arabic terms of love and endearment
		"بحبك", "بحبكي", "بحبج", "حبيبي", "حبيبتي", "حبيبها", "حبيبه", "حبيب",
		"حبيبة", "حبك", "حبها", "حبه", "عشقي", "عشقك", "عشقكي", "عشقتك",
		"عشقتكي", "روحي", "ياعمري", "يا عمري", "حياتي", "قلبي", "قمري",
		"نوري", "ضوئي", "ضيائي", "عيوني", "يا عيوني", "يا روحي", "يا قلبي",
		// English
		"love", "iloveyou", "loveyou", "darling", "sweetheart", "babe",
		"baby", "honey", "dear",
	},
	CatMiss: {
		// Arabic
		"اشتقتلك", "اشتقتلكي", "وحشتني", "وحشتيني", "وحشك", "وحشكي",
		"افتقدك", "افتقدكي", "اشتقت", "اشتاقتلك", "وحشة",
		// English
		"miss", "missyou", "missing",
	},
	CatHappy: {
		// Arabic
		"فرحان", "فرحانة", "مبسوط", "مبسوطة", "سعيد", "سعيدة",
		"فرح", "سعادة", "فرحة", "مسرور", "مسرورة",
		"تمام", "كويس", "كويسة", "زاكي", "زاكية",
		// English
		"happy", "happiness", "yay", "great", "wonderful", "amazing", "joy", "joyful",
	},
	CatSad: {
		// Arabic
		"حزين", "حزينة", "زعلان", "زعلانة", "تعبان", "تعبانة",
		"حزن", "زعل", "حزنان", "حزنانة", "مكسور", "مكسورة",
		"اتاذيت", "تاذيت", "تاذى", "بكاء",
		// English
		"sad", "sadness", "crying", "unhappy", "upset", "hurt", "pain", "broken",
	},
	CatCare: {
		// Arabic
		"بهتم", "بهمني", "بهمك", "بهمكي", "اهتمامي", "اهتمامك",
		"حريص", "حريصة", "بحرص",
		// English
		"care", "caring", "matter",
	},
	CatEncourage: {
		// Arabic
		"شاطر", "شاطرة", "برافو", "ممتاز", "ممتازة", "رائع", "رائعة",
		"بتقدر", "بتقدري", "تقدر", "تقدري", "بقدرتك", "بقدرتكي",
		// English
		"goodluck", "believe", "proud", "inspire", "bravo",
	},
	CatApology: {
		// Arabic — typed forms (without hamza normalization)
		"اسف", "اسفة", "آسف", "آسفة", "أسف", "أسفة",
		"اعتذر", "سامحني", "سامحيني", "معليش", "معلش",
		"معزور", "معزورة",
		// English
		"sorry", "apologize", "forgive",
	},
	CatGratitude: {
		// Arabic
		"شكرا", "يسلمو", "يسلم", "ممنون", "ممنونة",
		"مشكور", "مشكورة", "جزاك", "جزاكي",
		// English
		"thanks", "thankyou", "appreciate", "grateful", "thankful",
	},
}

// keywordToCategories maps each keyword token to the list of category indices it belongs to.
// Built once at init from emotionKeywords.
var keywordToCategories map[string][]int

func init() {
	keywordToCategories = make(map[string][]int)
	for cat, words := range emotionKeywords {
		for _, w := range words {
			keywordToCategories[w] = append(keywordToCategories[w], cat)
		}
	}
}

// domainAliases maps known hostnames (and subdomains) to a canonical label.
var domainAliases = map[string]string{
	"youtube.com":         "YouTube",
	"youtu.be":            "YouTube",
	"music.youtube.com":   "YouTube",
	"open.spotify.com":    "music",
	"music.spotify.com":   "music",
	"spotify.com":         "music",
	"music.apple.com":     "music",
	"instagram.com":       "Instagram",
	"maps.google.com":     "maps",
	"goo.gl":              "maps",
	"maps.app.goo.gl":     "maps",
	"tiktok.com":          "TikTok",
	"vm.tiktok.com":       "TikTok",
	"twitter.com":         "Twitter/X",
	"x.com":               "Twitter/X",
	"t.co":                "Twitter/X",
	"t.me":                "Telegram",
	"telegram.me":         "Telegram",
	"trendyol.com":        "Trendyol",
	"ty.gl":               "Trendyol",
	"amazon.com":          "Amazon",
	"amzn.to":             "Amazon",
	"amazon.sa":           "Amazon",
	"amazon.ae":           "Amazon",
	"amazon.com.tr":       "Amazon",
	"facebook.com":        "Facebook",
	"fb.com":              "Facebook",
	"fb.me":               "Facebook",
}

// DomainCanonical returns a readable canonical label for a host string.
// If the host is not in the alias map, it returns the bare host (stripped of "www.").
func DomainCanonical(host string) string {
	host = strings.ToLower(strings.TrimPrefix(host, "www."))
	if canonical, ok := domainAliases[host]; ok {
		return canonical
	}
	// Strip any port
	if idx := strings.IndexByte(host, ':'); idx >= 0 {
		host = host[:idx]
	}
	return host
}
