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
		"عشقتكي", "روحي", "ياعمري", "حياتي", "قلبي", "قمري",
		"نوري", "ضوئي", "ضيائي", "عيوني", "احبك", "أحبك", "عزيزي", "عزيزتي",
		// English
		"love", "iloveyou", "loveyou", "darling", "sweetheart", "babe",
		"baby", "honey", "dear", "adore", "cherish", "luv", "ily", "xoxo",
	},
	CatMiss: {
		// Arabic
		"اشتقتلك", "اشتقتلكي", "وحشتني", "وحشتيني", "وحشك", "وحشكي",
		"افتقدك", "افتقدكي", "اشتقت", "اشتاقتلك", "وحشة",
		"مشتاق", "مشتاقة", "مشتاقلك", "مشتاقلكي",
		// English
		"miss", "missyou", "missing", "missed", "longing",
	},
	CatHappy: {
		// Arabic
		"فرحان", "فرحانة", "مبسوط", "مبسوطة", "سعيد", "سعيدة",
		"فرح", "سعادة", "فرحة", "مسرور", "مسرورة",
		"تمام", "كويس", "كويسة", "زاكي", "زاكية",
		// English
		"happy", "happiness", "yay", "great", "wonderful", "amazing", "joy", "joyful",
		"awesome", "excited", "thrilled", "fantastic", "brilliant", "incredible",
	},
	CatSad: {
		// Arabic
		"حزين", "حزينة", "زعلان", "زعلانة", "تعبان", "تعبانة",
		"حزن", "زعل", "حزنان", "حزنانة", "مكسور", "مكسورة",
		"اتاذيت", "تاذيت", "تاذى", "بكاء", "مكتئب", "مكتئبة",
		// English
		"sad", "sadness", "crying", "unhappy", "upset", "hurt", "pain", "broken",
		"depressed", "disappointed", "heartbroken", "lonely", "miserable",
	},
	CatCare: {
		// Arabic
		"بهتم", "بهمني", "بهمك", "بهمكي", "اهتمامي", "اهتمامك",
		"حريص", "حريصة", "بحرص",
		// English
		"care", "caring", "matter", "concern", "concerned", "worried", "worry",
	},
	CatEncourage: {
		// Arabic
		"شاطر", "شاطرة", "برافو", "ممتاز", "ممتازة", "رائع", "رائعة",
		"بتقدر", "بتقدري", "تقدر", "تقدري", "بقدرتك", "بقدرتكي",
		"بطل", "بطلة", "استمر", "استمري",
		// English
		"goodluck", "believe", "proud", "inspire", "bravo", "champion", "strong",
	},
	CatApology: {
		// Arabic — typed forms (without hamza normalization)
		"اسف", "اسفة", "آسف", "آسفة", "أسف", "أسفة",
		"اعتذر", "سامحني", "سامحيني", "معليش", "معلش",
		"معزور", "معزورة", "عذرا", "عذرني",
		// English
		"sorry", "apologize", "forgive", "pardon",
	},
	CatGratitude: {
		// Arabic
		"شكرا", "يسلمو", "يسلم", "ممنون", "ممنونة",
		"مشكور", "مشكورة", "جزاك", "جزاكي", "يعطيك", "يعطيكي",
		// English
		"thanks", "thankyou", "appreciate", "grateful", "thankful", "ty", "thx",
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
