import os
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
from core.vector_store import vector_store
from core.ingestion import ingest_document
from core.rag_engine import rag_engine
from core.summarizer import summarizer
from core.feedback_memory import feedback_memory
from core.study_tools import study_tools

app = FastAPI(title="StudyRAG - AI Study Assistant API")

# Enable CORS for flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
STATIC_DIR = config.BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class ChatRequest(BaseModel):
    query: str
    active_docs: Optional[List[str]] = None
    user_id: Optional[str] = "guest"
    history: Optional[List[dict]] = None
    web_search: Optional[bool] = False


class SummaryRequest(BaseModel):
    doc_name: str
    web_search: Optional[bool] = False


class StudyToolRequest(BaseModel):
    doc_name: str
    count: Optional[int] = 5
    web_search: Optional[bool] = False


class RenameRequest(BaseModel):
    old_name: str
    new_name: str


class FeedbackRequest(BaseModel):
    query: str
    answer: str
    rating: str  # "like" or "dislike"
    opinion: Optional[str] = None
    active_docs: Optional[List[str]] = None
    user_id: Optional[str] = "guest"
    user_id: Optional[str] = "guest"


@app.get("/")
async def root():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found.")
    return FileResponse(str(index_file))


@app.get("/api/health")
async def health_check():
    has_gemini = bool(config.GEMINI_API_KEY)
    has_qdrant_cloud = bool(config.QDRANT_URL and config.QDRANT_API_KEY)
    return {
        "status": "healthy",
        "gemini_api_configured": has_gemini,
        "qdrant_mode": "cloud" if has_qdrant_cloud else "local_disk",
        "collection": config.COLLECTION_NAME
    }


@app.get("/api/config")
async def get_config():
    return {
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "firebase_api_key": os.getenv("FIREBASE_API_KEY", ""),
        "firebase_auth_domain": os.getenv("FIREBASE_AUTH_DOMAIN", ""),
        "firebase_project_id": os.getenv("FIREBASE_PROJECT_ID", "")
    }


@app.get("/api/documents")
async def list_documents():
    """List all indexed documents and their status, including file sizes."""
    try:
        docs = vector_store.get_all_documents()
        for d in docs:
            fp = config.UPLOAD_DIR / d["name"]
            d["file_size_bytes"] = fp.stat().st_size if fp.exists() else 0
        return {"documents": docs}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document (PDF, TXT, MD), chunk, embed with Gemini, and index into Qdrant."""
    filename = file.filename
    extension = Path(filename).suffix.lower()
    if extension not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    file_path = config.UPLOAD_DIR / filename
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process and ingest
        ingest_result = ingest_document(file_path, filename)
        return {
            "status": "success",
            "message": f"Successfully ingested {filename}",
            "document": ingest_result
        }
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.delete("/api/documents/{doc_name}")
async def delete_document(doc_name: str):
    """Delete a document from the Qdrant vector store and the uploads folder."""
    try:
        deleted_count = vector_store.delete_document(doc_name)
        # Also delete the file from the uploads folder
        file_path = config.UPLOAD_DIR / doc_name
        file_deleted = False
        if file_path.exists():
            file_path.unlink()
            file_deleted = True
        return {
            "status": "success",
            "message": f"Deleted {doc_name}",
            "chunks_removed": deleted_count,
            "file_deleted": file_deleted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@app.post("/api/documents/rename")
async def rename_document(req: RenameRequest):
    """Rename a document in the Qdrant vector store and the uploads folder."""
    try:
        updated_count = vector_store.rename_document(req.old_name, req.new_name)
        # Also rename the file in the uploads folder if it exists
        old_path = config.UPLOAD_DIR / req.old_name
        new_path = config.UPLOAD_DIR / req.new_name
        file_renamed = False
        if old_path.exists():
            old_path.rename(new_path)
            file_renamed = True
        return {
            "status": "success",
            "message": f"Renamed {req.old_name} to {req.new_name}",
            "chunks_updated": updated_count,
            "file_renamed": file_renamed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rename failed: {str(e)}")


@app.get("/api/file_info/{doc_name}")
async def get_file_info(doc_name: str):
    """Return file size, chunk count, and page count for a document."""
    try:
        # File size from uploads folder
        file_path = config.UPLOAD_DIR / doc_name
        file_size = file_path.stat().st_size if file_path.exists() else None

        # Chunk count and page count from Qdrant
        docs = vector_store.get_all_documents()
        doc_info = next((d for d in docs if d["name"] == doc_name), None)
        chunk_count = doc_info["chunk_count"] if doc_info else 0
        page_count = doc_info["pages"] if doc_info else 0

        return {
            "doc_name": doc_name,
            "file_size_bytes": file_size,
            "chunk_count": chunk_count,
            "page_count": page_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File info failed: {str(e)}")


@app.get("/api/files/{doc_name}")
async def serve_file(doc_name: str, download: bool = False):
    """
    Serve the original file:
    - View original file directly in browser tab (inline viewing with native browser PDF reader)
    - Download in original format when download=True
    """
    file_path = config.UPLOAD_DIR / doc_name
    if not file_path.exists():
        # Fallback: check if text exists in vector store
        full_text = vector_store.get_document_full_text(doc_name)
        if full_text:
            from fastapi.responses import PlainTextResponse
            headers = {"Content-Disposition": f'{"attachment" if download else "inline"}; filename="{doc_name}.txt"'}
            return PlainTextResponse(content=full_text, headers=headers)
        raise HTTPException(status_code=404, detail=f"File '{doc_name}' not found on server.")

    suffix = file_path.suffix.lower()
    media_type = "application/pdf" if suffix == ".pdf" else "text/plain" if suffix in [".txt", ".md"] else "application/octet-stream"

    headers = {
        "Content-Disposition": f'{"attachment" if download else "inline"}; filename="{doc_name}"'
    }

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=doc_name if download else None,
        headers=headers
    )


@app.post("/api/chat")
async def chat_query(req: ChatRequest):
    """
    Grounded Question Answering:
    - Answers only from uploaded sources
    - Exact inline citations [1], [2] linked to pages and excerpts
    - Zero hallucination ("I don't know" when not in notes)
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        result = rag_engine.generate_grounded_answer(
            query=req.query,
            active_docs=req.active_docs,
            user_id=req.user_id or "guest",
            history=req.history,
            web_search=bool(req.web_search)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")


@app.post("/api/summary")
async def summarize(req: SummaryRequest):
    """Generate structured chapter/document summary using Gemini Flash's 1M context."""
    if not req.doc_name.strip():
        raise HTTPException(status_code=400, detail="doc_name is required.")

    try:
        summary_result = summarizer.summarize_document(req.doc_name, web_search=bool(req.web_search))
        return summary_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@app.post("/api/study/mcq")
async def generate_mcq_quiz(req: StudyToolRequest):
    """Generate interactive multiple choice questions from an uploaded document."""
    if not req.doc_name.strip():
        raise HTTPException(status_code=400, detail="doc_name is required.")
    try:
        mcq_result = study_tools.generate_mcqs(req.doc_name, count=req.count or 5, web_search=bool(req.web_search))
        return mcq_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCQ generation failed: {str(e)}")


@app.post("/api/study/flashcards")
async def generate_flashcards(req: StudyToolRequest):
    """Generate active recall flashcards from an uploaded document."""
    if not req.doc_name.strip():
        raise HTTPException(status_code=400, detail="doc_name is required.")
    try:
        cards_result = study_tools.generate_flashcards(req.doc_name, count=req.count or 6, web_search=bool(req.web_search))
        return cards_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcards generation failed: {str(e)}")


@app.post("/api/study/cheatsheet")
async def generate_cheatsheet(req: StudyToolRequest):
    """Generate high-yield exam revision cheat sheet from an uploaded document."""
    if not req.doc_name.strip():
        raise HTTPException(status_code=400, detail="doc_name is required.")
    try:
        sheet_result = study_tools.generate_cheatsheet(req.doc_name, web_search=bool(req.web_search))
        return sheet_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cheat sheet generation failed: {str(e)}")


@app.get("/api/doc_page/{doc_name}/{page}")
async def get_doc_page(doc_name: str, page: int):
    """Fetch text of a specific page for the PDF Ground-Truth Viewer."""
    try:
        page_text = vector_store.get_page_text(doc_name, page)
        return {
            "doc_name": doc_name,
            "page": page,
            "text": page_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Save user feedback (like/dislike/opinion) to continuously adapt and improve agent responses."""
    try:
        entry = feedback_memory.add_feedback(
            query=req.query,
            answer=req.answer,
            rating=req.rating,
            opinion=req.opinion,
            active_docs=req.active_docs,
            user_id=req.user_id or "guest"
        )
        return {
            "status": "success",
            "message": "Feedback recorded. StudyRAG has adapted its preferences.",
            "feedback": entry
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")


@app.get("/api/feedback/stats")
async def get_feedback_stats():
    """Return learning analytics and user preference rules."""
    return feedback_memory.get_stats()


@app.post("/api/feedback/clear")
async def clear_feedback_data():
    """Reset continuous learning memory."""
    feedback_memory.clear_all()
    return {"status": "success", "message": "Feedback memory reset successfully."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
