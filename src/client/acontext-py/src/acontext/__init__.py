"""
Compatibility shim so users can import ``acontext`` even though the published
distribution is named ``acontext-py``. All public symbols from
``acontext_py`` are re-exported here.
"""

from __future__ import annotations

from acontext_py import *  # noqa: F401,F403 - re-export intended
