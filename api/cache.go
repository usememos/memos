package api

// CacheNamespace is the type of a cache.
type CacheNamespace string

const (
	// UserCache is the cache type of users.
	UserCache CacheNamespace = "u"
	// MemoCache is the cache type of memos.
	MemoCache CacheNamespace = "m"
	// ShortcutCache is the cache type of shortcuts.
	ShortcutCache CacheNamespace = "s"
	// ResourceCache is the cache type of resources.
	ResourceCache CacheNamespace = "r"
)

// CacheService is the service for caches.
type CacheService interface {
	FindCache(namespace CacheNamespace, id int, entry interface{}) (bool, error)
	UpsertCache(namespace CacheNamespace, id int, entry interface{}) error
	DeleteCache(namespace CacheNamespace, id int)
}
