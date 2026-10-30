"""
Service module for querying MCU canon rules and knowledge documents from MongoDB.
Provides vector search with keyword/regex fallbacks.
"""

from typing import List, Dict, Any, Optional
import os
import re
from db import summaries_collection


class CanonContextService:
    """Retrieves established MCU canon records from MongoDB collections."""

    @staticmethod
    def get_canon_context_by_keywords(keywords: List[str], limit: int = 4) -> List[Dict[str, str]]:
        """
        Query MongoDB summaries using regex keyword matching when vector search index is unavailable.
        """
        if not keywords:
            return []

        try:
            pattern = "|".join([re.escape(k) for k in keywords if len(k) > 2])
            if not pattern:
                return []

            query = {
                "$or": [
                    {"title": {"$regex": pattern, "$options": "i"}},
                    {"summary": {"$regex": pattern, "$options": "i"}}
                ]
            }
            cursor = summaries_collection.find(query, {"title": 1, "summary": 1, "_id": 0}).limit(limit)
            return [{"title": doc.get("title", ""), "summary": doc.get("summary", "")} for doc in cursor]
        except Exception as e:
            print(f"[WARN] Keyword canon query failed: {e}")
            return []

    @staticmethod
    def get_canon_context_by_vector(query_vector: List[float], limit: int = 4) -> List[Dict[str, str]]:
        """
        Query MongoDB using Atlas Vector Search if configured.
        """
        try:
            pipeline = [
                {
                    "$search": {
                        "index": "default",
                        "knnBeta": {
                            "vector": query_vector,
                            "path": "embedding",
                            "k": limit
                        }
                    }
                },
                {
                    "$project": {
                        "title": 1,
                        "summary": 1,
                        "_id": 0,
                        "score": {"$meta": "searchScore"}
                    }
                }
            ]
            results = list(summaries_collection.aggregate(pipeline))
            return [{"title": doc.get("title", ""), "summary": doc.get("summary", "")} for doc in results]
        except Exception as e:
            print(f"[WARN] Atlas vector search unavailable or error occurred: {e}")
            return []

    @classmethod
    def get_relevant_canon_rules(
        cls,
        text_context: str,
        detected_characters: Optional[List[str]] = None,
        query_vector: Optional[List[float]] = None,
        limit: int = 4
    ) -> List[Dict[str, str]]:
        """
        Unified canon retrieval prioritizing vector search then falling back to keyword matching.
        """
        # 1. Attempt vector search if vector provided
        if query_vector:
            vector_results = cls.get_canon_context_by_vector(query_vector, limit=limit)
            if vector_results:
                return vector_results

        # 2. Fall back to character / keyword search
        search_terms = list(detected_characters or [])
        words = [w for w in text_context.split() if len(w) > 4 and w.isalnum()]
        search_terms.extend(words[:6])

        keyword_results = cls.get_canon_context_by_keywords(search_terms, limit=limit)
        if keyword_results:
            return keyword_results

        # 3. Fallback: return sample canon records from collection
        try:
            cursor = summaries_collection.find({}, {"title": 1, "summary": 1, "_id": 0}).limit(limit)
            return [{"title": doc.get("title", ""), "summary": doc.get("summary", "")} for doc in cursor]
        except Exception as e:
            print(f"[WARN] Fallback canon retrieval failed: {e}")
            return []
