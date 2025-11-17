import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

print(f"OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
print(f"OLLAMA_MODEL: {OLLAMA_MODEL}")
