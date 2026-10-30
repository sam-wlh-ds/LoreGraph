# LoreGraph

LoreGraph is a full-stack application designed to validate creative writing scripts against established canon and model narrative elements into a Neo4j knowledge graph. 

It provides screenwriters with a semantic contradiction analysis engine (detecting timeline errors, character deaths, or universe conflicts) and parses characters, events, and locations into interactive timelines.

---

## AI-Driven Refinement Engine

LoreGraph features an **AI-Driven Refinement Engine** that goes beyond raw contradiction detection: when narrative errors are identified, it automatically queries the Neo4j knowledge graph and MongoDB canon database to generate **actionable, canon-compliant plot revisions** directly to the screenwriter.

```
+---------------------+        +--------------------+
| Narrative Script /  | -----> | Neo4j Knowledge    | (Character nodes, timeline
| Contradiction Error |        | Graph Context      |  events & relationships)
+---------------------+        +--------------------+
           |                             |
           v                             v
+---------------------+        +--------------------+
|  MongoDB MCU Canon  | -----> | LLM Refinement     | (OpenRouter Engine)
|  Knowledge Base     |        | Service            |
+---------------------+        +--------------------+
                                         |
                                         v
                         +-------------------------------+
                         | 3 Canon-Compliant Revisions   |
                         | (Card Layout: Apply / Dismiss)|
                         +-------------------------------+
```

### Key Capabilities:
1. **Decoupled Knowledge Context Extraction**: Isolates character relationships, surrounding historical events, and timeline years from Neo4j without coupling query logic to LLM calls.
2. **MongoDB Canon Retrieval**: Pulls established MCU rules using vector embeddings or keyword matching.
3. **Structured Plot Suggestions**: Generates 3 discrete plot revisions containing title, actionable plot fix, MCU canon rationale, and narrative impact rating (`Low`, `Medium`, `High`).
4. **Resilient Fallback Handling**: If the LLM is unreachable or quota limits are met, canon-aligned fallback plot resolutions (Multiverse variant, LMD/Skrull decoy, or flashback angle) are provided seamlessly.

---

## Refinement API Endpoint

### `POST /api/analyze/suggest`

Generates 3 actionable plot revisions resolving a specified contradiction or script conflict.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "script_id": "Script_1",
  "contradiction_id": "c-0",
  "contradiction_text": "Natasha Romanoff survived Vormir and returns in 2026.",
  "character": "Natasha Romanoff"
}
```

* `script_id` *(optional)*: Script title (e.g. `"Script_1"`) or integer script number (`1`).
* `contradiction_id` *(optional)*: Identifier or index for the specific contradiction point (e.g. `"c-0"`).
* `contradiction_text` *(optional)*: Direct description of the detected contradiction. If omitted, it is inferred from the script's saved report in MongoDB.
* `character` *(optional)*: Specific character name involved in the conflict.

#### Response (`200 OK`)
Returns a JSON array containing 3 structured revision objects:
```json
[
  {
    "id": 1,
    "title": "Multiverse Variant Divergence",
    "description": "Establish that this Natasha Romanoff is an alternate variant displaced by multiversal incursion forces or TVA temporal pruning, keeping the Earth-616 Vormir sacrifice intact.",
    "canon_rationale": "Consistent with Loki and Multiverse of Madness rules governing temporal variants.",
    "impact": "Medium"
  },
  {
    "id": 2,
    "title": "Skrull Operative Impersonation",
    "description": "Reveal the operative as a deep-cover Skrull agent honoring Romanoff's tactical protocols, uncovered during an espionage operation in New York.",
    "canon_rationale": "Directly aligns with Secret Invasion canon lore.",
    "impact": "Low"
  },
  {
    "id": 3,
    "title": "Pre-Endgame Flashback Interlude",
    "description": "Recast this sequence chronologically as an untold mission executed between Captain America: Civil War and Avengers: Infinity War.",
    "canon_rationale": "Preserves the finality of the Soul Stone exchange on Vormir without rewriting post-2023 history.",
    "impact": "Low"
  }
]
```

> **Tip**: Append `?metadata=true` to the request URL (or pass `"include_metadata": true` in the JSON body) to receive a full response object including detected entities and script identifiers.

---

## Frontend UI Features

### 1. Interactive Timeline View & Canon Inspector
In the **Story Details** page (`/mystories/:storyName`), screenwriters can switch between the **Story Files** tab and the **Timeline & AI Consistency Inspector** tab:
* Displays a chronological sequence of narrative events with year badges and character tags.
* When a canon contradiction is detected on any timeline node, a highlighted error callout is rendered.
* Right next to the error, click **"✨ Get AI Suggestions"** to invoke the AI Refinement Engine.
* The 3 suggested plot fixes load in a card-based layout with **"Apply Suggestion"** and **"Dismiss"** actions.

### 2. Story Canon-Check Report Modal
* In the AI report modal, each identified MCU contradiction point features an integrated **Refinement Suggestion Card**.
* Screenwriters can test plot revisions before committing scripts to the story knowledge graph.

---

## Architecture

* **Frontend**: React (located in `/frontend`) displaying interactive narrative timelines, refinement cards, and Neo4j graph visualizations (via NeoVis.js).
* **Backend**: Flask API (located in `/backend`) structured into decoupled services and controllers:
  * `backend/services/neo4j_service.py`: Neo4j graph context and character relationship extraction.
  * `backend/services/canon_service.py`: MongoDB canon context retrieval.
  * `backend/services/llm_refinement.py`: Prompt engineering, OpenRouter integration, and JSON parsing.
  * `backend/controllers/`: PDF parsing, vector search, timeline commits, and GraphQL routing.
* **Databases**: 
  * **MongoDB**: Stores script submissions, generated reports, stories, and canon summaries.
  * **Neo4j**: Houses the timeline relationship graph connecting characters, locations, scripts, and events.

---

## Setup & Running

### 1. Environment Configuration
Create a `.env` file in the `backend` directory using `backend/.env.example` as a template:
```env
OPENROUTER_API_KEY=your_key_here
MONGO_URI=your_mongodb_connection_string
NEO4J_URI=neo4j+s://your_instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASS=your_password
MODEL_NAME=openrouter/free
```

### 2. First-Time Setup (Seeding & Syncing)
To populate MongoDB with initial MCU canon summaries and sync them to your Neo4j database, execute these commands from the root directory:
```bash
# Seed summaries and precompute vector embeddings
python seed_db.py

# Parse summaries with SpaCy NER and build the Neo4j timeline graph
python Neo4jSetupFirstTime.py
```

### 3. Start the Backend API
Run the Flask server from the root directory:
```bash
python backend/app.py
```
The server will connect to MongoDB and start listening on `http://127.0.0.1:5000`.

### 4. Start the Frontend Application
Navigate to the frontend folder, install the packages, and boot the development server:
```bash
cd frontend
npm install
npm start
```
The client dashboard will open on `http://localhost:3000`.

### 5. Running Tests
Run the backend refinement unit and integration test suite:
```bash
python backend/tests/test_refinement.py
```
