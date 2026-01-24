"""
FastAPI endpoint tests.

This test module uses auto-use fixtures to enable testing:
1. mock_lifespan: Prevents the FastAPI app's lifespan from initializing infrastructure

Test Strategy:
- Uses httpx.AsyncClient with ASGITransport to test the async ASGI app
- AsyncClient runs the app in the same event loop, avoiding thread/loop conflicts
- Each test creates its own local DatabaseClient for isolation
- The routers.session.DB_CLIENT is patched so the endpoint uses the test's database
- This allows proper async database operations without event loop mismatches
"""

import pytest
from unittest.mock import patch


@pytest.fixture(autouse=True)
def mock_lifespan():
    """
    Mock the FastAPI app lifespan to prevent multiple initializations.

    This fixture:
    - Patches setup() and cleanup() to avoid conflicts with test database clients
    - Applies automatically to all tests (autouse=True)
    """

    async def mock_setup():
        pass

    async def mock_cleanup():
        pass

    with patch("api.setup", side_effect=mock_setup), patch(
        "api.cleanup", side_effect=mock_cleanup
    ), patch("api.start_mq", side_effect=lambda: None):
        yield
