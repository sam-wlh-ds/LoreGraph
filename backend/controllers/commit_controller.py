from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from collections import defaultdict, OrderedDict
from neo4j import GraphDatabase
import spacy
import re
import os 
from dotenv import load_dotenv

load_dotenv()

commit_bp = Blueprint("commit", __name__)

nlp = spacy.load("en_core_web_sm")

client = MongoClient(os.getenv("MONGO_URI"))
db = client["MCU"]
script_collection = db["reports"]

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASS"))
)

known_characters = [
    "Tony Stark", "Iron Man", "Steve Rogers", "Captain America", "Thor", "Bruce Banner",
    "Hulk", "Natasha Romanoff", "Black Widow", "Clint Barton", "Hawkeye", "Loki",
    "Thanos", "Peter Parker", "Spider-Man", "Wanda Maximoff", "Scarlet Witch", "Vision",
    "Stephen Strange", "Doctor Strange", "T'Challa", "Black Panther", "Nick Fury", "Carol Danvers",
    "Captain Marvel", "Sam Wilson", "Falcon", "Bucky Barnes", "Winter Soldier"
]

known_locations = [
    "New York", "Asgard", "Wakanda", "Sokovia", "Titan", "Knowhere", "Xandar",
    "Earth", "Kamar-Taj", "Sanctum Sanctorum", "Avengers Tower", "Stark Tower", "Vormir"
]

def extract_year(text):
    match = re.search(r"\b(19|20)\d{2}\b", text)
    return match.group(0) if match else None

def soft_match_entities(text, candidates):
    return list(set([c for c in candidates if c.lower() in text.lower()]))

def insert_event(tx, year, event_data):
    tx.run("""
        MERGE (y:Year {value: $year})
        MERGE (s:Script {title: $script_title})
        CREATE (e:Event {
            description: $event,
            confidence: $confidence,
            version: $version
        })
        MERGE (u:Universe {name: $universe})
        MERGE (e)-[:OCCURS_IN]->(y)
        MERGE (e)-[:MENTIONED_IN]->(s)
        MERGE (e)-[:IN_UNIVERSE]->(u)
        FOREACH (char IN $characters |
            MERGE (c:Character {name: char})
            MERGE (e)-[:INVOLVES]->(c)
        )
        FOREACH (loc IN $locations |
            MERGE (l:Location {name: loc})
            MERGE (e)-[:SET_IN]->(l)
        )
    """, year=year,
         event=event_data["phrase"],
         script_title=event_data["title"],
         confidence=event_data["confidence"],
         version=event_data["version"],
         universe=event_data["universe"],
         characters=event_data["characters"],
         locations=event_data["locations"]
    )

@commit_bp.route("/commit", methods=["POST"])
def commit_script_timeline():
    data = request.get_json()
    num = data.get("count")
    script_title = "Script_" + str(num)
    timeline_name = "Script_"+ str(num)

    if not script_title or not timeline_name:
        return jsonify({"error": "Missing script_title or timeline_name"}), 400

    doc = script_collection.find_one({"title": script_title})
    if not doc:
        return jsonify({"error": f"No script found with title '{script_title}'"}), 404

    script = doc.get("script", "")
    doc_nlp = nlp(script)

    timeline = defaultdict(list)
    for sent in doc_nlp.sents:
        year = None
        characters, locations = [], []

        for ent in sent.ents:
            if ent.label_ == "DATE" and not year:
                year = extract_year(ent.text)
            elif ent.label_ == "PERSON":
                characters.append(ent.text)
            elif ent.label_ == "GPE":
                locations.append(ent.text)

        matched_chars = soft_match_entities(sent.text, known_characters)
        matched_locs = soft_match_entities(sent.text, known_locations)
        characters.extend(matched_chars)
        locations.extend(matched_locs)

        if year:
            timeline[year].append({
                "title": script_title,
                "phrase": sent.text.strip(),
                "characters": list(set(characters)),
                "locations": list(set(locations)),
                "universe": timeline_name,
                "confidence": 0.85,
                "version": "v1.0"
            })

    with driver.session() as session:
        for year, events in OrderedDict(sorted(timeline.items(), key=lambda x: int(x[0]))).items():
            for event in events:
                session.write_transaction(insert_event, year, event)

    return jsonify({
        "message": f"[OK] Timeline from '{script_title}' committed to '{timeline_name}' successfully.",
        "events_added": sum(len(v) for v in timeline.values())
    })
