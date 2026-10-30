"""
Unit and integration tests for LoreGraph AI-Driven Refinement Engine.
Tests Neo4jContextService, CanonContextService, LLMRefinementService, and /api/analyze/suggest endpoint.
"""

import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.neo4j_service import Neo4jContextService
from services.canon_service import CanonContextService
from services.llm_refinement import LLMRefinementService
from app import app


class TestNeo4jContextService(unittest.TestCase):
    def setUp(self):
        self.service = Neo4jContextService(uri="", user="neo4j", password="")

    def test_extract_entities_from_text(self):
        text = "In 2026, Natasha Romanoff returns to New York after the battle on Vormir in 2023."
        entities = self.service.extract_entities_from_text(text)

        self.assertIn("Natasha Romanoff", entities["characters"])
        self.assertIn("New York", entities["locations"])
        self.assertIn("Vormir", entities["locations"])
        self.assertIn("2026", entities["years"])
        self.assertIn("2023", entities["years"])

    def test_build_contradiction_graph_context_offline_resilience(self):
        # Even with no live Neo4j database, it shouldn't crash; should return structured context
        context = self.service.build_contradiction_graph_context(
            contradiction_text="Tony Stark builds an army in 2028."
        )
        self.assertIn("detected_entities", context)
        self.assertIn("Tony Stark", context["detected_entities"]["characters"])
        self.assertIsInstance(context["character_events"], list)
        self.assertIsInstance(context["timeline_events"], list)


class TestLLMRefinementService(unittest.TestCase):
    def setUp(self):
        self.service = LLMRefinementService(api_key="test_key", model_name="test-model")

    def test_build_refinement_prompt(self):
        contradiction = "Natasha Romanoff returns in 2026 after sacrificing herself for the Soul Stone."
        narrative_context = [
            {"event": "Natasha Romanoff sacrifices herself on Vormir for the Soul Stone.", "year": "2023", "source": "Avengers: Endgame"}
        ]
        canon_rules = [
            {"title": "Soul Stone Rules", "summary": "An everlasting exchange: a soul for a soul. The sacrifice is permanent."}
        ]

        prompt = self.service.build_refinement_prompt(
            contradiction_details=contradiction,
            narrative_context=narrative_context,
            canon_rules=canon_rules
        )

        self.assertIn("Natasha Romanoff returns in 2026", prompt)
        self.assertIn("Vormir", prompt)
        self.assertIn("Soul Stone Rules", prompt)
        self.assertIn("Suggest 3 plot revisions", prompt)

    def test_parse_suggestions_json_clean(self):
        raw_json = json.dumps([
            {"id": 1, "title": "Multiverse Variant", "description": "Variant arrives from 838.", "canon_rationale": "Consistent with Multiverse rules.", "impact": "Medium"},
            {"id": 2, "title": "Skrull Infiltration", "description": "Revealed as a Skrull operative.", "canon_rationale": "Consistent with Secret Invasion.", "impact": "Low"},
            {"id": 3, "title": "LMD Decoy", "description": "Life Model Decoy designed by Fury.", "canon_rationale": "Consistent with Shield tech.", "impact": "Low"}
        ])

        parsed = self.service.parse_suggestions_json(raw_json)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed), 3)
        self.assertEqual(parsed[0]["title"], "Multiverse Variant")
        self.assertEqual(parsed[1]["impact"], "Low")

    def test_parse_suggestions_json_with_markdown_fences(self):
        raw = "```json\n" + json.dumps({
            "suggestions": [
                {"id": 1, "title": "Variant", "description": "Desc 1", "canon_rationale": "Reason 1", "impact": "High"}
            ]
        }) + "\n```"

        parsed = self.service.parse_suggestions_json(raw)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["title"], "Variant")

    def test_generate_fallback_suggestions(self):
        fallbacks = self.service.generate_fallback_suggestions(
            contradiction_details="Thanos returns in 2026",
            detected_characters=["Thanos"]
        )
        self.assertEqual(len(fallbacks), 3)
        self.assertTrue(all("title" in item and "description" in item and "canon_rationale" in item for item in fallbacks))


class TestFlaskRefinementEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_suggest_endpoint_missing_payload(self):
        response = self.client.post('/api/analyze/suggest', json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_suggest_endpoint_direct_contradiction_text(self):
        response = self.client.post(
            '/api/analyze/suggest',
            json={
                "contradiction_text": "Natasha Romanoff appears in 2026 running the Red Room."
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        # Should return a JSON array of 3 items
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 3)
        self.assertIn("title", data[0])
        self.assertIn("description", data[0])
        self.assertIn("canon_rationale", data[0])

    def test_suggest_endpoint_with_metadata_query_param(self):
        response = self.client.post(
            '/api/analyze/suggest?metadata=true',
            json={
                "contradiction_text": "Tony Stark leads the Avengers in 2027.",
                "character": "Tony Stark"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("Tony Stark", data.get("detected_characters", []))
        self.assertIsInstance(data.get("suggestions"), list)
        self.assertEqual(len(data["suggestions"]), 3)


if __name__ == '__main__':
    unittest.main()
