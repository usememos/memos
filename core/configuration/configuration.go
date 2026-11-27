// Package configuration reads declarative configuration: the identity
// providers, instance settings, and users an instance should have, declared in
// JSON files as public API resources.
//
// Load reads every *.json file in a directory, substitutes ${env:NAME} and
// ${file:PATH} references, decodes each file strictly as one
// memos.api.Configuration, checks the schema rules that need no database,
// merges the files into one desired state, and runs each resource's own rules
// from core/identityprovider and core/instancesetting. See
// docs/design/declarative-configuration.md.
package configuration

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// DefaultDir is the configuration directory used when none is given.
const DefaultDir = "/etc/memos/config"

const (
	maxFileSize           = 1 << 20
	maxReferencedFileSize = 64 << 10
)

// Desired is the desired state merged from every file in a configuration directory.
type Desired struct {
	// Configuration is every file merged into one document.
	Configuration *apipb.Configuration
	// Sources maps each declared resource name to the file that declares it.
	Sources map[string]string
	// UserFields maps each declared user to the optional fields its file
	// declares, by JSON name. A user's profile is managed only where declared,
	// and presence is lost once a document is decoded.
	UserFields map[string][]string
	// Warnings are diagnostics that do not stop the load, such as deprecated fields.
	Warnings []string
}

// Resolver supplies the values ${env:NAME} and ${file:PATH} references name.
type Resolver struct {
	LookupEnv func(name string) (string, bool)
	ReadFile  func(path string) ([]byte, error)
}

// OSResolver resolves references from the process environment and filesystem.
func OSResolver() Resolver {
	return Resolver{
		LookupEnv: os.LookupEnv,
		ReadFile: func(path string) ([]byte, error) {
			return readRegularFile(path, maxReferencedFileSize)
		},
	}
}

// ValidationError lists every problem found in a configuration directory.
type ValidationError struct {
	Problems []string
}

func (e *ValidationError) Error() string {
	return "invalid configuration:\n  " + strings.Join(e.Problems, "\n  ")
}

// Load reads, decodes, and merges the configuration files in dir. A missing
// directory is an empty desired state. Problems in the files are returned
// together as a *ValidationError; an unreadable directory or file is returned
// on its own.
func Load(dir string, resolver Resolver) (*Desired, error) {
	desired := &Desired{
		Configuration: &apipb.Configuration{},
		Sources:       map[string]string{},
		UserFields:    map[string][]string{},
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return desired, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to read configuration directory")
	}

	m := newMerger(desired)
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		path := filepath.Join(dir, name)
		info, err := os.Stat(path)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to inspect %s", name)
		}
		if !info.Mode().IsRegular() {
			continue
		}
		content, err := readRegularFile(path, maxFileSize)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to read %s", name)
		}
		document, userFields, warnings, problems := decodeDocument(content, resolver)
		for _, warning := range warnings {
			desired.Warnings = append(desired.Warnings, name+": "+warning)
		}
		if len(problems) == 0 {
			problems = checkDocument(document)
		}
		if len(problems) > 0 {
			for _, problem := range problems {
				m.problems = append(m.problems, name+": "+problem)
			}
			continue
		}
		m.add(name, document, userFields)
	}
	m.checkReferences()
	m.problems = append(m.problems, checkResources(desired)...)
	if len(m.problems) > 0 {
		return nil, &ValidationError{Problems: m.problems}
	}
	return desired, nil
}

// readRegularFile reads at most limit bytes of a regular file, following
// symlinks, and fails when the file is larger.
func readRegularFile(path string, limit int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("not a regular file")
	}
	content, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > limit {
		return nil, errors.Errorf("larger than %d bytes", limit)
	}
	return content, nil
}
