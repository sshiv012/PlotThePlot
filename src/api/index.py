import os
import time
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

import google.generativeai as genai
from bs4 import BeautifulSoup

app = Flask(__name__)
CORS(app)
class PlotThePlot:
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model_name = model_name
        self.max_retries = 5
        self.retry_delay = 5

    def get_schema(self):
        """
        Define the JSON schema that we want Gemini to produce.
        'positivity' is removed; 'key_dialogs' is added for each relationship.
        """
        return {
            "type": "OBJECT",
            "properties": {
                "characters": {
                    "type": "ARRAY",
                    "description": "Extracted characters from the text.",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "id": {
                                "type": "NUMBER",
                                "description": "Unique integer identifying each character"
                            },
                            "common_name": {
                                "type": "STRING",
                                "description": "The primary or most frequent name"
                            },
                            "main_character": {
                                "type": "BOOLEAN",
                                "description": "True if major character in the story"
                            },
                            "names": {
                                "type": "ARRAY",
                                "description": "All known aliases, nicknames, or titles",
                                "items": {"type": "STRING"}
                            },
                            "traits": {
                                "type": "ARRAY",
                                "description": "Key personality traits or defining characteristics of the character (e.g. brave, manipulative, loyal)",
                                "items": {"type": "STRING"}
                            },
                            "description": {
                                "type": "STRING",
                                "description": "Brief summary of this character’s role"
                            }
                        },
                        "required": ["id", "common_name", "main_character", "names"]
                    }
                },
                "relations": {
                    "type": "ARRAY",
                    "description": "List of relationships among characters.",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "id1": {
                                "type": "NUMBER",
                                "description": "ID of the first character"
                            },
                            "id2": {
                                "type": "NUMBER",
                                "description": "ID of the second character"
                            },
                            "id1_to_id2_role": {
                                "type": "STRING",
                                "description": "Role of id1 toward id2 (e.g., 'father', 'mentor', 'enemy')"
                            },
                            "id2_to_id1_role": {
                                "type": "STRING",
                                "description": "Role of id2 toward id1 (e.g., 'son', 'disciple', 'rival')"
                            },
                            "weight": {
                                "type": "NUMBER",
                                "description": "Strength or importance of the relationship (1 to 10)"
                            },
                            "key_dialogs": {
                                "type": "ARRAY",
                                "description": "Up to two short lines or dialogues from the text that highlight significance",
                                "items": {"type": "STRING"}
                            }
                        },
                        "required": ["id1", "id2", "id1_to_id2_role", "id2_to_id1_role", "weight", "key_dialogs"]
                    }
                },
                "summary": {
                    "type": "STRING",
                    "description": "(A single human-readable paragraph or multi-paragraph block of plain text) A detailed natural language summary of the story including the main plot, key players, and act-level breakdown"
                }
            },
            "required": ["characters", "relations", "summary"]
        }

    def create_prompt(self, text: str) -> str:
        return (
            "You are a story analyser/writer in a big production house. Read the following story and identify:\n\n"
            "1. Characters: Provide an array 'characters' with:\n"
            "   - id (int), common_name, main_character (bool), names (array of strings), description (brief), and a list of core traits (array of strings).\n\n"
            "2. Relations: Provide an array 'relations' with:\n"
            "   - id1, id2 (the character IDs),\n"
            "   - id1_to_id2_role: how id1 relates to id2 (e.g., 'father', 'mentor', 'enemy').\n"
            "   - id2_to_id1_role: how id2 sees id1 (e.g., 'son', 'disciple', 'rival').\n"
            "   - key_dialogs: up to two direct quotes (verbatim lines) exchanged between the two characters that are:\n"
            "       - Famous, memorable, widely cited or emotionally significant\n"
            "       - Central to the relationship's arc or turning points in the story\n"
            "       - Representative of tension, affection, conflict, or a major plot event\n\n"
            "3. Summary: The ‘summary’ should be a human-readable text block that includes the main plot, key players, and act-wise breakdown — written in clear prose (no JSON, lists or underscored names).\n"
            "Return valid JSON with exactly 'characters', 'relations' and 'summary'. No extra commentary.\n\nTEXT:\n" + text
        )

    def analyze_text(self, text: str):
        genai.configure(api_key=self.api_key)
        schema = self.get_schema()
        function_decl = genai.protos.FunctionDeclaration(
            name="return_json",
            description="Return JSON with characters and relationships",
            parameters=schema
        )
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={"temperature": 0.8},
            tools=[function_decl]
        )
        prompt = self.create_prompt(text)
        for attempt in range(self.max_retries):
            try:
                result = model.generate_content(prompt, tool_config={'function_calling_config': 'ANY'})
                fc = result.candidates[0].content.parts[0].function_call
                parsed = type(fc).to_dict(fc)["args"]
                if not isinstance(parsed, dict):
                    raise ValueError("Response is not a JSON object.")
                return parsed
            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise

    def get_validation_schema(self):
        """
        Defines the JSON schema used by the Gemini model to validate the structured character/relationship data.
        """
        return {
            "type": "OBJECT",
            "properties": {
                "known_story": {
                    "type": "BOOLEAN",
                    "description": "Whether the model recognizes and is familiar with the story"
                },
                "issues": {
                    "type": "ARRAY",
                    "description": "List of hallucinations, inaccuracies, or missing elements in the structured JSON",
                    "items": {
                        "type": "STRING"
                    }
                },
                "notes": {
                    "type": "STRING",
                    "description": "General comments on the quality and accuracy of the JSON"
                },
                "score": {
                    "type": "INTEGER",
                    "description": "Quality score between 0 and 10 indicating overall correctness and completeness"
                }
            },
            "required": ["known_story", "issues", "notes", "score"]
        }

    def validate_json(self, story_text: str, generated_json: dict, metadata: dict):
        genai.configure(api_key=self.api_key)
        prompt = (
            "You are an expert literary analyst.\n\n"
            f"Based on the story '{metadata['title']}' by {metadata['author']}', validate the extracted information below"
            "- Are the characters and relationships correctly reflected in the story?\n"
            "- Are any hallucinated (non-existent) elements present?\n"
            "- Are you familiar with the story and can verify the accuracy of this analysis?\n\n"
            "Return only a JSON object like this:\n"
            "{\n  known_story: true or false,\n  issues: [list of hallucinated, missing, or inaccurate elements],\n  notes: a brief comment on the overall accuracy,\n  score: integer between 0 and 10\n}\n\n"
            "STORY:\n" + story_text[:8000] + "\n\nSTRUCTURED_JSON:\n" + json.dumps(generated_json, indent=2)
        )
        schema = self.get_validation_schema()
        function_decl = genai.protos.FunctionDeclaration(
            name="return_json",
            description="Validate output",
            parameters=schema
        )
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={"temperature": 0.8},
            tools=[function_decl]
        )
        for attempt in range(self.max_retries):
            try:
                result = model.generate_content(prompt, tool_config={'function_calling_config': 'ANY'})
                fc = result.candidates[0].content.parts[0].function_call
                parsed = type(fc).to_dict(fc)["args"]
                return parsed
            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise

def fetch_gutenberg_text(book_id: int) -> str:
    fallback_url = f"https://www.gutenberg.org/files/{book_id}/{book_id}-0.txt"
    primary_url = f"https://www.gutenberg.org/files/{book_id}/{book_id}.txt"
    resp = requests.get(primary_url)
    if resp.status_code == 200:
        return resp.text
    resp_fallback = requests.get(fallback_url)
    if resp_fallback.status_code == 200:
        return resp_fallback.text
    raise ValueError("Could not fetch text from Project Gutenberg.")

def fetch_gutenberg_metadata(book_id: int) -> dict:
    url = f"https://www.gutenberg.org/ebooks/{book_id}"
    resp = requests.get(url)
    soup = BeautifulSoup(resp.text, 'html.parser')
    title = soup.find("meta", attrs={"property": "og:title"})["content"]
    author = soup.find("a", rel="marcrel:aut").get_text(strip=True)
    return {"title": title, "author": author}

@app.route("/api/analyze", methods=["POST"])
def analyze():
    book_id = request.json.get("book_id")
    validate_flag = request.json.get("validate", False)

    if not book_id:
        return jsonify({"error": "Missing book_id"}), 400
    text = fetch_gutenberg_text(book_id)
    plotter = PlotThePlot(api_key=os.getenv("GEMINI_API_KEY"))
    result = plotter.analyze_text(text)
    if validate_flag:
        metadata = fetch_gutenberg_metadata(book_id)
        validation_result = plotter.validate_json(text, result, metadata)
        result["validation"] = validation_result
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)