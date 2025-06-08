import { apiRequest } from "./queryClient";
import type { Document, InsertDocument } from "@shared/schema";

export async function createDocument(data: { title: string; content: string }): Promise<Document> {
  const response = await apiRequest("POST", "/api/documents", data);
  return response.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  return response.json();
}

export async function analyzeDocument(documentId: number): Promise<Document> {
  const response = await apiRequest("POST", `/api/documents/${documentId}/analyze`);
  return response.json();
}

export async function getDocument(documentId: number): Promise<Document> {
  const response = await fetch(`/api/documents/${documentId}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }
  
  return response.json();
}

export async function getAllDocuments(): Promise<Document[]> {
  const response = await fetch('/api/documents', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  
  return response.json();
}
