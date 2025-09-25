# Campus Hub

A lightweight campus events + social app for UMass.  

## Features

- Event feed with filters (text, tags, date range)  
- Event details modal with RSVP and live counts  
- Interactive map (Leaflet) for event locations  
- Friends system (search, requests, accept/decline, unfriend)  
- Role-gated event creation (admins only)  
- Profile editing (bio, year, pronouns, phone, visibility)  

**Tech stack:** React + TypeScript + Vite, Tailwind, Firebase (Auth, Firestore), FastAPI (Python), Leaflet.  

---

## Project Layout

```
/frontend     # React app (Vite)
/backend      # FastAPI app (Python)
/backend/secrets/firebase.json  # service account (already shared)
```

---

## Prerequisites

- Node.js 18+ (or 20+)  
- Python 3.11+   

⚠️ Sign-in is restricted to **@umass.edu** accounts.  

---

## 1. Backend — FastAPI

### Setup & Run

```bash
cd backend
python -m venv venv

# macOS/Linux:
source venv/bin/activate

# Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Point Firebase Admin to the service account:
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/secrets/firebase.json"
# Windows (PowerShell):
# $env:GOOGLE_APPLICATION_CREDENTIALS="$PWD\secrets\firebase.json"

# Start server:
uvicorn main:app --reload --port 8000
```