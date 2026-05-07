package stats

import (
	"context"
	"fmt"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

type DayBucket struct {
	Date          string `json:"date"`          // YYYY-MM-DD
	OnlineSeconds int64  `json:"onlineSeconds"`
}

type Summary struct {
	Range            string      `json:"range"`
	StartUnix        int64       `json:"startUnix"`
	EndUnix          int64       `json:"endUnix"`
	Days             []DayBucket `json:"days"`
	OnlineSecondsAll int64       `json:"onlineSecondsAll"`
	PictureChanges   int         `json:"pictureChanges"`
	AboutChanges     int         `json:"aboutChanges"`
}

// Compute returns aggregated metrics for a contact over a named range.
func Compute(ctx context.Context, store *db.DB, contactID int64, rangeName string, now time.Time) (Summary, error) {
	start, end, err := rangeBounds(rangeName, now)
	if err != nil {
		return Summary{}, err
	}

	out := Summary{
		Range:     rangeName,
		StartUnix: start.Unix(),
		EndUnix:   end.Unix(),
	}

	dayKeys, dayBounds := dayBuckets(start, end)
	online := make(map[string]int64, len(dayKeys))
	for _, k := range dayKeys {
		online[k] = 0
	}

	events, err := store.PresenceRange(ctx, contactID, start.Unix(), end.Unix())
	if err != nil {
		return Summary{}, err
	}

	// Seed prior state from the last event before start.
	prior, err := store.LastPresenceBefore(ctx, contactID, start.Unix())
	if err != nil {
		return Summary{}, err
	}

	cursor := start
	online1 := prior.State == "available"

	apply := func(until time.Time) {
		if !online1 {
			cursor = until
			return
		}
		// distribute [cursor, until) across days
		c := cursor
		for c.Before(until) {
			key := c.Format("2006-01-02")
			b, ok := dayBounds[key]
			if !ok {
				break
			}
			segEnd := until
			if b.end.Before(segEnd) {
				segEnd = b.end
			}
			online[key] += segEnd.Unix() - c.Unix()
			c = segEnd
		}
		cursor = until
	}

	for _, e := range events {
		t := time.Unix(e.ObservedAt, 0)
		if t.Before(start) {
			t = start
		}
		if t.After(end) {
			t = end
		}
		apply(t)
		online1 = e.State == "available"
	}
	apply(end)

	for _, k := range dayKeys {
		secs := online[k]
		out.Days = append(out.Days, DayBucket{Date: k, OnlineSeconds: secs})
		out.OnlineSecondsAll += secs
	}

	out.PictureChanges, err = store.CountPictureChanges(ctx, contactID, start.Unix(), end.Unix())
	if err != nil {
		return Summary{}, err
	}
	out.AboutChanges, err = store.CountAboutChanges(ctx, contactID, start.Unix(), end.Unix())
	if err != nil {
		return Summary{}, err
	}
	return out, nil
}

func rangeBounds(name string, now time.Time) (time.Time, time.Time, error) {
	end := now
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	switch name {
	case "", "today":
		return startOfToday, end, nil
	case "week":
		return startOfToday.AddDate(0, 0, -6), end, nil
	case "month":
		return startOfToday.AddDate(0, 0, -29), end, nil
	}
	return time.Time{}, time.Time{}, fmt.Errorf("unknown range %q", name)
}

type bounds struct {
	start, end time.Time
}

func dayBuckets(start, end time.Time) ([]string, map[string]bounds) {
	keys := []string{}
	out := map[string]bounds{}
	cursor := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	for !cursor.After(end) {
		next := cursor.AddDate(0, 0, 1)
		ds := cursor
		if ds.Before(start) {
			ds = start
		}
		de := next
		if de.After(end) {
			de = end
		}
		key := cursor.Format("2006-01-02")
		keys = append(keys, key)
		out[key] = bounds{start: ds, end: de}
		cursor = next
	}
	return keys, out
}
