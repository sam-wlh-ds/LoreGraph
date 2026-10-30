"""
Service module for querying narrative and contradiction context from the Neo4j knowledge graph.
Decoupled from LLM prompt construction and execution logic.
"""

from typing import List, Dict, Any, Optional, Set
import os
import re
from neo4j import GraphDatabase, Driver
from dotenv import load_dotenv

load_dotenv()

KNOWN_CHARACTERS: List[str] = [
    "Tony Stark", "Iron Man", "Steve Rogers", "Captain America", "Thor", "Bruce Banner",
    "Hulk", "Natasha Romanoff", "Black Widow", "Clint Barton", "Hawkeye", "Loki",
    "Thanos", "Peter Parker", "Spider-Man", "Wanda Maximoff", "Scarlet Witch", "Vision",
    "Stephen Strange", "Doctor Strange", "T'Challa", "Black Panther", "Nick Fury", "Carol Danvers",
    "Captain Marvel", "Sam Wilson", "Falcon", "Bucky Barnes", "Winter Soldier"
]

KNOWN_LOCATIONS: List[str] = [
    "New York", "Asgard", "Wakanda", "Sokovia", "Titan", "Knowhere", "Xandar",
    "Earth", "Kamar-Taj", "Sanctum Sanctorum", "Avengers Tower", "Stark Tower", "Vormir"
]


class Neo4jContextService:
    """Provides methods to query narrative context, character relationships, and timeline events from Neo4j."""

    def __init__(self, uri: Optional[str] = None, user: Optional[str] = None, password: Optional[str] = None) -> None:
        self.uri = uri or os.getenv("NEO4J_URI", "")
        self.user = user or os.getenv("NEO4J_USER", "neo4j")
        self.password = password or os.getenv("NEO4J_PASS") or os.getenv("NEO4J_PASSWORD", "")
        self._driver: Optional[Driver] = None

    def get_driver(self) -> Optional[Driver]:
        """Lazily initialize and return the Neo4j driver, handling connection errors gracefully."""
        if not self.uri or not self.password:
            return None
        if self._driver is None:
            try:
                self._driver = GraphDatabase.driver(
                    self.uri,
                    auth=(self.user, self.password)
                )
            except Exception as e:
                print(f"[WARN] Neo4j driver initialization failed: {e}")
                self._driver = None
        return self._driver

    def close(self) -> None:
        """Close driver connection if active."""
        if self._driver is not None:
            try:
                self._driver.close()
            except Exception:
                pass
            self._driver = None

    @staticmethod
    def extract_entities_from_text(text: str) -> Dict[str, List[str]]:
        """Identify known characters, locations, and year occurrences from raw text."""
        lowered = text.lower()
        characters: Set[str] = set()
        for char in KNOWN_CHARACTERS:
            if char.lower() in lowered:
                characters.add(char)

        locations: Set[str] = set()
        for loc in KNOWN_LOCATIONS:
            if loc.lower() in lowered:
                locations.add(loc)

        year_matches = re.findall(r"\b(19\d{2}|20\d{2})\b", text)
        years = list(set(year_matches))

        return {
            "characters": list(characters),
            "locations": list(locations),
            "years": years
        }

    def fetch_character_context(self, character_names: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """
        Query Neo4j for character nodes, their involved events, years, locations, and source materials.
        """
        driver = self.get_driver()
        if not driver or not character_names:
            return []

        cypher_query = """
        MATCH (c:Character)
        WHERE any(name IN $character_names WHERE toLower(c.name) CONTAINS toLower(name) OR toLower(name) CONTAINS toLower(c.name))
        OPTIONAL MATCH (e:Event)-[:INVOLVES]->(c)
        OPTIONAL MATCH (e)-[:OCCURS_IN]->(y:Year)
        OPTIONAL MATCH (e)-[:SET_IN]->(l:Location)
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(source)
        RETURN c.name AS character,
               e.description AS event_description,
               y.value AS year,
               l.name AS location,
               labels(source)[0] AS source_type,
               coalesce(source.title, source.name, 'Unknown') AS source_title
        ORDER BY y.value ASC
        LIMIT $limit
        """

        try:
            with driver.session() as session:
                records = session.run(cypher_query, character_names=character_names, limit=limit)
                results: List[Dict[str, Any]] = []
                for record in records:
                    results.append({
                        "character": record.get("character"),
                        "event": record.get("event_description"),
                        "year": record.get("year"),
                        "location": record.get("location"),
                        "source_type": record.get("source_type"),
                        "source_title": record.get("source_title")
                    })
                return results
        except Exception as e:
            print(f"[WARN] Failed to fetch character context from Neo4j: {e}")
            return []

    def fetch_timeline_surrounding_events(
        self,
        target_year: Optional[str] = None,
        characters: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Query Neo4j for narrative context preceding or surrounding an event or character.
        """
        driver = self.get_driver()
        if not driver:
            return []

        has_target_year = bool(target_year and target_year.isdigit())
        has_characters = bool(characters)

        cypher_query = """
        MATCH (e:Event)-[:OCCURS_IN]->(y:Year)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Character)
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(m)
        WHERE ($has_target_year = false OR y.value <= $target_year)
          AND ($has_characters = false OR c.name IN $characters)
        RETURN e.description AS event,
               y.value AS year,
               collect(DISTINCT c.name) AS characters,
               coalesce(m.title, 'MCU Canon') AS source_title
        ORDER BY y.value DESC
        LIMIT $limit
        """

        try:
            with driver.session() as session:
                records = session.run(
                    cypher_query,
                    has_target_year=has_target_year,
                    target_year=target_year or "2099",
                    has_characters=has_characters,
                    characters=characters or [],
                    limit=limit
                )
                events: List[Dict[str, Any]] = []
                for record in records:
                    events.append({
                        "event": record.get("event"),
                        "year": record.get("year"),
                        "characters": record.get("characters", []),
                        "source": record.get("source_title")
                    })
                return events
        except Exception as e:
            print(f"[WARN] Failed to fetch timeline surrounding events from Neo4j: {e}")
            return []

    def fetch_script_events(self, script_title: str) -> List[Dict[str, Any]]:
        """
        Query Neo4j for events already committed under a specific Script node.
        """
        driver = self.get_driver()
        if not driver:
            return []

        cypher_query = """
        MATCH (s:Script {title: $script_title})<-[:MENTIONED_IN]-(e:Event)
        OPTIONAL MATCH (e)-[:OCCURS_IN]->(y:Year)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Character)
        OPTIONAL MATCH (e)-[:SET_IN]->(l:Location)
        RETURN e.description AS description,
               y.value AS year,
               collect(DISTINCT c.name) AS characters,
               collect(DISTINCT l.name) AS locations
        ORDER BY y.value ASC
        """

        try:
            with driver.session() as session:
                records = session.run(cypher_query, script_title=script_title)
                return [
                    {
                        "description": r.get("description"),
                        "year": r.get("year"),
                        "characters": r.get("characters", []),
                        "locations": r.get("locations", [])
                    }
                    for r in records
                ]
        except Exception as e:
            print(f"[WARN] Failed to fetch script events from Neo4j: {e}")
            return []

    def build_contradiction_graph_context(
        self,
        contradiction_text: str,
        script_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract entities from the contradiction details, query Neo4j, and assemble narrative graph context.
        """
        entities = self.extract_entities_from_text(contradiction_text)
        detected_chars = entities["characters"]
        detected_years = entities["years"]
        target_year = detected_years[0] if detected_years else None

        char_events = self.fetch_character_context(detected_chars, limit=8) if detected_chars else []
        timeline_events = self.fetch_timeline_surrounding_events(
            target_year=target_year,
            characters=detected_chars,
            limit=8
        )

        script_events: List[Dict[str, Any]] = []
        if script_id:
            script_events = self.fetch_script_events(script_id)

        return {
            "detected_entities": entities,
            "character_events": char_events,
            "timeline_events": timeline_events,
            "script_events": script_events
        }
