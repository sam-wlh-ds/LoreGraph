"""
Service module for AI-driven refinement and plot suggestions using OpenRouter LLM.
Handles prompt construction, API calls to OpenRouter, JSON response parsing,
and resilient canon-aware fallback generation.
"""

from typing import List, Dict, Any, Optional
import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class LLMRefinementService:
    """Manages prompt engineering and LLM completion requests for story plot refinement."""

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None) -> None:
        self.api_key: str = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model_name: str = model_name or os.getenv("MODEL_NAME", "openrouter/free")
        self.client: Optional[OpenAI] = None

        if self.api_key:
            try:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url="https://openrouter.ai/api/v1"
                )
            except Exception as e:
                print(f"[WARN] Failed to instantiate OpenAI client for OpenRouter: {e}")
                self.client = None

    @staticmethod
    def build_refinement_prompt(
        contradiction_details: str,
        narrative_context: List[Dict[str, Any]],
        canon_rules: List[Dict[str, str]]
    ) -> str:
        """
        Construct a concise, token-efficient prompt for OpenRouter LLM incorporating
        the contradiction, Neo4j timeline/character context, and MongoDB canon rules.
        """
        # Format narrative events from Neo4j (surrounding previous events)
        timeline_snippets: List[str] = []
        for item in narrative_context[:6]:
            event_text = item.get("event") or item.get("description", "")
            year = item.get("year", "Unknown")
            source = item.get("source") or item.get("source_title", "Canon")
            if event_text:
                timeline_snippets.append(f"- [{year} | {source}]: {event_text.strip()}")

        timeline_section = "\n".join(timeline_snippets) if timeline_snippets else "No prior graph events recorded."

        # Format established Canon rules from MongoDB
        canon_snippets: List[str] = []
        for rule in canon_rules[:4]:
            title = rule.get("title", "Canon Rule")
            summary = rule.get("summary", "").strip()
            if summary:
                # Keep summary concise to conserve tokens
                short_summary = summary[:200] + ("..." if len(summary) > 200 else "")
                canon_snippets.append(f"- {title}: {short_summary}")

        canon_section = "\n".join(canon_snippets) if canon_snippets else "Follow official MCU film and Disney+ continuity."

        prompt = f"""You are a professional MCU script doctor and story continuity expert.

### DETECTED NARRATIVE CONTRADICTION:
{contradiction_details}

### SURROUNDING NARRATIVE CONTEXT (Neo4j Timeline):
{timeline_section}

### ESTABLISHED CANON RULES (MongoDB Canon Reference):
{canon_section}

### TASK:
Suggest 3 plot revisions that resolve this contradiction while maintaining narrative flow and existing canon.

### FORMAT:
Respond with a strict JSON array containing exactly 3 objects. Do NOT include markdown code blocks or text outside the JSON.
Each object must have this structure:
{{
  "id": 1,
  "title": "<Concise revision title, e.g. 'Multiversal Incursion Anchor'>",
  "description": "<Actionable 2-3 sentence plot fix explaining what happens instead>",
  "canon_rationale": "<Why this resolves the continuity error while respecting MCU lore>",
  "impact": "<'Low' | 'Medium' | 'High'>"
}}"""
        return prompt.strip()

    def generate_fallback_suggestions(
        self,
        contradiction_details: str,
        detected_characters: Optional[List[str]] = None,
        reason: str = "Fallback mechanism invoked"
    ) -> List[Dict[str, Any]]:
        """
        Provide intelligent, canon-compliant default suggestions if the LLM call fails or times out.
        """
        char_label = detected_characters[0] if (detected_characters and len(detected_characters) > 0) else "the character"

        return [
            {
                "id": 1,
                "title": f"Multiverse Variant or Timeline Branch Divergence",
                "description": (
                    f"Frame {char_label}'s presence as a variant displaced from an alternate branch by "
                    f"TVA intervention or multiversal destabilization, leaving the sacred timeline intact."
                ),
                "canon_rationale": "Aligns with Loki and Multiverse of Madness rules governing timeline variants and incursions.",
                "impact": "Medium",
                "is_fallback": True,
                "note": reason
            },
            {
                "id": 2,
                "title": "Decoy / Life Model Decoy (LMD) or Skrull Impersonation",
                "description": (
                    f"Reveal that the character appearing in this sequence was an advanced Stark-tech LMD, "
                    f"a holographic simulation, or an allied Skrull operative fulfilling a posthumous directive."
                ),
                "canon_rationale": "Consistent with Nick Fury's LMD lore and Secret Invasion narrative mechanics.",
                "impact": "Low",
                "is_fallback": True,
                "note": reason
            },
            {
                "id": 3,
                "title": "Pre-Incident Flashback & Archived Transmission",
                "description": (
                    f"Recast the scene as a previously unseen chronological flashback or an encrypted holographic "
                    f"recording left behind prior to their canonical departure."
                ),
                "canon_rationale": "Preserves permanent canon sacrifices (e.g. Endgame Vormir / Tony Stark) without retconning.",
                "impact": "Low",
                "is_fallback": True,
                "note": reason
            }
        ]

    def call_openrouter(self, prompt: str) -> Optional[str]:
        """
        Dispatch prompt to OpenRouter API and extract the text content safely.
        """
        if not self.client:
            print("[WARN] LLMRefinementService: No OpenAI/OpenRouter client available (missing API key).")
            return None

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert Marvel continuity script doctor. "
                            "Output only valid JSON arrays representing plot suggestions."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=900
            )

            if not response or not response.choices:
                return None

            choice = response.choices[0]
            if not choice.message or not choice.message.content:
                return None

            return choice.message.content.strip()
        except Exception as e:
            print(f"[ERROR] OpenRouter LLM refinement call failed: {e}")
            return None

    @staticmethod
    def parse_suggestions_json(raw_text: str) -> Optional[List[Dict[str, Any]]]:
        """
        Parse raw LLM response into a list of suggestions, stripping markdown fences if present.
        """
        if not raw_text:
            return None

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            parsed = json.loads(cleaned)
            # If the model wrapped in an object like {"suggestions": [...]}
            if isinstance(parsed, dict):
                for key in ["suggestions", "revisions", "plot_suggestions", "items"]:
                    if key in parsed and isinstance(parsed[key], list):
                        parsed = parsed[key]
                        break

            if isinstance(parsed, list):
                # Normalize keys and validate
                valid_list: List[Dict[str, Any]] = []
                for idx, item in enumerate(parsed[:3], start=1):
                    if isinstance(item, dict):
                        valid_list.append({
                            "id": item.get("id", idx),
                            "title": item.get("title", f"Plot Revision {idx}"),
                            "description": item.get("description", item.get("revision", item.get("suggestion", ""))),
                            "canon_rationale": item.get("canon_rationale", item.get("rationale", item.get("reason", "Maintains MCU canon continuity."))),
                            "impact": item.get("impact", "Medium")
                        })
                if valid_list:
                    return valid_list
        except Exception as e:
            print(f"[WARN] Failed to parse JSON suggestions from LLM: {e}")

        return None

    def get_refinement_suggestions(
        self,
        contradiction_details: str,
        narrative_context: List[Dict[str, Any]],
        canon_rules: List[Dict[str, str]],
        detected_characters: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate 3 plot revisions resolving the contradiction, calling OpenRouter
        or falling back seamlessly if network or API issues occur.
        """
        prompt = self.build_refinement_prompt(
            contradiction_details=contradiction_details,
            narrative_context=narrative_context,
            canon_rules=canon_rules
        )

        raw_response = self.call_openrouter(prompt)
        if raw_response:
            parsed = self.parse_suggestions_json(raw_response)
            if parsed and len(parsed) >= 1:
                return parsed

        # Graceful fallback when LLM is unavailable or fails to return JSON
        return self.generate_fallback_suggestions(
            contradiction_details=contradiction_details,
            detected_characters=detected_characters,
            reason="LLM response unavailable or invalid JSON format; returned canon-aligned fallbacks"
        )
