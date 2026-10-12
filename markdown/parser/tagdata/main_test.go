package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseDerivedPropertyMergesMatchingRanges(t *testing.T) {
	data := []byte("0041..0042 ; XID_Continue # letters\n0043 ; XID_Continue\n200D ; Default_Ignorable_Code_Point\n")

	require.Equal(t, []codePointRange{{lo: 0x41, hi: 0x43}}, parseDerivedProperty(data, "XID_Continue"))
}

func TestParseCombiningMarksIncludesSinglesAndRanges(t *testing.T) {
	data := []byte("\n0300;COMBINING GRAVE ACCENT;Mn\n0903;DEVANAGARI SIGN VISARGA;Mc\n1000;<TEST, First>;Mn\n1002;<TEST, Last>;Mn\n0041;LATIN CAPITAL LETTER A;Lu\n\n")

	require.Equal(t, []codePointRange{
		{lo: 0x0300, hi: 0x0300},
		{lo: 0x0903, hi: 0x0903},
		{lo: 0x1000, hi: 0x1002},
	}, parseCombiningMarks(data))
}

func TestParseFullyQualifiedEmojiIgnoresOtherStatuses(t *testing.T) {
	data := []byte("1F600 ; fully-qualified # grinning face\n263A FE0F ; fully-qualified # smiling face\n1F3F4 E0067 E0062 E0073 E0063 E0074 E007F ; fully-qualified # flag: Scotland\n263A ; unqualified\n1F3FB ; component\n")

	emojis, maxBytes := parseFullyQualifiedEmoji(data)
	require.ElementsMatch(t, []string{"😀", "☺️", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"}, emojis)
	require.Equal(t, len("🏴󠁧󠁢󠁳󠁣󠁴󠁿"), maxBytes)
}
