// Copyright 2019 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate go run gen.go

// Package ccitt implements a CCITT (fax) image decoder.
package ccitt

import (
	"encoding/binary"
	"errors"
	"image"
	"io"
	"math/bits"
)

var (
	errIncompleteCode          = errors.New("ccitt: incomplete code")
	errInvalidBounds           = errors.New("ccitt: invalid bounds")
	errInvalidCode             = errors.New("ccitt: invalid code")
	errInvalidMode             = errors.New("ccitt: invalid mode")
	errInvalidOffset           = errors.New("ccitt: invalid offset")
	errMissingEOL              = errors.New("ccitt: missing End-of-Line")
	errRunLengthOverflowsWidth = errors.New("ccitt: run length overflows width")
	errRunLengthTooLong        = errors.New("ccitt: run length too long")
	errUnsupportedMode         = errors.New("ccitt: unsupported mode")
	errUnsupportedSubFormat    = errors.New("ccitt: unsupported sub-format")
	errUnsupportedWidth        = errors.New("ccitt: unsupported width")
)

// Order specifies the bit ordering in a CCITT data stream.
type Order uint32

const (
	// LSB means Least Significant Bits first.
	LSB Order = iota
	// MSB means Most Significant Bits first.
	MSB
)

// SubFormat represents that the CCITT format consists of a number of
// sub-formats. Decoding or encoding a CCITT data stream requires knowing the
// sub-format context. It is not represented in the data stream per se.
type SubFormat uint32

const (
	Group3 SubFormat = iota
	Group4
)

// AutoDetectHeight is passed as the height argument to NewReader to indicate
// that the image height (the number of rows) is not known in advance.
const AutoDetectHeight = -1

// Options are optional parameters.
type Options struct {
	// Align means that some variable-bit-width codes are byte-aligned.
	Align bool
	// Invert means that black is the 1 bit or 0xFF byte, and white is 0.
	Invert bool
}

// maxWidth is the maximum (inclusive) supported width. This is a limitation of
// this implementation, to guard against integer overflow, and not anything
// inherent to the CCITT format.
const maxWidth = 1 << 20

func invertBytes(b []byte) {
	for i, c := range b {
		b[i] = ^c
	}
}

func reverseBitsWithinBytes(b []byte) {
	for i, c := range b {
		b[i] = bits.Reverse8(c)
	}
}

// highBits writes to dst (1 bit per pixel, most significant bit first) the
// high (0x80) bits from src (1 byte per pixel). It returns the number of bytes
// written and read such that dst[:d] is the packed form of src[:s].
//
// For example, if src starts with the 8 bytes [0x7D, 0x7E, 0x7F, 0x80, 0x81,
// 0x82, 0x00, 0xFF] then 0x1D will be written to dst[0].
//
// If src has (8 * len(dst)) or more bytes then only len(dst) bytes are
// written, (8 * len(dst)) bytes are read, and invert is ignored.
//
// Otherwise, if len(src) is not a multiple of 8 then the final byte written to
// dst is padded with 1 bits (if invert is true) or 0 bits. If inverted, the 1s
// are typically temporary, e.g. they will be flipped back to 0s by an
// invertBytes call in the highBits caller, reader.Read.
func highBits(dst []byte, src []byte, invert bool) (d int, s int) {
	// Pack as many complete groups of 8 src bytes as we can.
	n := len(src) / 8
	if n > len(dst) {
		n = len(dst)
	}
	dstN := dst[:n]
	for i := range dstN {
		src8 := src[i*8 : i*8+8]
		dstN[i] = ((src8[0] & 0x80) >> 0) |
			((src8[1] & 0x80) >> 1) |
			((src8[2] & 0x80) >> 2) |
			((src8[3] & 0x80) >> 3) |
			((src8[4] & 0x80) >> 4) |
			((src8[5] & 0x80) >> 5) |
			((src8[6] & 0x80) >> 6) |
			((src8[7] & 0x80) >> 7)
	}
	d, s = n, 8*n
	dst, src = dst[d:], src[s:]

	// Pack up to 7 remaining src bytes, if there's room in dst.
	if (len(dst) > 0) && (len(src) > 0) {
		dstByte := byte(0)
		if invert {
			dstByte = 0xFF >> uint(len(src))
		}
		for n, srcByte := range src {
			dstByte |= (srcByte & 0x80) >> uint(n)
		}
		dst[0] = dstByte
		d, s = d+1, s+len(src)
	}
	return d, s
}

type bitReader struct {
	r io.Reader

	// readErr is the error returned from the most recent r.Read call. As the
	// io.Reader documentation says, when r.Read returns (n, err), "always
	// process the n > 0 bytes returned before considering the error err".
	readErr error

	// order is whether to process r's bytes LSB first or MSB first.
	order Order

	// The high nBits bits of the bits field hold upcoming bits in MSB order.
	bits  uint64
	nBits uint32

	// bytes[br:bw] holds bytes read from r but not yet loaded into bits.
	br    uint32
	bw    uint32
	bytes [1024]uint8
}

func (b *bitReader) alignToByteBoundary() {
	n := b.nBits & 7
	b.bits <<= n
	b.nBits -= n
}

// nextBitMaxNBits is the maximum possible value of bitReader.nBits after a
// bitReader.nextBit call, provided that bitReader.nBits was not more than this
// value before that call.
//
// Note that the decode function can unread bits, which can temporarily set the
// bitReader.nBits value above nextBitMaxNBits.
const nextBitMaxNBits = 31

func (b *bitReader) nextBit() (uint64, error) {
	for {
		if b.nBits > 0 {
			bit := b.bits >> 63
			b.bits <<= 1
			b.nBits--
			return bit, nil
		}

		if available := b.bw - b.br; available >= 4 {
			// Read 32 bits, even though b.bits is a uint64, since the decode
			// function may need to unread up to maxCodeLength bits, putting
			// them back in the remaining (64 - 32) bits. TestMaxCodeLength
			// checks that the generated maxCodeLength constant fits.
			//
			// If changing the Uint32 call, also change nextBitMaxNBits.
			b.bits = uint64(binary.BigEndian.Uint32(b.bytes[b.br:])) << 32
			b.br += 4
			b.nBits = 32
			continue
		} else if available > 0 {
			b.bits = uint64(b.bytes[b.br]) << (7 * 8)
			b.br++
			b.nBits = 8
			continue
		}

		if b.readErr != nil {
			return 0, b.readErr
		}

		n, err := b.r.Read(b.bytes[:])
		b.br = 0
		b.bw = uint32(n)
		b.readErr = err

		if b.order != MSB {
			reverseBitsWithinBytes(b.bytes[:b.bw])
		}
	}
}

func decode(b *bitReader, decodeTable [][2]int16) (uint32, error) {
	nBitsRead, bitsRead, state := uint32(0), uint64(0), int32(1)
	for {
		bit, err := b.nextBit()
		if err != nil {
			if err == io.EOF {
				err = errIncompleteCode
			}
			return 0, err
		}
		bitsRead |= bit << (63 - nBitsRead)
		nBitsRead++

		// The "&1" is redundant, but can eliminate a bounds check.
		state = int32(decodeTable[state][bit&1])
		if state < 0 {
			return uint32(^state), nil
		} else if state == 0 {
			// Unread the bits we've read, then return errInvalidCode.
			b.bits = (b.bits >> nBitsRead) | bitsRead
			b.nBits += nBitsRead
			return 0, errInvalidCode
		}
	}
}

// decodeEOL decodes the 12-bit EOL code 0000_0000_0001.
func decodeEOL(b *bitReader) error {
	nBitsRead, bitsRead := uint32(0), uint64(0)
	for {
		bit, err := b.nextBit()
		if err != nil {
			if err == io.EOF {
				err = errMissingEOL
			}
			return err
		}
		bitsRead |= bit << (63 - nBitsRead)
		nBitsRead++

		if nBitsRead < 12 {
			if bit&1 == 0 {
				continue
			}
		} else if bit&1 != 0 {
			return nil
		}

		// Unread the bits we've read, then return errMissingEOL.
		b.bits = (b.bits >> nBitsRead) | bitsRead
		b.nBits += nBitsRead
		return errMissingEOL
	}
}

type reader struct {
	br        bitReader
	subFormat SubFormat

	// width is the image width in pixels.
	width int

	// rowsRemaining starts at the image height in pixels, when the reader is
	// driven through the io.Reader interface, and decrements to zero as rows
	// are decoded. Alternatively, it may be negative if the image height is
	// not known in advance at the time of the NewReader call.
	//
	// When driven through DecodeIntoGray, this field is unused.
	rowsRemaining int

	// curr and prev hold the current and previous rows. Each element is either
	// 0x00 (black) or 0xFF (white).
	//
	// prev may be nil, when processing the first row.
	curr []byte
	prev []byte

	// ri is the read index. curr[:ri] are those bytes of curr that have been
	// passed along via the Read method.
	//
	// When the reader is driven through DecodeIntoGray, instead of through the
	// io.Reader interface, this field is unused.
	ri int

	// wi is the write index. curr[:wi] are those bytes of curr that have
	// already been decoded via the decodeRow method.
	//
	// What this implementation calls wi is roughly equivalent to what the spec
	// calls the a0 index.
	wi int

	// These fields are copied from the *Options (which may be nil).
	align  bool
	invert bool

	// atStartOfRow is whether we have just started the row. Some parts of the
	// spec say to treat this situation as if "wi = -1".
	atStartOfRow bool

	// penColorIsWhite is whether the next run is black or white.
	penColorIsWhite bool

	// seenStartOfImage is whether we've called the startDecode method.
	seenStartOfImage bool

	// truncated is whether the input is missing the final 6 consecutive EOL's
	// (for Group3) or 2 consecutive EOL's (for Group4). Omitting that trailer
	// (but otherwise padding to a byte boundary, with either all 0 bits or all
	// 1 bits) is invalid according to the spec, but happens in practice when
	// exporting from Adobe Acrobat to TIFF + CCITT. This package silently
	// ignores the format error for CCITT input that has been truncated in that
	// fashion, returning the full decoded image.
	//
	// Detecting trailer truncation (just after the final row of pixels)
	// requires knowing which row is the final row, and therefore does not
	// trigger if the image height is not known in advance.
	truncated bool

	// readErr is a sticky error for the Read method.
	readErr error
}

func (z *reader) Read(p []byte) (int, error) {
	if z.readErr != nil {
		return 0, z.readErr
	}
	originalP := p

	for len(p) > 0 {
		// Allocate buffers (and decode any start-of-image codes), if
		// processing the first or second row.
		if z.curr == nil {
			if !z.seenStartOfImage {
				if z.readErr = z.startDecode(); z.readErr != nil {
					break
				}
				z.atStartOfRow = true
			}
			z.curr = make([]byte, z.width)
		}

		// Decode the next row, if necessary.
		if z.atStartOfRow {
			if z.rowsRemaining < 0 {
				// We do not know the image height in advance. See if the next
				// code is an EOL. If it is, it is consumed. If it isn't, the
				// bitReader shouldn't advance along the bit stream, and we
				// simply decode another row of pixel data.
				//
				// For the Group4 subFormat, we may need to align to a byte
				// boundary. For the Group3 subFormat, the previous z.decodeRow
				// call (or z.startDecode call) has already consumed one of the
				// 6 consecutive EOL's. The next EOL is actually the second of
				// 6, in the middle, and we shouldn't align at that point.
				if z.align && (z.subFormat == Group4) {
					z.br.alignToByteBoundary()
				}

				if err := z.decodeEOL(); err == errMissingEOL {
					// No-op. It's another row of pixel data.
				} else if err != nil {
					z.readErr = err
					break
				} else {
					if z.readErr = z.finishDecode(true); z.readErr != nil {
						break
					}
					z.readErr = io.EOF
					break
				}

			} else if z.rowsRemaining == 0 {
				// We do know the image height in advance, and we have already
				// decoded exactly that many rows.
				if z.readErr = z.finishDecode(false); z.readErr != nil {
					break
				}
				z.readErr = io.EOF
				break

			} else {
				z.rowsRemaining--
			}

			if z.readErr = z.decodeRow(z.rowsRemaining == 0); z.readErr != nil {
				break
			}
		}

		// Pack from z.curr (1 byte per pixel) to p (1 bit per pixel).
		packD, packS := highBits(p, z.curr[z.ri:], z.invert)
		p = p[packD:]
		z.ri += packS

		// Prepare to decode the next row, if necessary.
		if z.ri == len(z.curr) {
			z.ri, z.curr, z.prev = 0, z.prev, z.curr
			z.atStartOfRow = true
		}
	}

	n := len(originalP) - len(p)
	if z.invert {
		invertBytes(originalP[:n])
	}
	return n, z.readErr
}

func (z *reader) penColor() byte {
	if z.penColorIsWhite {
		return 0xFF
	}
	return 0x00
}

func (z *reader) startDecode() error {
	switch z.subFormat {
	case Group3:
		if err := z.decodeEOL(); err != nil {
			return err
		}

	case Group4:
		// No-op.

	default:
		return errUnsupportedSubFormat
	}

	z.seenStartOfImage = true
	return nil
}

func (z *reader) finishDecode(alreadySeenEOL bool) error {
	numberOfEOLs := 0
	switch z.subFormat {
	case Group3:
		if z.truncated {
			return nil
		}
		// The stream ends with a RTC (Return To Control) of 6 consecutive
		// EOL's, but we should have already just seen an EOL, either in
		// z.startDecode (for a zero-height image) or in z.decodeRow.
		numberOfEOLs = 5

	case Group4:
		autoDetectHeight := z.rowsRemaining < 0
		if autoDetectHeight {
			// Aligning to a byte boundary was already handled by reader.Read.
		} else if z.align {
			z.br.alignToByteBoundary()
		}
		// The stream ends with two EOL's. If the first one is missing, and we
		// had an explicit image height, we just assume that the trailing two
		// EOL's were truncated and return a nil error.
		if err := z.decodeEOL(); err != nil {
			if (err == errMissingEOL) && !autoDetectHeight {
				z.truncated = true
				return nil
			}
			return err
		}
		numberOfEOLs = 1

	default:
		return errUnsupportedSubFormat
	}

	if alreadySeenEOL {
		numberOfEOLs--
	}
	for ; numberOfEOLs > 0; numberOfEOLs-- {
		if err := z.decodeEOL(); err != nil {
			return err
		}
	}
	return nil
}

func (z *reader) decodeEOL() error {
	return decodeEOL(&z.br)
}

func (z *reader) decodeRow(finalRow bool) error {
	z.wi = 0
	z.atStartOfRow = true
	z.penColorIsWhite = true

	if z.align {
		z.br.alignToByteBoundary()
	}

	switch z.subFormat {
	case Group3:
		for ; z.wi < len(z.curr); z.atStartOfRow = false {
			if err := z.decodeRun(); err != nil {
				return err
			}
		}
		err := z.decodeEOL()
		if finalRow && (err == errMissingEOL) {
			z.truncated = true
			return nil
		}
		return err

	case Group4:
		for ; z.wi < len(z.curr); z.atStartOfRow = false {
			mode, err := decode(&z.br, modeDecodeTable[:])
			if err != nil {
				return err
			}
			rm := readerMode{}
			if mode < uint32(len(readerModes)) {
				rm = readerModes[mode]
			}
			if rm.function == nil {
				return errInvalidMode
			}
			if err := rm.function(z, rm.arg); err != nil {
				return err
			}
		}
		return nil
	}

	return errUnsupportedSubFormat
}

func (z *reader) decodeRun() error {
	table := blackDecodeTable[:]
	if z.penColorIsWhite {
		table = whiteDecodeTable[:]
	}

	total := 0
	for {
		n, err := decode(&z.br, table)
		if err != nil {
			return err
		}
		if n > maxWidth {
			panic("unreachable")
		}
		total += int(n)
		if total > maxWidth {
			return errRunLengthTooLong
		}
		// Anything 0x3F or below is a terminal code.
		if n <= 0x3F {
			break
		}
	}

	if total > (len(z.curr) - z.wi) {
		return errRunLengthOverflowsWidth
	}
	dst := z.curr[z.wi : z.wi+total]
	penColor := z.penColor()
	for i := range dst {
		dst[i] = penColor
	}
	z.wi += total
	z.penColorIsWhite = !z.penColorIsWhite

	return nil
}

// The various modes' semantics are based on determining a row of pixels'
// "changing elements": those pixels whose color differs from the one on its
// immediate left.
//
// The row above the first row is implicitly all white. Similarly, the column
// to the left of the first column is implicitly all white.
//
// For example, here's Figure 1 in "ITU-T Recommendation T.6", where the
// current and previous rows contain black (B) and white (w) pixels. The a?
// indexes point into curr, the b? indexes point into prev.
//
//                 b1 b2
//                 v  v
// prev: BBBBBwwwwwBBBwwwww
// curr: BBBwwwwwBBBBBBwwww
//          ^    ^     ^
//          a0   a1    a2
//
// a0 is the "reference element" or current decoder position, roughly
// equivalent to what this implementation calls reader.wi.
//
// a1 is the next changing element to the right of a0, on the "coding line"
// (the current row).
//
// a2 is the next changing element to the right of a1, again on curr.
//
// b1 is the first changing element on the "reference line" (the previous row)
// to the right of a0 and of opposite color to a0.
//
// b2 is the next changing element to the right of b1, again on prev.
//
// The various modes calculate a1 (and a2, for modeH):
//  - modePass calculates that a1 is at or to the right of b2.
//  - modeH    calculates a1 and a2 without considering b1 or b2.
//  - modeV*   calculates a1 to be b1 plus an adjustment (between -3 and +3).

const (
	findB1 = false
	findB2 = true
)

// findB finds either the b1 or b2 value.
func (z *reader) findB(whichB bool) int {
	// The initial row is a special case. The previous row is implicitly all
	// white, so that there are no changing pixel elements. We return b1 or b2
	// to be at the end of the row.
	if len(z.prev) != len(z.curr) {
		return len(z.curr)
	}

	i := z.wi

	if z.atStartOfRow {
		// a0 is implicitly at -1, on a white pixel. b1 is the first black
		// pixel in the previous row. b2 is the first white pixel after that.
		for ; (i < len(z.prev)) && (z.prev[i] == 0xFF); i++ {
		}
		if whichB == findB2 {
			for ; (i < len(z.prev)) && (z.prev[i] == 0x00); i++ {
			}
		}
		return i
	}

	// As per figure 1 above, assume that the current pen color is white.
	// First, walk past every contiguous black pixel in prev, starting at a0.
	oppositeColor := ^z.penColor()
	for ; (i < len(z.prev)) && (z.prev[i] == oppositeColor); i++ {
	}

	// Then walk past every contiguous white pixel.
	penColor := ^oppositeColor
	for ; (i < len(z.prev)) && (z.prev[i] == penColor); i++ {
	}

	// We're now at a black pixel (or at the end of the row). That's b1.
	if whichB == findB2 {
		// If we're looking for b2, walk past every contiguous black pixel
		// again.
		oppositeColor := ^penColor
		for ; (i < len(z.prev)) && (z.prev[i] == oppositeColor); i++ {
		}
	}

	return i
}

type readerMode struct {
	function func(z *reader, arg int) error
	arg      int
}

var readerModes = [...]readerMode{
	modePass: {function: readerModePass},
	modeH:    {function: readerModeH},
	modeV0:   {function: readerModeV, arg: +0},
	modeVR1:  {function: readerModeV, arg: +1},
	modeVR2:  {function: readerModeV, arg: +2},
	modeVR3:  {function: readerModeV, arg: +3},
	modeVL1:  {function: readerModeV, arg: -1},
	modeVL2:  {function: readerModeV, arg: -2},
	modeVL3:  {function: readerModeV, arg: -3},
	modeExt:  {function: readerModeExt},
}

func readerModePass(z *reader, arg int) error {
	b2 := z.findB(findB2)
	if (b2 < z.wi) || (len(z.curr) < b2) {
		return errInvalidOffset
	}
	dst := z.curr[z.wi:b2]
	penColor := z.penColor()
	for i := range dst {
		dst[i] = penColor
	}
	z.wi = b2
	return nil
}

func readerModeH(z *reader, arg int) error {
	// The first iteration finds a1. The second finds a2.
	for i := 0; i < 2; i++ {
		if err := z.decodeRun(); err != nil {
			return err
		}
	}
	return nil
}

func readerModeV(z *reader, arg int) error {
	a1 := z.findB(findB1) + arg
	if (a1 < z.wi) || (len(z.curr) < a1) {
		return errInvalidOffset
	}
	dst := z.curr[z.wi:a1]
	penColor := z.penColor()
	for i := range dst {
		dst[i] = penColor
	}
	z.wi = a1
	z.penColorIsWhite = !z.penColorIsWhite
	return nil
}

func readerModeExt(z *reader, arg int) error {
	return errUnsupportedMode
}

// DecodeIntoGray decodes the CCITT-formatted data in r into dst.
//
// It returns an error if dst's width and height don't match the implied width
// and height of CCITT-formatted data.
func DecodeIntoGray(dst *image.Gray, r io.Reader, order Order, sf SubFormat, opts *Options) error {
	bounds := dst.Bounds()
	if (bounds.Dx() < 0) || (bounds.Dy() < 0) {
		return errInvalidBounds
	}
	if bounds.Dx() > maxWidth {
		return errUnsupportedWidth
	}

	z := reader{
		br:        bitReader{r: r, order: order},
		subFormat: sf,
		align:     (opts != nil) && opts.Align,
		invert:    (opts != nil) && opts.Invert,
		width:     bounds.Dx(),
	}
	if err := z.startDecode(); err != nil {
		return err
	}

	width := bounds.Dx()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		p := (y - bounds.Min.Y) * dst.Stride
		z.curr = dst.Pix[p : p+width]
		if err := z.decodeRow(y+1 == bounds.Max.Y); err != nil {
			return err
		}
		z.curr, z.prev = nil, z.curr
	}

	if err := z.finishDecode(false); err != nil {
		return err
	}

	if z.invert {
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			p := (y - bounds.Min.Y) * dst.Stride
			invertBytes(dst.Pix[p : p+width])
		}
	}

	return nil
}

// NewReader returns an io.Reader that decodes the CCITT-formatted data in r.
// The resultant byte stream is one bit per pixel (MSB first), with 1 meaning
// white and 0 meaning black. Each row in the result is byte-aligned.
//
// A negative height, such as passing AutoDetectHeight, means that the image
// height is not known in advance. A negative width is invalid.
func NewReader(r io.Reader, order Order, sf SubFormat, width int, height int, opts *Options) io.Reader {
	readErr := error(nil)
	if width < 0 {
		readErr = errInvalidBounds
	} else if width > maxWidth {
		readErr = errUnsupportedWidth
	}

	return &reader{
		br:            bitReader{r: r, order: order},
		subFormat:     sf,
		align:         (opts != nil) && opts.Align,
		invert:        (opts != nil) && opts.Invert,
		width:         width,
		rowsRemaining: height,
		readErr:       readErr,
	}
}
