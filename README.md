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

#The backend runs at http://localhost:8000.
#CORS is configured for http://localhost:5173.
```

## 2. Frontend - React
### Setup & Run

```
cd frontend
npm install
npm run dev
```

### Firebase Client Config
If `frontend/src/lib/firebase.ts` already has config, you’re good.

If not, reach me.

## 3. Admin Set-up
Event creation is only available for user accounts with the **admin** role.

Event deletion is **unavailable** for testing.
 *(data corruption problem)*

 ## 4. Friend System
- Friends:
    - users/{uid}/friends/{friendUid} → { uid, since, name?, photoURL? }
- Requests:
    - users/{recipientUid}/friendRequests/{fromUid} → { createdAt }
- Backend endpoints:
    - **GET** /friends — list friends
	- **GET** /friends/requests — list requests
	- **POST** /friends/requests/{toUid} — send request
	- **POST** /friends/requests/{fromUid}/accept — accept
	- **POST** /friends/requests/{fromUid}/decline — decline
	- **DELETE** /friends/{friendUid} — unfriend

## 5. First Run Checklist
**1.** Pull the repo.
**2.** Put backend/secrets/firebase.json in place.
**3.**	Start the backend (`uvicorn main:app --reload --port 8000`).
**4.**	Start the frontend (`npm run dev`).
**5.**	Sign in with your @umass.edu account.
**6.**	For event creation, get your admin claim set.