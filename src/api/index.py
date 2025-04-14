import os
import time
import json
import requests
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
from auth import JWT_SECRET, JWT_ALGORITHM
from datetime import datetime, timedelta

import google.generativeai as genai
from bs4 import BeautifulSoup
from auth import auth_bp
from database import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS
CORS(app, 
     resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Accept"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

app.secret_key = os.environ.get('SECRET_KEY', 'doggystyle')
app.register_blueprint(auth_bp, url_prefix='/api/auth')

db = Database()

# JWT Configuration
JWT_EXPIRATION = timedelta(days=1)

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
                                "description": "Brief summary of this character's role"
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
            "3. Summary: The 'summary' should be a human-readable text block that includes the main plot, key players, and act-wise breakdown — written in clear prose (no JSON, lists or underscored names).\n"
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
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Please log in to analyze books'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token has expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    
    book_id = request.json.get("book_id")
    validate_flag = request.json.get("validate", False)

    if not book_id:
        return jsonify({"error": "Please provide a book ID to analyze"}), 400
    
    try:
        # Fetch metadata first to get the title
        metadata = fetch_gutenberg_metadata(book_id)
        text = fetch_gutenberg_text(book_id)
        plotter = PlotThePlot(api_key=os.environ.get('GEMINI_API_KEY'))
        result = plotter.analyze_text(text)
        
        if validate_flag:
            validation_result = plotter.validate_json(text, result, metadata)
            result["validation"] = validation_result
        
        # Record the search in database using existing method
        db.add_search(user_id, str(book_id), metadata['title'])
        
        # Add title to response
        result["title"] = metadata['title']
        
        return jsonify(result)
    except ValueError as e:
        logger.warning(f"User error in analyze endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error in analyze endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred while analyzing the book. Please try again later."}), 500

@app.route('/api/trending', methods=['GET'])
def get_trending():
    limit = request.args.get('limit', default=10, type=int)
    trending = db.get_trending_books(limit)
    return jsonify([{
        'book_id': t.book_id,
        'title': t.title,
        'search_count': t.search_count,
        'last_searched': t.last_searched.isoformat()
    } for t in trending])

@app.route('/api/share', methods=['POST'])
def share_analysis():
    try:
        book_id = request.json.get('book_id')
        title = request.json.get('title')
        response_data = request.json.get('response_data')
        note = request.json.get('note')
        expires_in_days = request.json.get('expires_in_days', 30)  # Default 30 days
        
        if not all([book_id, title, response_data]):
            return jsonify({'error': 'Book ID, title, and response data are required'}), 400
        
        # Get user ID from token
        token = request.headers.get('Authorization').split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload['user_id']
        
        # Create shared analysis
        shared = db.create_shared_analysis(user_id, book_id, title, response_data, note, expires_in_days)
        
        return jsonify({
            'share_id': shared.id,
            'expires_at': shared.expires_at.isoformat() if shared.expires_at else None
        })
    except Exception as e:
        logger.error(f"Error sharing analysis: {str(e)}")
        return jsonify({'error': 'Failed to share analysis'}), 500

@app.route('/api/share/<share_id>', methods=['GET'])
def get_shared_analysis(share_id):
    try:
        analysis = db.get_shared_analysis(share_id)
        if not analysis:
            return jsonify({'error': 'Shared analysis not found or expired'}), 404
        
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error retrieving shared analysis: {str(e)}")
        return jsonify({'error': 'Failed to retrieve shared analysis'}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5328)