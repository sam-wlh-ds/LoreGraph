from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("[ERROR] MONGO_URI is not set in the environment variables.")
    exit(1)

client = MongoClient(MONGO_URI)
collection = client["MCU"]["main_summary"]

model = SentenceTransformer("all-MiniLM-L6-v2", model_kwargs={'low_cpu_mem_usage': True})

for doc in collection.find():
    summary = doc.get("summary", "")
    if summary:
        embedding = model.encode(summary).tolist()
        
        collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"embedding": embedding}}
        )
        print(f"[OK] Embedding added for document ID: {doc['_id']}")
    else:
        print(f"[ERROR] No summary found for document ID: {doc['_id']}")
