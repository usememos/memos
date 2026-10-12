package parser

import (
	"bytes"
	"regexp"

	"github.com/yuin/goldmark/util"
)

var gfmEmailDomainPattern = regexp.MustCompile(`^@(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]*[A-Za-z0-9]`)

// GFMEmailMatch is one extended GFM email autolink source range.
type GFMEmailMatch struct {
	Start   int
	End     int
	Address []byte
}

type gfmEmailProjection struct {
	value  []byte
	starts []int
	ends   []int
}

func projectGFMEmailText(source []byte) gfmEmailProjection {
	projection := gfmEmailProjection{
		value:  make([]byte, 0, len(source)),
		starts: make([]int, 0, len(source)),
		ends:   make([]int, 0, len(source)),
	}
	for cursor := 0; cursor < len(source); {
		if source[cursor] == '\\' && cursor+1 < len(source) && util.IsPunct(source[cursor+1]) {
			projection.value = append(projection.value, source[cursor+1])
			projection.starts = append(projection.starts, cursor)
			projection.ends = append(projection.ends, cursor+2)
			cursor += 2
			continue
		}
		if referenceLength := characterReferenceLength(source[cursor:]); referenceLength > 0 {
			end := cursor + referenceLength
			decoded := util.ResolveEntityNames(util.ResolveNumericReferences(source[cursor:end]))
			projection.value = append(projection.value, decoded...)
			for range len(decoded) {
				projection.starts = append(projection.starts, cursor)
				projection.ends = append(projection.ends, end)
			}
			cursor = end
			continue
		}
		projection.value = append(projection.value, source[cursor])
		projection.starts = append(projection.starts, cursor)
		projection.ends = append(projection.ends, cursor+1)
		cursor++
	}
	return projection
}

// FindGFMEmailMatches finds extended GFM email autolinks in one literal text node.
func FindGFMEmailMatches(source []byte) []GFMEmailMatch {
	projection := projectGFMEmailText(source)
	var matches []GFMEmailMatch
	for cursor := 0; cursor < len(projection.value); {
		relativeAt := bytes.IndexByte(projection.value[cursor:], '@')
		if relativeAt < 0 {
			break
		}
		at := cursor + relativeAt
		start, end, ok := matchProjectedGFMEmailAt(projection.value, at, cursor, len(projection.value))
		if !ok {
			cursor = at + 1
			continue
		}
		matches = append(matches, GFMEmailMatch{
			Start:   projection.starts[start],
			End:     projection.ends[end-1],
			Address: append([]byte(nil), projection.value[start:end]...),
		})
		cursor = end
	}
	return matches
}

// MatchGFMEmailAt matches an extended GFM email around the @ at the given byte offset.
func MatchGFMEmailAt(source []byte, at, lowerBound, upperBound int) (int, int, bool) {
	if lowerBound < 0 || at < lowerBound || at >= upperBound || upperBound > len(source) || source[at] != '@' {
		return 0, 0, false
	}

	projection := projectGFMEmailText(source[lowerBound:upperBound])
	relativeAt := at - lowerBound
	projectedAt := -1
	for index, start := range projection.starts {
		if start == relativeAt && projection.value[index] == '@' {
			projectedAt = index
			break
		}
	}
	if projectedAt < 0 {
		return 0, 0, false
	}

	start, end, ok := matchProjectedGFMEmailAt(projection.value, projectedAt, 0, len(projection.value))
	if !ok {
		return 0, 0, false
	}
	return lowerBound + projection.starts[start], lowerBound + projection.ends[end-1], true
}

func matchProjectedGFMEmailAt(source []byte, at, lowerBound, upperBound int) (int, int, bool) {
	if lowerBound < 0 || at < lowerBound || at >= upperBound || upperBound > len(source) || source[at] != '@' {
		return 0, 0, false
	}

	start := at
	for start > lowerBound {
		if !isGFMEmailLocalByte(source[start-1]) {
			break
		}
		start--
	}
	if start == at {
		return 0, 0, false
	}
	domain := gfmEmailDomainPattern.FindIndex(source[at:upperBound])
	if domain == nil {
		return 0, 0, false
	}
	end := at + domain[1]
	if end < upperBound && (source[end] == '-' || source[end] == '_') {
		return 0, 0, false
	}
	return start, end, true
}

func isGFMEmailLocalByte(value byte) bool {
	return value >= 'a' && value <= 'z' ||
		value >= 'A' && value <= 'Z' ||
		value >= '0' && value <= '9' ||
		value == '.' || value == '_' || value == '+' || value == '-'
}
