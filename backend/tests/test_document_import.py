import io
import tempfile
import unittest
import zipfile
import subprocess
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from backend.app.main import create_app


def word_bytes(text="Returns accepted within 30 days."):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr("word/document.xml", f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
    return stream.getvalue()


def pdf_bytes(text=True, encrypted=False, content_padding=0):
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    if text:
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        content = DecodedStreamObject()
        content.set_data(b"BT /F1 12 Tf 20 250 Td (Returns accepted within 30 days.) Tj ET" + b" " * content_padding)
        page[NameObject("/Contents")] = content.flate_encode() if content_padding else content
    if encrypted:
        writer.encrypt("secret")
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


class DocumentImportTests(unittest.TestCase):
    def test_worker_start_failure_releases_slot(self):
        with patch("backend.app.services.document_import.subprocess.run", side_effect=OSError("private runtime path")):
            response = self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes())
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], "Local extractor could not start. Please try again.")
        self.assertEqual(self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes()).status_code, 200)

    def test_docx_zip_expansion_and_macros_are_rejected(self):
        for entry, data, message in [("word/vbaProject.bin", b"macro", "Macro-enabled"),
                                     ("large.bin", b"x" * 10000001, "expanded content")]:
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("[Content_Types].xml", "<Types/>")
                archive.writestr("word/document.xml", "<document/>")
                archive.writestr(entry, data)
            response = self.client.post("/document-import", params={"filename": "unsafe.docx"}, content=stream.getvalue())
            self.assertEqual(response.status_code, 422)
            self.assertIn(message, response.json()["detail"])

    def test_parser_timeout_and_busy_recovery(self):
        from backend.app.services.document_import import PARSERS
        with patch("backend.app.services.document_import.subprocess.run", side_effect=subprocess.TimeoutExpired("parser", 15)):
            response = self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes())
            self.assertEqual(response.status_code, 422)
            self.assertIn("timed out", response.json()["detail"])
        PARSERS.acquire()
        try:
            response = self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes())
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.headers.get("retry-after"), "1")
        finally:
            PARSERS.release()
        response = self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes())
        self.assertEqual(response.status_code, 200)

    def test_invalid_worker_result_is_an_actionable_error(self):
        for stdout in (b"not-json", b"[]", b'{"text": 5}', b'{"text": ""}'):
            with self.subTest(stdout=stdout), patch("backend.app.services.document_import.subprocess.run", return_value=SimpleNamespace(returncode=0, stdout=stdout)):
                response = self.client.post("/document-import", params={"filename": "policy.pdf"}, content=pdf_bytes())
                self.assertEqual(response.status_code, 422)

    def test_docx_tables_and_unsafe_xml(self):
        body = io.BytesIO()
        with zipfile.ZipFile(body, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table policy 30 days</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        result = self.client.post("/document-import", params={"filename": "table.docx"}, content=body.getvalue())
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["text"], "Table policy 30 days")
        body = io.BytesIO()
        with zipfile.ZipFile(body, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///private">]><a>&x;</a>')
        result = self.client.post("/document-import", params={"filename": "unsafe.docx"}, content=body.getvalue())
        self.assertEqual(result.status_code, 422)

    def test_bad_encrypted_empty_and_oversized_files_are_rejected(self):
        cases = [("old.doc", b"old", 422, "Legacy .doc"),
                 ("bad.pdf", b"not a PDF", 422, "valid PDF"),
                 ("encrypted.pdf", pdf_bytes(encrypted=True), 422, "Encrypted"),
                 ("scan.pdf", pdf_bytes(text=False), 422, "OCR"),
                 ("bad.docx", b"bad zip", 422, "Malformed"),
                 ("empty.pdf", b"", 422, "empty"),
                 ("big.pdf", b"x" * 2000001, 413, "2 MB"),
                 ("compressed.pdf", pdf_bytes(content_padding=2000001), 422, "resource limit"),
                 ("large.docx", word_bytes("a" * 10001), 422, "10,000")]
        for name, body, status, message in cases:
            with self.subTest(name=name):
                response = self.client.post("/document-import", params={"filename": name}, content=body)
                self.assertEqual(response.status_code, status, response.text)
                self.assertIn(message, response.json()["detail"])
        self.assertEqual(self.client.get("/document-runs").json(), [])

    def setUp(self):
        directory = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(directory.cleanup)
        self.client = TestClient(create_app(data_dir=directory.name, fixture_path=Path(directory.name) / "absent"))
        self.addCleanup(self.client.close)

    def test_pdf_and_docx_import_then_execute(self):
        for name, body in (("policy.pdf", pdf_bytes()), ("policy.docx", word_bytes())):
            with self.subTest(name=name):
                response = self.client.post("/document-import", params={"filename": name}, content=body)
                self.assertEqual(response.status_code, 200, response.text)
                document = response.json()
                self.assertIn("30 days", document["text"])
                document["topic"] = "returns policy"
                run = self.client.post("/document-runs", json={"question": "What is the returns policy?", "documents": [document]})
                self.assertEqual(run.status_code, 201)
                self.assertEqual(run.json()["outcome"], "success")
