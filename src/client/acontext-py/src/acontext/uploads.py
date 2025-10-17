"""
Utilities for working with file uploads.
"""

import io
from dataclasses import dataclass
from typing import BinaryIO, Tuple


@dataclass(slots=True)
class FileUpload:
    """
    Represents a file payload for multipart requests.

    Accepts either a binary stream (any object exposing ``read``) or raw ``bytes``.
    """

    filename: str
    content: BinaryIO | bytes
    content_type: str | None = None

    def as_httpx(self) -> Tuple[str, BinaryIO, str | None]:
        """
        Convert to the tuple format expected by ``httpx``.
        """
        if isinstance(self.content, (bytes, bytearray)):
            buffer = io.BytesIO(self.content)
            return self.filename, buffer, self.content_type or "application/octet-stream"
        return self.filename, self.content, self.content_type or "application/octet-stream"


def normalize_file_upload(
    upload: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
) -> FileUpload:
    if isinstance(upload, FileUpload):
        return upload
    if isinstance(upload, tuple):
        if len(upload) == 2:
            filename, content = upload
            return FileUpload(filename=filename, content=content)
        if len(upload) == 3:
            filename, content, content_type = upload
            return FileUpload(filename=filename, content=content, content_type=content_type)
    raise TypeError("Unsupported file upload payload")
