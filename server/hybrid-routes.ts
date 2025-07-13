/**
 * Hybrid Analysis Routes
 * Endpoints for testing the new zero-PII hybrid system
 */

import { Express, Request, Response } from 'express';
import { hybridDocumentAnalyzer } from './hybrid-document-analyzer';
import { zeroPIIAnalyzer } from './zero-pii-analyzer';
import { requireUserAuth } from './auth';

export function registerHybridRoutes(app: Express) {
  
  /**
   * Test the zero-PII system (demo endpoint without auth)
   */
  app.post('/api/hybrid/demo-zero-pii', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log('🧪 Demo: Testing zero-PII system without authentication');
      const result = await zeroPIIAnalyzer.processDocument(text);
      
      res.json({
        success: true,
        result,
        message: 'Zero-PII demo analysis completed'
      });
    } catch (error) {
      console.error('Zero-PII demo test error:', error);
      res.status(500).json({ error: 'Zero-PII demo analysis failed' });
    }
  });

  /**
   * Test the zero-PII system
   */
  app.post('/api/hybrid/test-zero-pii', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      const result = await zeroPIIAnalyzer.processDocument(text);
      
      res.json({
        success: true,
        result,
        message: 'Zero-PII analysis completed'
      });
    } catch (error) {
      console.error('Zero-PII test error:', error);
      res.status(500).json({ error: 'Zero-PII analysis failed' });
    }
  });

  /**
   * Hybrid document analysis
   */
  app.post('/api/hybrid/analyze', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const userId = req.user?.id;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }
      
      const result = await hybridDocumentAnalyzer.analyzeDocument(text, userId);
      
      res.json({
        success: true,
        result,
        message: 'Hybrid analysis completed'
      });
    } catch (error) {
      console.error('Hybrid analysis error:', error);
      res.status(500).json({ error: 'Hybrid analysis failed' });
    }
  });

  /**
   * Check if Ollama is available
   */
  app.get('/api/hybrid/status', async (req: Request, res: Response) => {
    try {
      // Test Node.js LLM
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const nodeResponse = await fetch(`${ollamaUrl}/api/tags`).catch(() => null);
      
      // Test Ollama (if installed)
      const ollamaResponse = await fetch(`${ollamaUrl}/api/tags`).catch(() => null);
      
      res.json({
        nodeLLM: {
          available: !!nodeResponse,
          status: nodeResponse ? 'running' : 'offline'
        },
        ollama: {
          available: !!ollamaResponse,
          status: ollamaResponse ? 'running' : 'not_installed'
        },
        hybridSystem: {
          ready: true,
          securityLevel: 'zero-pii'
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Status check failed' });
    }
  });
}