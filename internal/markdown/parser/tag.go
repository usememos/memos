package parser

import (
	"unicode/utf8"

	"github.com/yuin/goldmark/util"
)

//go:generate go run ./tagdata -output tag_unicode_tables.go

type codePointRange struct {
	lo rune
	hi rune
}

// TagMatch is one lexical tag match within an eligible literal-source run.
type TagMatch struct {
	// Start is the byte offset of the introducer within the source run.
	Start int
	// End is the exclusive byte offset of the recognized source spelling.
	End int
	// Value is the emitted direct tag value without the introducer.
	Value []byte
}

func containsCodePoint(ranges []codePointRange, r rune) bool {
	low, high := 0, len(ranges)
	for low < high {
		middle := low + (high-low)/2
		current := ranges[middle]
		switch {
		case r < current.lo:
			high = middle
		case r > current.hi:
			low = middle + 1
		default:
			return true
		}
	}
	return false
}

func isXIDContinue(r rune) bool {
	return containsCodePoint(unicode17XIDContinue[:], r)
}

func isDefaultIgnorable(r rune) bool {
	return containsCodePoint(unicode17DefaultIgnorable[:], r)
}

func isCombiningMark(r rune) bool {
	return containsCodePoint(unicode17CombiningMarks[:], r)
}

func isSegmentStarter(r rune) bool {
	return r == '-' || r == '+' || r == '&' || isXIDContinue(r) && !isCombiningMark(r) && !isDefaultIgnorable(r)
}

func isSegmentContinuation(r rune) bool {
	return r == '-' || r == '+' || r == '&' || isXIDContinue(r) && !isDefaultIgnorable(r)
}

func isApostropheJoiner(r rune) bool {
	return r == '\'' || r == '\u2019'
}

func startsNonCombiningXIDContinuation(source []byte) bool {
	if len(source) == 0 || matchFullyQualifiedEmoji(source) > 0 {
		return false
	}
	r, size := utf8.DecodeRune(source)
	if r == utf8.RuneError && size == 1 {
		return false
	}
	return isXIDContinue(r) && !isCombiningMark(r) && !isDefaultIgnorable(r)
}

func matchFullyQualifiedEmoji(source []byte) int {
	limit := min(len(source), maxEmoji17SequenceBytes)
	match := 0
	for pos := 0; pos < limit; {
		r, size := utf8.DecodeRune(source[pos:])
		if r == utf8.RuneError && size == 1 {
			break
		}
		pos += size
		if pos > limit {
			break
		}
		if _, ok := emoji17FullyQualified[string(source[:pos])]; ok {
			match = pos
		}
	}
	return match
}

func scanTagSegment(source []byte) (int, []byte, bool) {
	pos := 0
	var value []byte
	previousWasXIDContinuation := false

starter:
	for pos < len(source) {
		if source[pos] == '&' && characterReferenceLength(source[pos:]) > 0 {
			return 0, nil, false
		}
		if emojiLength := matchFullyQualifiedEmoji(source[pos:]); emojiLength > 0 {
			value = append(value, source[pos:pos+emojiLength]...)
			pos += emojiLength
			previousWasXIDContinuation = false
			break
		}
		r, size := utf8.DecodeRune(source[pos:])
		if r == utf8.RuneError && size == 1 {
			return 0, nil, false
		}
		switch {
		case isDefaultIgnorable(r):
			pos += size
		case isXIDContinue(r) && isCombiningMark(r):
			pos += size
		case isSegmentStarter(r):
			value = append(value, source[pos:pos+size]...)
			pos += size
			previousWasXIDContinuation = isXIDContinue(r) && !isDefaultIgnorable(r)
			break starter
		default:
			return 0, nil, false
		}
	}

	if len(value) == 0 {
		return 0, nil, false
	}

	for pos < len(source) {
		if source[pos] == '&' && characterReferenceLength(source[pos:]) > 0 {
			break
		}
		if emojiLength := matchFullyQualifiedEmoji(source[pos:]); emojiLength > 0 {
			value = append(value, source[pos:pos+emojiLength]...)
			pos += emojiLength
			previousWasXIDContinuation = false
			continue
		}
		r, size := utf8.DecodeRune(source[pos:])
		if r == utf8.RuneError && size == 1 {
			break
		}
		switch {
		case isDefaultIgnorable(r):
			pos += size
			previousWasXIDContinuation = false
		case isApostropheJoiner(r) && previousWasXIDContinuation && startsNonCombiningXIDContinuation(source[pos+size:]):
			value = append(value, source[pos:pos+size]...)
			pos += size
			previousWasXIDContinuation = false
		case isSegmentContinuation(r):
			value = append(value, source[pos:pos+size]...)
			pos += size
			previousWasXIDContinuation = isXIDContinue(r) && !isDefaultIgnorable(r)
		default:
			return pos, value, true
		}
	}

	return pos, value, true
}

func scanTagIdentifier(source []byte) (int, []byte, bool) {
	consumed, value, ok := scanTagSegment(source)
	if !ok {
		return 0, nil, false
	}

	for consumed < len(source) && source[consumed] == '/' {
		segmentLength, segmentValue, segmentOK := scanTagSegment(source[consumed+1:])
		if !segmentOK {
			break
		}
		value = append(value, '/')
		value = append(value, segmentValue...)
		consumed += 1 + segmentLength
	}

	return consumed, value, true
}

func characterReferenceLength(source []byte) int {
	if len(source) < 3 || source[0] != '&' {
		return 0
	}

	if source[1] == '#' {
		pos, maxDigits := 2, 7
		isDigit := func(value byte) bool { return value >= '0' && value <= '9' }
		if pos < len(source) && (source[pos] == 'x' || source[pos] == 'X') {
			pos++
			maxDigits = 6
			isDigit = func(value byte) bool {
				return value >= '0' && value <= '9' || value >= 'a' && value <= 'f' || value >= 'A' && value <= 'F'
			}
		}
		start := pos
		for pos < len(source) && pos-start < maxDigits && isDigit(source[pos]) {
			pos++
		}
		if pos > start && pos < len(source) && source[pos] == ';' {
			return pos + 1
		}
		return 0
	}

	pos := 1
	for pos < len(source) && pos <= 32 && util.IsAlphaNumeric(source[pos]) {
		pos++
	}
	if pos == 1 || pos >= len(source) || source[pos] != ';' {
		return 0
	}
	if _, ok := util.LookUpHTML5EntityByName(string(source[1:pos])); !ok {
		return 0
	}
	return pos + 1
}

// FindTagMatches enumerates tag candidates in one eligible
// literal-source run. Markdown structure must be resolved before calling it.
func FindTagMatches(source []byte) []TagMatch {
	var matches []TagMatch
	for pos := 0; pos < len(source); {
		if emojiLength := matchFullyQualifiedEmoji(source[pos:]); emojiLength > 0 {
			pos += emojiLength
			continue
		}
		if referenceLength := characterReferenceLength(source[pos:]); referenceLength > 0 {
			pos += referenceLength
			continue
		}
		if source[pos] == '\\' && pos+1 < len(source) && util.IsPunct(source[pos+1]) {
			pos += 2
			continue
		}
		if source[pos] != '#' {
			_, size := utf8.DecodeRune(source[pos:])
			pos += size
			continue
		}

		consumed, value, ok := scanTagIdentifier(source[pos+1:])
		if !ok {
			pos++
			continue
		}
		end := pos + consumed + 1
		matches = append(matches, TagMatch{Start: pos, End: end, Value: value})
		pos = end
	}
	return matches
}
