// Copyright 2019 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ccitt

import (
	"encoding/binary"
	"io"
)

type bitWriter struct {
	w io.Writer

	// order is whether to process w's bytes LSB first or MSB first.
	order Order

	// The high nBits bits of the bits field hold encoded bits to be written to w.
	bits  uint64
	nBits uint32

	// bytes[:bw] holds encoded bytes not yet written to w.
	// Overflow protection is ensured by using a multiple of 8 as bytes length.
	bw    uint32
	bytes [1024]uint8
}

// flushBits copies 64 bits from b.bits to b.bytes. If b.bytes is then full, it
// is written to b.w.
func (b *bitWriter) flushBits() error {
	binary.BigEndian.PutUint64(b.bytes[b.bw:], b.bits)
	b.bits = 0
	b.nBits = 0
	b.bw += 8
	if b.bw < uint32(len(b.bytes)) {
		return nil
	}
	b.bw = 0
	if b.order != MSB {
		reverseBitsWithinBytes(b.bytes[:])
	}
	_, err := b.w.Write(b.bytes[:])
	return err
}

// close finalizes a bitcode stream by writing any
// pending bits to bitWriter's underlying io.Writer.
func (b *bitWriter) close() error {
	// Write any encoded bits to bytes.
	if b.nBits > 0 {
		binary.BigEndian.PutUint64(b.bytes[b.bw:], b.bits)
		b.bw += (b.nBits + 7) >> 3
	}

	if b.order != MSB {
		reverseBitsWithinBytes(b.bytes[:b.bw])
	}

	// Write b.bw bytes to b.w.
	_, err := b.w.Write(b.bytes[:b.bw])
	return err
}

// alignToByteBoundary rounds b.nBits up to a multiple of 8.
// If all 64 bits are used, flush them to bitWriter's bytes.
func (b *bitWriter) alignToByteBoundary() error {
	if b.nBits = (b.nBits + 7) &^ 7; b.nBits == 64 {
		return b.flushBits()
	}
	return nil
}

// writeCode writes a variable length bitcode to b's underlying io.Writer.
func (b *bitWriter) writeCode(bs bitString) error {
	bits := bs.bits
	nBits := bs.nBits
	if 64-b.nBits >= nBits {
		// b.bits has sufficient room for storing nBits bits.
		b.bits |= uint64(bits) << (64 - nBits - b.nBits)
		b.nBits += nBits
		if b.nBits == 64 {
			return b.flushBits()
		}
		return nil
	}

	// Number of leading bits that fill b.bits.
	i := 64 - b.nBits

	// Fill b.bits then flush and write remaining bits.
	b.bits |= uint64(bits) >> (nBits - i)
	b.nBits = 64

	if err := b.flushBits(); err != nil {
		return err
	}

	nBits -= i
	b.bits = uint64(bits) << (64 - nBits)
	b.nBits = nBits
	return nil
}
