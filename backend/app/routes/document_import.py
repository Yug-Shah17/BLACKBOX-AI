from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from backend.app.services.document_import import MAX_BYTES, extract_isolated
from backend.app.services.documents import Document

router = APIRouter(tags=["Document workflow"])


@router.post("/document-import", response_model=Document)
async def import_document(request: Request, filename: str):
    suffix = Path(filename).suffix.lower()
    if suffix not in (".pdf", ".docx") or not filename.strip() or len(filename) > 200:
        raise HTTPException(422, "Choose a PDF or DOCX with a filename of at most 200 characters. Legacy .doc is unsupported.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Maximum PDF/DOCX file size is 2 MB.")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Document is empty.")
    try:
        text = await run_in_threadpool(extract_isolated, bytes(data), suffix)
    except BlockingIOError as error:
        raise HTTPException(503, str(error), headers={"Retry-After": "1"}) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return Document(documentId=f"upload-{uuid4()}", title=filename,
                    topic=f"{Path(filename).stem} {text}"[:200], text=text)
