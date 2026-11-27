import os
import re
import fitz  # PyMuPDF
from typing import List, Dict, Any, Tuple
from pathlib import Path
import config
from core.vector_store import vector_store

try:
    from google import genai
    from google.genai import types
    _NEW_GENAI = True
except ImportError:
    import google.generativeai as genai_legacy
    _NEW_GENAI = False


def get_embedding_client():
    """Returns an initialized Gemini client."""
    api_key = config.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Please set it in .env or environment.")
    
    if _NEW_GENAI:
        return genai.Client(api_key=api_key)
    else:
        genai_legacy.configure(api_key=api_key)
        return genai_legacy


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a list of text strings using Gemini text-embedding-004 API."""
    if not texts:
        return []

    client = get_embedding_client()
    embeddings = []
    
    # Process in batches of 16 to respect free-tier payload limits
    batch_size = 16
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        if _NEW_GENAI:
            # Using google-genai SDK
            response = client.models.embed_content(
                model=config.EMBEDDING_MODEL,
                contents=batch
            )
            # Response has embeddings list
            for emb in response.embeddings:
                embeddings.append(emb.values)
        else:
            # Fallback to google-generativeai
            for text in batch:
                res = genai_legacy.embed_content(
                    model=config.EMBEDDING_MODEL,
                    content=text,
                    task_type="retrieval_document"
                )
                embeddings.append(res['embedding'])

    return embeddings


def embed_query(query: str) -> List[float]:
    """Embed a single search query using Gemini text-embedding-004."""
    client = get_embedding_client()
    if _NEW_GENAI:
        response = client.models.embed_content(
            model=config.EMBEDDING_MODEL,
            contents=[query]
        )
        return response.embeddings[0].values
    else:
        res = genai_legacy.embed_content(
            model=config.EMBEDDING_MODEL,
            content=query,
            task_type="retrieval_query"
        )
        return res['embedding']


def split_text_into_chunks(text: str, chunk_size: int = config.CHUNK_SIZE, overlap: int = config.CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks respecting sentence or paragraph boundaries."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:].strip())
            break

        # Look for sentence break within the last 15% of the chunk window
        search_window = text[max(start, end - overlap):end + 50]
        sentence_end = re.search(r'[.!?\n]', search_window)
        if sentence_end:
            actual_end = max(start, end - overlap) + sentence_end.end()
        else:
            actual_end = end

        chunk = text[start:actual_end].strip()
        if chunk:
            chunks.append(chunk)

        start = max(start + 1, actual_end - overlap)

    return chunks


def parse_and_chunk_pdf(file_path: Path, doc_name: str) -> Tuple[List[Dict[str, Any]], int]:
    """Extract pages from a PDF file with page metadata, then chunk each page."""
    doc = fitz.open(str(file_path))
    total_pages = len(doc)
    all_chunks = []
    chunk_counter = 0

    for page_num in range(1, total_pages + 1):
        page = doc.load_page(page_num - 1)
        page_text = page.get_text("text").strip()
        if not page_text:
            continue

        page_chunks = split_text_into_chunks(page_text)
        for c_text in page_chunks:
            chunk_counter += 1
            all_chunks.append({
                "doc_name": doc_name,
                "page": page_num,
                "total_pages": total_pages,
                "chunk_id": chunk_counter,
                "text": c_text
            })

    doc.close()
    return all_chunks, total_pages


def parse_and_chunk_text(file_path: Path, doc_name: str) -> Tuple[List[Dict[str, Any]], int]:
    """Parse a plain text or markdown file, splitting into chunks with synthetic page counts."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    chunks = split_text_into_chunks(content)
    total_chunks = len(chunks)
    # Estimate ~4 chunks per "page" for citation purposes
    total_pages = max(1, (total_chunks + 3) // 4)
    all_chunks = []

    for i, c_text in enumerate(chunks):
        page_num = (i // 4) + 1
        all_chunks.append({
            "doc_name": doc_name,
            "page": page_num,
            "total_pages": total_pages,
            "chunk_id": i + 1,
            "text": c_text
        })

    return all_chunks, total_pages


def ingest_document(file_path: Path, filename: str) -> Dict[str, Any]:
    """Full ingestion pipeline: Parse -> Chunk -> Embed with Gemini -> Store in Qdrant."""
    doc_name = filename
    extension = file_path.suffix.lower()

    if extension == ".pdf":
        chunks, total_pages = parse_and_chunk_pdf(file_path, doc_name)
    elif extension in [".txt", ".md"]:
        chunks, total_pages = parse_and_chunk_text(file_path, doc_name)
    else:
        raise ValueError(f"Unsupported file format: {extension}. Please upload a PDF or TXT file.")

    if not chunks:
        raise ValueError(f"Could not extract any readable text from {filename}.")

    # Generate embeddings via Gemini text-embedding-004
    texts_to_embed = [c["text"] for c in chunks]
    embeddings = embed_texts(texts_to_embed)

    # Store in Qdrant
    indexed_count = vector_store.upsert_chunks(chunks, embeddings)

    return {
        "doc_name": doc_name,
        "total_pages": total_pages,
        "total_chunks": indexed_count,
        "status": "Ready"
    }
