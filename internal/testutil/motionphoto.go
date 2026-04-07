package testutil

// BuildMotionPhotoJPEG returns a minimal JPEG blob with Motion Photo metadata
// and an embedded MP4 header for tests.
func BuildMotionPhotoJPEG() []byte {
	return append(
		[]byte{
			0xFF, 0xD8, 0xFF, 0xE1,
		},
		append(
			[]byte(`<?xpacket begin=""?><rdf:Description GCamera:MotionPhoto="1" GCamera:MotionPhotoPresentationTimestampUs="123456"></rdf:Description>`),
			[]byte{
				0xFF, 0xD9,
				0x00, 0x00, 0x00, 0x10, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0x00, 0x00, 0x00, 0x00,
			}...,
		)...,
	)
}
