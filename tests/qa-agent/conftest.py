import sys
from importlib.abc import MetaPathFinder, Loader
from importlib.util import spec_from_loader
from unittest.mock import MagicMock

# This conftest.py is generated to prevent module-loading-time side effects
# from crashing pytest collection. It is needed when a service connects to
# external infrastructure (databases, caches, etc.) at module level.

# A set of top-level module names that should be mocked out.
# These are drivers for external infrastructure that are not available in
# the sandboxed test environment.
FORBIDDEN_DRIVERS = {
    "sqlalchemy",
    "psycopg2",
    "pymysql",
    "redis",
    "celery",
    "tortoise",
    "asyncpg",
    "pymongo",
    "boto3",
    "botocore",
    "google",
    "go_mysql",
    "go_pq",
    "go_sqlite",
    "go_sql_sqlite",
    "go_sql_postgres",
    "go_sql_mysql",
}

class _MockLoader(Loader):
    """A mock loader that creates a MagicMock for any module it loads."""
    def create_module(self, spec):
        mock = MagicMock()
        # Make the mock look like a module.
        mock.__path__ = []
        mock.__name__ = spec.name
        return mock

    def exec_module(self, module):
        """No-op, the module is already a mock."""
        pass

class _ForbiddenDriverFinder(MetaPathFinder):
    """A meta_path finder that intercepts imports of forbidden drivers."""
    def find_spec(self, fullname, path, target=None):
        """Return a mock loader spec if the module is in FORBIDDEN_DRIVERS."""
        top_level_module = fullname.split(".")[0]
        if top_level_module in FORBIDDEN_DRIVERS:
            return spec_from_loader(fullname, _MockLoader())
        return None

# Install the finder at the beginning of the meta_path list to ensure it
# runs before the standard importers.
sys.meta_path.insert(0, _ForbiddenDriverFinder())
