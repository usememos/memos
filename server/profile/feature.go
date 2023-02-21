package profile

import "strings"

type FeatureType string

const (
	FeatureSSO       FeatureType = "SSO"
	FeatureStorageS3 FeatureType = "STORAGE_S3"
)

func (p *Profile) IsFeatureEnabled(feat FeatureType) bool {
	for _, f := range strings.Split(p.Feature, ",") {
		if f == string(feat) {
			return true
		}
	}
	return p.Feature == "ALL"
}
