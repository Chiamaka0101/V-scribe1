# VocalScribe

Speech-to-text SaaS powered by **OpenAI Whisper API** and **FastAPI**.

## Features
- 🎙 Record audio directly in the browser
- 📁 Upload MP3, WAV, M4A, MP4, WEBM, OGG (up to 25 MB)
- ✨ Transcribe via OpenAI Whisper (cloud API — no GPU needed)
- ✏️ Edit transcription inline
- 📋 Copy to clipboard
- 📄 Export as PDF or TXT

## Local Development

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your OpenAI API key
export OPENAI_API_KEY=sk-...   # Windows: set OPENAI_API_KEY=sk-...

# 4. Run
uvicorn main:app --reload
```

Visit http://localhost:8000

## Deploy to Render

1. Push this folder to a GitHub repo.
2. Go to https://render.com → New → Web Service → connect your repo.
3. Render auto-detects `render.yaml` — just click **Deploy**.
4. In the Render dashboard, add the environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: your OpenAI API key (from platform.openai.com)
5. Done — your app is live!

## Why It Deploys Now

The old version used `openai-whisper` (local ML model) which pulled in **PyTorch (~1.5 GB)**. That exceeds Render's slug size limits.

This version calls the **OpenAI Whisper API** instead — total install size is under **5 MB**.
