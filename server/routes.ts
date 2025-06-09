import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDocumentSchema } from "@shared/schema";
import { analyzeDocument } from "./openai";
import multer from "multer";
import { z } from "zod";
import mammoth from "mammoth";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT and DOCX files are supported.'));
    }
  }
});

async function extractTextFromFile(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    switch (mimetype) {
      case 'text/plain':
        return buffer.toString('utf-8');
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;
      
      default:
        throw new Error(`File type ${mimetype} is not supported. Please use TXT or DOCX files, or paste the content directly.`);
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create document from text input
  app.post("/api/documents", async (req, res) => {
    try {
      const { title, content, fileType } = insertDocumentSchema.parse(req.body);
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Document content is required" });
      }

      const document = await storage.createDocument({
        title: title || "Untitled Document",
        content,
        fileType: fileType || "text",
        analysis: null
      });

      res.json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Upload document file
  app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const content = await extractTextFromFile(req.file.buffer, req.file.mimetype);
      
      const document = await storage.createDocument({
        title: req.file.originalname || "Uploaded Document",
        content,
        fileType: req.file.mimetype,
        analysis: null
      });

      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "File upload failed" });
    }
  });

  // Analyze document
  app.post("/api/documents/:id/analyze", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.analysis) {
        return res.json(document);
      }

      const analysis = await analyzeDocument(document.content, document.title);
      const updatedDocument = await storage.updateDocumentAnalysis(documentId, analysis);

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error analyzing document:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Analysis failed" });
    }
  });

  // Get all documents
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get specific document
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
