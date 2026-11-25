import os
import sys
import tempfile

# Banco temporário e segredo fixo antes de importar o app
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="divup-test-")
os.environ["SESSION_SECRET"] = "test-secret"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

from app.core.db import connect, init_db  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    init_db()
    with connect() as conn:
        for table in ("reads", "casas", "settings"):
            conn.execute(f"DELETE FROM {table}")
    yield
