#!/usr/bin/env node
/**
 * Lightweight LLM server for PII detection in Replit
 * Uses regex-based PII detection with Ollama-compatible API
 */

const http = require('http');
const url = require('url');

class PIIDetector {
  constructor() {
    this.patterns = {
      'PERSON': [
        /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
        /\b(?:Mr|Ms|Mrs|Dr)\.? [A-Z][a-z]+\b/g
      ],
      'PHONE': [
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        /\(\d{3}\)\s?\d{3}[-.]?\d{4}/g
      ],
      'EMAIL': [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi
      ],
      'SSN': [
        /\b\d{3}-\d{2}-\d{4}\b/g,
        /\b\d{9}\b/g
      ],
      'ADDRESS': [
        /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi
      ],
      'CREDIT_CARD': [
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g
      ],
      'DATE_OF_BIRTH': [
        /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g,
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi
      ]
    };
  }

  analyzeText(text) {
    const results = {
      entities: [],
      confidence: 0.0,
      method: 'regex'
    };
    
    for (const [entityType, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          results.entities.push({
            entity: entityType,
            confidence: 0.85,
            start: match.index,
            end: match.index + match[0].length,
            word: match[0]
          });
        }
      }
    }
    
    results.confidence = results.entities.length > 0 ? 0.85 : 0.0;
    return results;
  }
}

class LLMServer {
  constructor(port = 11434) {
    this.port = port;
    this.detector = new PIIDetector();
  }

  handleGenerate(req, res) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const prompt = requestData.prompt || '';
        
        // Check if this is a detailed analysis request (from local-llm-service)
        const isDetailedAnalysis = prompt.includes('Provide your analysis in this exact JSON format');
        
        if (isDetailedAnalysis) {
          // Extract the text to analyze from the prompt
          const textMatch = prompt.match(/Text to analyze:\s*"""\s*([\s\S]*?)\s*"""/);
          const textToAnalyze = textMatch ? textMatch[1] : prompt;
          
          // Perform enhanced contextual PII analysis
          const analysis = this.analyzeTextForContextualPII(textToAnalyze);
          
          // Create redaction suggestions from detected entities
          const redactionSuggestions = analysis.entities.map(entity => ({
            text: entity.word,
            type: this.mapEntityType(entity.entity),
            startIndex: entity.start,
            endIndex: entity.end,
            confidence: entity.confidence,
            context: `Detected ${entity.entity} pattern`
          }));
          
          // Check for attorney-client privilege keywords
          const hasAttorneyClientPrivilege = this.detectAttorneyClientPrivilege(textToAnalyze);
          
          // Create detailed JSON response
          const detailedResponse = {
            hasPII: analysis.entities.length > 0,
            hasAttorneyClientPrivilege: hasAttorneyClientPrivilege,
            redactionSuggestions: redactionSuggestions,
            confidence: analysis.confidence,
            reasoning: analysis.entities.length > 0 
              ? `Found ${analysis.entities.length} PII entities using regex pattern matching`
              : 'No PII patterns detected in the text'
          };
          
          const response = {
            model: 'nodejs-pii-detector',
            created_at: new Date().toISOString(),
            response: JSON.stringify(detailedResponse, null, 2),
            done: true,
            analysis: analysis
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        }
        
        // Original simple analysis for other requests
        const analysis = this.detector.analyzeText(prompt);
        
        // Generate response based on analysis
        let responseText;
        if (analysis.entities.length > 0) {
          const entityTypes = [...new Set(analysis.entities.map(e => e.entity))];
          const entityCounts = {};
          analysis.entities.forEach(e => {
            entityCounts[e.entity] = (entityCounts[e.entity] || 0) + 1;
          });
          
          const summary = entityTypes.map(type => 
            `${entityCounts[type]} ${type}${entityCounts[type] > 1 ? 's' : ''}`
          ).join(', ');
          
          responseText = `PII detected: ${summary}. Total ${analysis.entities.length} entities found with ${(analysis.confidence * 100).toFixed(0)}% confidence using ${analysis.method} detection.`;
        } else {
          responseText = "No PII detected in the provided text.";
        }
        
        const response = {
          model: 'nodejs-pii-detector',
          created_at: new Date().toISOString(),
          response: responseText,
          done: true,
          analysis: analysis
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  handlePull(req, res) {
    // Mock streaming response for model pull
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const responses = [
      { status: 'pulling manifest' },
      { status: 'downloading model' },
      { status: 'verifying sha256' },
      { status: 'success' }
    ];
    
    let i = 0;
    const sendNext = () => {
      if (i < responses.length) {
        res.write(JSON.stringify(responses[i]) + '\n');
        i++;
        setTimeout(sendNext, 500);
      } else {
        res.end();
      }
    };
    
    sendNext();
  }

  handleTags(req, res) {
    const response = {
      models: [
        {
          name: 'nodejs-pii-detector:latest',
          modified_at: new Date().toISOString(),
          size: 1024,
          digest: 'sha256:dummy'
        }
      ]
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  // Map our entity types to the expected types
  mapEntityType(entityType) {
    const typeMap = {
      'PERSON': 'name',
      'PHONE': 'phone',
      'EMAIL': 'email',
      'ADDRESS': 'address',
      'SSN': 'ssn',
      'CREDIT_CARD': 'credit_card',
      'DATE_OF_BIRTH': 'date_of_birth'
    };
    return typeMap[entityType] || entityType.toLowerCase();
  }

  // Detect attorney-client privilege keywords
  detectAttorneyClientPrivilege(text) {
    const attorneyClientKeywords = [
      'attorney', 'lawyer', 'counsel', 'legal advice', 'privileged',
      'confidential legal', 'client consultation', 'case strategy',
      'legal representation', 'attorney-client', 'legal counsel',
      'law firm', 'litigation', 'legal matter', 'retainer'
    ];
    
    const lowerText = text.toLowerCase();
    return attorneyClientKeywords.some(keyword => lowerText.includes(keyword));
  }

  // Enhanced PII analysis that considers context
  analyzeTextForContextualPII(text) {
    const analysis = this.detector.analyzeText(text);
    const contextuallyValidatedEntities = [];
    
    // Filter out obvious false positives
    for (const entity of analysis.entities) {
      let isValid = true;
      const entityText = entity.word.toLowerCase();
      const surroundingStart = Math.max(0, entity.start - 30);
      const surroundingEnd = Math.min(text.length, entity.end + 30);
      const context = text.substring(surroundingStart, surroundingEnd).toLowerCase();
      
      // Check for form labels and section headers
      if (entity.entity === 'PERSON') {
        // Skip if it looks like a form label
        if (context.includes(':') || context.includes('name:') || 
            /\b(tenant|landlord|start|end|monthly|late|security|pet)\s+(name|date|fee|deposit|rent)\b/.test(context)) {
          console.log(`   - Filtering out form label: "${entity.word}"`);
          isValid = false;
        }
        
        // Skip single words that are likely labels
        if (!entity.word.includes(' ') && 
            /^(tenant|landlord|start|end|monthly|late|security|pet|name|date|fee|deposit|rent)$/i.test(entityText)) {
          console.log(`   - Filtering out single word label: "${entity.word}"`);
          isValid = false;
        }
      }
      
      // Check for time periods being misidentified as addresses
      if (entity.entity === 'ADDRESS') {
        if (/\b\d+\s+(days?|hours?|minutes?|weeks?|months?|years?)\b/.test(entity.word.toLowerCase()) ||
            context.includes('return') || context.includes('notice') || context.includes('after')) {
          console.log(`   - Filtering out time period misidentified as address: "${entity.word}"`);
          isValid = false;
        }
      }
      
      if (isValid) {
        contextuallyValidatedEntities.push(entity);
      }
    }
    
    return {
      ...analysis,
      entities: contextuallyValidatedEntities,
      confidence: contextuallyValidatedEntities.length > 0 ? 0.85 : 0.0
    };
  }

  start() {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.method === 'POST' && parsedUrl.pathname === '/api/generate') {
        this.handleGenerate(req, res);
      } else if (req.method === 'POST' && parsedUrl.pathname === '/api/pull') {
        this.handlePull(req, res);
      } else if (req.method === 'GET' && parsedUrl.pathname === '/api/tags') {
        this.handleTags(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    server.listen(this.port, () => {
      console.log(`🚀 Local LLM server running on port ${this.port}`);
      console.log('📡 Compatible with Ollama API endpoints');
      console.log('🔍 Ready for PII detection requests');
      console.log('🛑 Press Ctrl+C to stop');
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 Server stopped');
      server.close();
      process.exit(0);
    });
  }
}

// Start server if called directly
if (require.main === module) {
  const server = new LLMServer();
  server.start();
}

module.exports = { LLMServer, PIIDetector };
