import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer

from controllers.parser_controller import extract_text_from_pdf
from db import summaries_collection, script_collection, reports_collection  # MongoDB connection
from controllers.graphql_controller import graphql_bp
from controllers.vector_search_controller import vector_search_bp
from controllers.commit_controller import commit_bp

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
client_ai = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
)

model = SentenceTransformer('all-MiniLM-L6-v2', model_kwargs={'low_cpu_mem_usage': True})

def embed_text(text):
    return model.encode(text).tolist()

def get_canon_context_from_vector_search(user_story_vector, limit=5):
    try:
        pipeline = [
            {
                "$search": {
                    "index": "default",
                    "knnBeta": {
                        "vector": user_story_vector,
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
        return results
    except Exception as e:
        print(f"[ERROR] MongoDB vector search error: {e}")
        return f"Error fetching canon context: {e}"



def get_next_script_title():
    count = reports_collection.count_documents({})
    return f"Script_{count + 1}"

# System prompt for LLM
system_prompt = """
you are a highly knowledgeable marvel cinematic universe (mcu) expert assistant embedded in a professional screenwriting team. your job is to evaluate any creative input (story pitches, arcs, character decisions, events, timelines, or dialogue) and determine how much it contradicts established mcu canon using a contradiction score from 0 to 100.

respond only in the following structured json format:

{
  "summary": "<one-sentence summary of the contradiction or confirmation of canon alignment>",
  "contradiction_score": <integer from 0 to 100>,
  "justification": [
    "<detailed explanation of contradiction or alignment - point 1>",
    "<supporting point - timeline, characterization, canon logic, etc.>"
  ],
  "recommendations": [
    "<suggested fix, rewrite, or clarification to bring it in line with canon>"
  ]
}

——————

🏷 contradiction score scale (use this for consistency):

0–10 → ✅ canon compliant  
- fully aligned with mcu canon. tiny or no issues.

11–30 → ⚠️ minor deviation  
- small continuity issues like vague motivations, slight timeline ambiguity, minor tech misuse.

31–60 → ❌ moderate conflict  
- character arcs, events, or tech usage misaligned with canon but fixable.

61–90 → 🚫 major contradiction  
- breaks key mcu rules (dead characters return, timeline/multiverse violations, reversed arcs).

91–100 → 💥 canon collapse  
- disregards major mcu foundations (infinity stones logic, tva rules, multiversal laws, etc.).

——————

📌 what to consider when scoring:

- character arcs and traits (emotional logic, decisions)
- timeline continuity (events, blip, snap, time travel)
- status of characters (dead, alive, blipped, forgotten)
- rules of magic, tech, multiverse, and artifacts
- canon = mcu films, disney+ shows, *what if...?*
- ignore: comics, non-canon shows, games, or novelizations

——————

📚 examples for reference:

"peter parker enrolls at mit in 2025."  
→ score: 25  
→ why: he’s erased from memory post-*no way home*. plausible with difficulty.

"tony stark returns as an ai guiding the young avengers."  
→ score: 48  
→ why: no ai setup, undercuts endgame closure, but not impossible with setup.

"natasha romanoff survived vormir and returns in 2026."  
→ score: 82  
→ why: soul stone sacrifice = permanent. canon says she’s dead.

"thanos reassembles the infinity gauntlet in 2027 and returns."  
→ score: 99  
→ why: infinity stones are destroyed, thanos is dead in all timelines. total canon break.

——————

⛔️ do not provide any explanation outside of the json format. only respond with the structured json.

💡 ensure scoring is repeatable — the same story should always produce the same contradiction score.
"""

# LLM caller
def call_llm(prompt, model="openrouter/free"):
    try:
        response = client_ai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500
        )

        print("[LLM] Raw LLM Response:", response)

        if not response or not response.choices:
            return "Error: No response or choices returned from LLM"

        message = response.choices[0].message
        if not message or message.content is None:
            return "Error: Empty LLM message (content was None)"
            
        return message.content.strip()
    
    except Exception as e:
        print(f"[ERROR] LLM Call Error: {e}")
        return f"Error calling LLM: {e}"

app = Flask(__name__)
CORS(app)

app.register_blueprint(graphql_bp)
app.register_blueprint(vector_search_bp, url_prefix='/vector_search')
app.register_blueprint(commit_bp, url_prefix='/commit')

@app.route('/parse', methods=['POST'])
def parse_pdf_and_run_ai():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No PDF uploaded'}), 400

    pdf_file = request.files['pdf']
    extracted_text = extract_text_from_pdf(pdf_file)

    print("📄 Extracted Text:\n", extracted_text)

    if extracted_text.startswith("Error"):
        return jsonify({'error': extracted_text}), 500

    user_story_vector = embed_text(extracted_text)

    canon_results = get_canon_context_from_vector_search(user_story_vector, limit=5)

    if not isinstance(canon_results, list):
        return jsonify({'error': canon_results}), 500

    canon_context = "\n".join(
        [f"Title: {item['title']}\nSummary: {item['summary']}" for item in canon_results]
    )

    prompt = f"""
    MCU Canon:
    {canon_context}

    --- USER INPUT BELOW ---

    New Story Submission:
    {extracted_text}

    Evaluate the user input against MCU canon.
    """

    llm_result = call_llm(prompt)

    script_title = get_next_script_title()

    try:
        llm_data = json.loads(llm_result)

        report_doc = {
            "title": script_title,
            "report": llm_data,
            "script": extracted_text
        }

        reports_collection.insert_one(report_doc)

    except Exception as e:
        print(f"[ERROR] Error saving to reports collection: {e}")
        return jsonify({'error': f"Failed to save report: {str(e)}"}), 500

    return jsonify({'llm_response': llm_result, 'title': script_title})

@app.route('/get-report', methods=['POST'])
def get_report_by_script_number():
    data = request.get_json()

    if not data or 'num' not in data:
        return jsonify({"error": "Missing 'num' in JSON payload"}), 400

    num = data['num']
    title = f"Script_{num}"

    report = reports_collection.find_one({"title": title})

    if report:
        return jsonify(report), 200
    else:
        return jsonify({"error": f"No report found for title: {title}"}), 404


@app.route('/get_all_inputs', methods=['GET'])
def get_all_inputs():
    try:
        all_docs = summaries_collection.find()
        results = [{**doc, "_id": str(doc["_id"])} for doc in all_docs]
        return jsonify({"status": "success", "data": results}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
