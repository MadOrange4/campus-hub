import os
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import auth as fb_auth, credentials

ALLOWED_ORIGIN = "http://localhost:5173"
ALLOWED_DOMAIN = "umass.edu"

if not firebase_admin._apps:
    cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    firebase_admin.initialize_app(cred)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_token(req: Request):
    hdr = req.headers.get("Authorization", "")
    if not hdr.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = hdr.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ID token")
    # Hard domain enforcement
    email = (decoded.get("email") or "").lower()
    domain_ok = email.endswith(f"@{ALLOWED_DOMAIN}")
    if not domain_ok:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="UMass email required")
    return decoded

@app.get("/me")
def me(decoded: dict = Depends(verify_token)):
    return {
        "uid": decoded.get("uid"),
        "email": decoded.get("email"),
        "email_verified": decoded.get("email_verified"),
        "name": decoded.get("name"),
        "picture": decoded.get("picture"),
        "domain_ok": True,
    }
