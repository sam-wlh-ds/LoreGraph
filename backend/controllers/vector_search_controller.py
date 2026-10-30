from flask import Blueprint, request, jsonify
from db import summaries_collection
from tqdm import tqdm

try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2", model_kwargs={'low_cpu_mem_usage': True})
except Exception as e:
    print(f"[WARN] SentenceTransformer unavailable in vector_search_controller: {e}")
    model = None

vector_search_bp = Blueprint('vector_search', __name__)
commit_bp = Blueprint("commit_bp", __name__)

def embed_text(text):
    if model is not None:
        return model.encode(text).tolist()
    return []

@vector_search_bp.route('/search', methods=['POST'])
def vector_search():
    query = request.json.get("query", "")
    if not query:
        return jsonify({"error": "Query is required"}), 400

    query_vector = embed_text(query)
    if not query_vector:
        # Fallback to text regex search
        cursor = summaries_collection.find(
            {"$or": [{"title": {"$regex": query, "$options": "i"}}, {"summary": {"$regex": query, "$options": "i"}}]},
            {"title": 1, "summary": 1, "_id": 0}
        ).limit(5)
        return jsonify({"results": list(cursor)})

    pipeline = [
        {
            "$search": {
                "index": "default",
                "knnBeta": {
                    "vector": query_vector,
                    "path": "embedding",
                    "k": 5
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

    try:
        results = list(summaries_collection.aggregate(pipeline))
        return jsonify({"results": results})
    except Exception as e:
        print(f"[WARN] Atlas vector search aggregate error: {e}")
        cursor = summaries_collection.find({}, {"title": 1, "summary": 1, "_id": 0}).limit(5)
        return jsonify({"results": list(cursor)})
