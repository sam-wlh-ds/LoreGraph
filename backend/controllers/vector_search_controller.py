from flask import Blueprint, request, jsonify
from sentence_transformers import SentenceTransformer
from db import summaries_collection
from tqdm import tqdm

vector_search_bp = Blueprint('vector_search', __name__)
commit_bp = Blueprint("commit_bp", __name__)

model = SentenceTransformer("all-MiniLM-L6-v2", model_kwargs={'low_cpu_mem_usage': True})

def embed_text(text):
    return model.encode(text).tolist()

@vector_search_bp.route('/search', methods=['POST'])
def vector_search():
    query = request.json.get("query", "")
    if not query:
        return jsonify({"error": "Query is required"}), 400

    query_vector = embed_text(query)

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

    results = list(summaries_collection.aggregate(pipeline))
    return jsonify({"results": results})
