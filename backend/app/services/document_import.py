"""Bounded plain-text extraction in a separate, time-limited local process."""

import io
import json
import subprocess
import sys
import threading
import zipfile
from pathlib import Path

MAX_BYTES = 2_000_000
MAX_TEXT = 10000
ROOT = Path(__file__).resolve().parents[3]
PARSERS = threading.BoundedSemaphore(1)


def extract(data, suffix):
    if suffix == ".pdf":
        from pypdf import PdfReader, apply_configuration
        from pypdf.errors import LimitReachedError
        if not data.startswith(b"%PDF-"):
            raise ValueError("File is not a valid PDF.")
        # Cap decoding itself, before the post-extraction page/text checks.
        try:
            with apply_configuration(maximum_declared_stream_length=MAX_BYTES,
                    array_based_stream_maximum_output_length=MAX_BYTES,
                    zlib_maximum_output_length=MAX_BYTES, lzw_maximum_output_length=MAX_BYTES,
                    run_length_maximum_output_length=MAX_BYTES, image_maximum_buffer_size=MAX_BYTES,
                    page_tree_maximum_entries=256, page_tree_maximum_depth=32,
                    xform_maximum_invocations_per_extraction=256):
                reader = PdfReader(io.BytesIO(data), strict=True)
                if reader.is_encrypted:
                    raise ValueError("Encrypted PDFs are not supported. Upload an unencrypted copy.")
                if len(reader.pages) > 20:
                    raise ValueError("PDFs must contain at most 20 pages.")
                parts = []
                total = 0
                for page in reader.pages:
                    contents = page.get_contents()
                    if contents is not None and len(contents.get_data()) > MAX_BYTES:
                        raise ValueError("PDF page content is too large to extract safely.")
                    text = page.extract_text() or ""
                    total += len(text) + 1
                    if total > MAX_TEXT + 1:
                        raise ValueError("Extracted text exceeds 10,000 characters. Split the document.")
                    parts.append(text)
                text = "\n".join(parts).strip()
        except LimitReachedError as error:
            raise ValueError("PDF resource limit reached. Try a smaller or simpler PDF.") from error
    else:
        from defusedxml.ElementTree import fromstring
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 1000 or sum(item.file_size for item in entries) > 10_000_000:
                raise ValueError("DOCX expanded content is too large.")
            names = [item.filename for item in entries]
            if len(names) != len(set(names)) or "[Content_Types].xml" not in names:
                raise ValueError("File is not a valid DOCX.")
            if "word/vbaProject.bin" in names:
                raise ValueError("Macro-enabled documents are not supported.")
            info = archive.getinfo("word/document.xml")
            if info.file_size > MAX_BYTES:
                raise ValueError("DOCX document content is too large.")
            root = fromstring(archive.read(info))
            ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
            if root.tag != ns + "document":
                raise ValueError("File is not a valid DOCX.")
            paragraphs = []
            for paragraph in root.iter(ns + "p"):
                paragraphs.append("".join(node.text or "" if node.tag == ns + "t" else "\t" if node.tag == ns + "tab" else "\n"
                    for node in paragraph.iter() if node.tag in (ns + "t", ns + "tab", ns + "br")))
            text = "\n".join(paragraphs).strip()
    if not text:
        raise ValueError("No extractable text found. Scanned/image-only files need OCR, which is not supported.")
    if len(text) > MAX_TEXT:
        raise ValueError("Extracted text exceeds 10,000 characters. Split the document.")
    return text


def extract_isolated(data, suffix):
    if not PARSERS.acquire(blocking=False):
        raise BlockingIOError("Another document is being extracted. Please try again.")
    try:
        result = subprocess.run([sys.executable, "-B", "-m", "backend.app.services.document_import", suffix],
            input=data, capture_output=True, cwd=ROOT, timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        if result.returncode:
            raise ValueError("Could not extract this document.")
        try:
            value = json.loads(result.stdout)
        except (ValueError, UnicodeError) as error:
            raise ValueError("Invalid extractor response. Please try again.") from error
        if not isinstance(value, dict):
            raise ValueError("Invalid extractor response. Please try again.")
        if "error" in value:
            raise ValueError(value["error"] if isinstance(value["error"], str) else "Could not extract this document.")
        if not isinstance(value.get("text"), str) or not value["text"].strip() or len(value["text"]) > MAX_TEXT:
            raise ValueError("Invalid extractor response. Please try again.")
        return value["text"]
    except subprocess.TimeoutExpired as error:
        raise ValueError("Extraction timed out. Try a smaller or simpler document.") from error
    except OSError as error:
        raise ValueError("Local extractor could not start. Please try again.") from error
    finally:
        PARSERS.release()


if __name__ == "__main__":
    try:
        data = sys.stdin.buffer.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("Maximum PDF/DOCX file size is 2 MB.")
        output = {"text": extract(data, sys.argv[1])}
    except ValueError as error:
        output = {"error": str(error)}
    except Exception:
        output = {"error": "Malformed or unsupported document. Upload a valid PDF or DOCX."}
    sys.stdout.buffer.write(json.dumps(output).encode("utf-8"))
