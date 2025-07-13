#!/bin/bash
# Ollama Service for Replit
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_MODELS=/tmp/ollama/models
mkdir -p $OLLAMA_MODELS
ollama serve
