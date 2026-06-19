# LoreGraph

LoreGraph is a full-stack application designed to validate creative writing scripts against established canon and model narrative elements into a Neo4j knowledge graph. 

It provides screenwriters with a semantic contradiction analysis engine (detecting timeline errors, character deaths, or universe conflicts) and parses characters, events, and locations into interactive timelines.

---

## Architecture

* **Frontend**: React (located in `/frontend`) displaying graph visualizations (via NeoVis.js) and canon verification reports.
* **Backend**: Flask API (located in `/backend`) structured into decoupled controllers for PDF parsing, vector search, GraphQL routing, and timeline commits.
* **Databases**: 
  * **MongoDB**: Stores script submissions, generated reports, and canon vectors (embedded using `all-MiniLM-L6-v2` locally).
  * **Neo4j**: Houses the timeline relationship graph connecting characters, locations, and events.

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
