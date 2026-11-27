import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
import config

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        self.collection_name = config.COLLECTION_NAME
        self.client = self._init_client()
        self._ensure_collection()

    def _init_client(self) -> QdrantClient:
        """Initialize Qdrant client either via Qdrant Cloud or local disk fallback."""
        if config.QDRANT_URL and config.QDRANT_API_KEY:
            logger.info(f"Connecting to Qdrant Cloud at {config.QDRANT_URL}")
            return QdrantClient(
                url=config.QDRANT_URL,
                api_key=config.QDRANT_API_KEY,
                timeout=30.0
            )
        else:
            logger.info(f"Using local Qdrant storage at {config.LOCAL_QDRANT_PATH}")
            return QdrantClient(path=config.LOCAL_QDRANT_PATH)

    def _ensure_collection(self):
        """Ensure the collection exists with the configured vector dimension and Cosine distance."""
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            if exists:
                # Check vector size to ensure compatibility
                col_info = self.client.get_collection(self.collection_name)
                current_size = col_info.config.params.vectors.size
                if current_size != config.VECTOR_SIZE:
                    logger.info(f"Recreating collection {self.collection_name} to match new vector size {config.VECTOR_SIZE}")
                    self.client.delete_collection(self.collection_name)
                    exists = False

            if not exists:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=config.VECTOR_SIZE,
                        distance=qmodels.Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection: {self.collection_name} (dim: {config.VECTOR_SIZE})")
        except Exception as e:
            logger.error(f"Error checking/creating collection: {e}")

    def upsert_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]) -> int:
        """Upsert a list of text chunks and their embeddings into Qdrant."""
        if not chunks or not embeddings:
            return 0

        points = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            point_id = chunk.get("id") or abs(hash(f"{chunk['doc_name']}_{chunk['page']}_{chunk['chunk_id']}")) % (2**63 - 1)
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=emb,
                    payload={
                        "doc_name": chunk["doc_name"],
                        "page": chunk["page"],
                        "total_pages": chunk.get("total_pages", 1),
                        "chunk_id": chunk["chunk_id"],
                        "text": chunk["text"]
                    }
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        return len(points)

    def search(
        self,
        query_vector: List[float],
        top_k: int = config.TOP_K_RETRIEVAL,
        active_docs: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Search for top_k relevant chunks, optionally filtered by active document names."""
        query_filter = None
        if active_docs and len(active_docs) > 0:
            query_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="doc_name",
                        match=qmodels.MatchAny(any=active_docs)
                    )
                ]
            )

        if hasattr(self.client, "query_points"):
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True
            )
            results = response.points
        else:
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True
            )

        formatted = []
        for res in results:
            formatted.append({
                "score": float(res.score),
                "doc_name": res.payload.get("doc_name"),
                "page": res.payload.get("page"),
                "total_pages": res.payload.get("total_pages", 1),
                "chunk_id": res.payload.get("chunk_id"),
                "text": res.payload.get("text")
            })
        return formatted

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """Retrieve a summary of all uploaded documents in the vector store."""
        try:
            scroll_result, _ = self.client.scroll(
                collection_name=self.collection_name,
                limit=10000,
                with_payload=True,
                with_vectors=False
            )
            doc_map = {}
            for point in scroll_result:
                payload = point.payload or {}
                name = payload.get("doc_name")
                page = payload.get("page", 1)
                total_pages = payload.get("total_pages", 1)
                if not name:
                    continue
                if name not in doc_map:
                    doc_map[name] = {
                        "name": name,
                        "pages": total_pages,
                        "chunk_count": 0,
                        "status": "Ready"
                    }
                doc_map[name]["chunk_count"] += 1
                doc_map[name]["pages"] = max(doc_map[name]["pages"], page, total_pages)

            return list(doc_map.values())
        except Exception as e:
            logger.error(f"Error fetching documents: {e}")
            return []

    def get_document_full_text(self, doc_name: str) -> str:
        """Fetch all text chunks belonging to a document, sorted by page and chunk_id."""
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="doc_name",
                    match=qmodels.MatchValue(value=doc_name)
                )
            ]
        )
        scroll_result, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=5000,
            with_payload=True,
            with_vectors=False
        )
        points = sorted(
            scroll_result,
            key=lambda p: (p.payload.get("page", 0), p.payload.get("chunk_id", 0))
        )
        pages_dict = {}
        for p in points:
            page_num = p.payload.get("page", 1)
            text = p.payload.get("text", "")
            if page_num not in pages_dict:
                pages_dict[page_num] = []
            pages_dict[page_num].append(text)

        full_text_parts = []
        for page_num in sorted(pages_dict.keys()):
            full_text_parts.append(f"--- [Page {page_num}] ---\n" + "\n".join(pages_dict[page_num]))

        return "\n\n".join(full_text_parts)

    def get_page_text(self, doc_name: str, page: int) -> str:
        """Fetch text specifically for a single page."""
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(key="doc_name", match=qmodels.MatchValue(value=doc_name)),
                qmodels.FieldCondition(key="page", match=qmodels.MatchValue(value=page))
            ]
        )
        scroll_result, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=100,
            with_payload=True,
            with_vectors=False
        )
        points = sorted(scroll_result, key=lambda p: p.payload.get("chunk_id", 0))
        return "\n\n".join([p.payload.get("text", "") for p in points])

    def delete_document(self, doc_name: str) -> int:
        """Delete all chunks belonging to a document from the collection."""
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="doc_name",
                    match=qmodels.MatchValue(value=doc_name)
                )
            ]
        )
        scroll_result, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=10000,
            with_payload=False,
            with_vectors=False
        )
        point_ids = [p.id for p in scroll_result]
        if point_ids:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qmodels.PointIdsList(points=point_ids)
            )
        return len(point_ids)

    def rename_document(self, old_name: str, new_name: str) -> int:
        """Rename all chunks of a document by updating their doc_name payload field."""
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="doc_name",
                    match=qmodels.MatchValue(value=old_name)
                )
            ]
        )
        scroll_result, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=10000,
            with_payload=False,
            with_vectors=False
        )
        point_ids = [p.id for p in scroll_result]
        if point_ids:
            self.client.set_payload(
                collection_name=self.collection_name,
                payload={"doc_name": new_name},
                points=point_ids
            )
        return len(point_ids)

# Global singleton
vector_store = VectorStore()
