package analytics

// Exported wrappers for unexported helpers — visible only to tests.

var (
	MeanF          = meanF
	MedianF        = medianF
	SafeDivF       = safeDivF
	Pct            = pct
	RangeBounds    = rangeBounds
	LongestStreak  = longestStreak
	HighestVolumeDay = highestVolumeDay
	MonthlyTrend   = monthlyTrend
	ComputeInitiation = computeInitiation
)
