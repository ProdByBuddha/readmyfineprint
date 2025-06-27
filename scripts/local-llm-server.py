#!/usr/bin/env python3
"""
Lightweight LLM server for PII detection in Replit
Uses DistilBERT for fast inference without GPU requirements
"""

import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import signal
import sys
from typing import Dict, Any, List
import re

# Try to import transformers, fallback to regex-based detection
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
    HAS_TRANSFORMERS = True
    print("🤖 Transformers library available - using NER model")
except ImportError:
    HAS_TRANSFORMERS = False
    print("⚠️ Transformers not available - using regex-based PII detection")

class PIIDetector:
    def __init__(self):
        self.patterns = {
            'PERSON': [
                r'\b[A-Z][a-z]+ [A-Z][a-z]+\b',  # Name patterns
                r'\b(?:Mr|Ms|Mrs|Dr)\.? [A-Z][a-z]+\b'
            ],
            'PHONE': [
                r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
                r'\(\d{3}\)\s?\d{3}[-.]?\d{4}'
            ],
            'EMAIL': [
                r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            ],
            'SSN': [
                r'\b\d{3}-\d{2}-\d{4}\b',
                r'\b\d{9}\b'
            ],
            'ADDRESS': [
                r'\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b'
            ],
            'CREDIT_CARD': [
                r'\b(?:\d{4}[-\s]?){3}\d{4}\b'
            ]
        }
        
        if HAS_TRANSFORMERS:
            try:
                self.ner_pipeline = pipeline(
                    "ner", 
                    model="dbmdz/bert-large-cased-finetuned-conll03-english",
                    tokenizer="dbmdz/bert-large-cased-finetuned-conll03-english",
                    aggregation_strategy="simple"
                )
                print("✅ NER model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load NER model: {e}")
                self.ner_pipeline = None
        else:
            self.ner_pipeline = None

    def analyze_text(self, text: str) -> Dict[str, Any]:
        """Analyze text for PII using available methods"""
        results = {
            'entities': [],
            'confidence': 0.0,
            'method': 'regex'
        }
        
        # Use transformer model if available
        if self.ner_pipeline:
            try:
                ner_results = self.ner_pipeline(text)
                results['entities'] = [
                    {
                        'entity': r['entity_group'],
                        'confidence': r['score'],
                        'start': r['start'],
                        'end': r['end'],
                        'word': r['word']
                    }
                    for r in ner_results
                ]
                results['method'] = 'transformer'
                results['confidence'] = sum(r['score'] for r in ner_results) / len(ner_results) if ner_results else 0.0
                return results
            except Exception as e:
                print(f"⚠️ Transformer analysis failed: {e}")
        
        # Fallback to regex-based detection
        for entity_type, patterns in self.patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    results['entities'].append({
                        'entity': entity_type,
                        'confidence': 0.8,  # High confidence for regex matches
                        'start': match.start(),
                        'end': match.end(),
                        'word': match.group()
                    })
        
        results['confidence'] = 0.8 if results['entities'] else 0.0
        return results

class LLMRequestHandler(BaseHTTPRequestHandler):
    detector = PIIDetector()
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/generate':
            self.handle_generate()
        elif parsed_path.path == '/api/pull':
            self.handle_pull()
        else:
            self.send_error(404, "Not Found")
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/tags':
            self.handle_tags()
        else:
            self.send_error(404, "Not Found")
    
    def handle_generate(self):
        """Handle text generation (PII analysis)"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            prompt = request_data.get('prompt', '')
            
            # Analyze the prompt for PII
            analysis = self.detector.analyze_text(prompt)
            
            # Generate response based on analysis
            if analysis['entities']:
                entity_summary = ', '.join(set(e['entity'] for e in analysis['entities']))
                response_text = f"PII detected: {entity_summary}. Found {len(analysis['entities'])} entities with {analysis['confidence']:.2f} confidence using {analysis['method']} method."
            else:
                response_text = "No PII detected in the provided text."
            
            response = {
                'model': 'replit-pii-detector',
                'created_at': '2024-01-01T00:00:00Z',
                'response': response_text,
                'done': True,
                'analysis': analysis
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")
    
    def handle_pull(self):
        """Handle model pull requests (mock)"""
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Mock streaming response
            responses = [
                {'status': 'pulling manifest'},
                {'status': 'downloading model'},
                {'status': 'verifying sha256'},
                {'status': 'success'}
            ]
            
            for resp in responses:
                self.wfile.write((json.dumps(resp) + '\n').encode('utf-8'))
                self.wfile.flush()
                
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")
    
    def handle_tags(self):
        """Handle tags request (list models)"""
        response = {
            'models': [
                {
                    'name': 'replit-pii-detector:latest',
                    'modified_at': '2024-01-01T00:00:00Z',
                    'size': 1024,
                    'digest': 'sha256:dummy'
                }
            ]
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to reduce noise"""
        pass

def run_server(port=11434):
    """Run the LLM server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, LLMRequestHandler)
    
    print(f"🚀 Local LLM server starting on port {port}")
    print("📡 Compatible with Ollama API endpoints")
    print("🔍 Ready for PII detection requests")
    print("🛑 Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
