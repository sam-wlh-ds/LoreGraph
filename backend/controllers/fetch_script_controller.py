from db import summaries_collection, client  # Importing the collection and client

def fetch_script_by_title(title):
    try:
        doc = summaries_collection.find_one({"title": title})
        if doc:
            return {
                "title": doc.get("title"),
                "script": doc.get("script"),
                "timeline": doc.get("timeline"),
                "created_by": doc.get("created_by")
            }
        else:
            return {"error": "Title not found in database."}
    except Exception as e:
        return {"error": str(e)}
