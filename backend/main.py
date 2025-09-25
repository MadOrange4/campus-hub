import os
from typing import Optional, Literal, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Request, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from pydantic import BaseModel, Field

from google.cloud.firestore_v1 import Increment
import firebase_admin
from firebase_admin import auth as fb_auth, credentials, firestore

# Alias for clarity in transactional sections
afs = firestore

ALLOWED_ORIGIN = "http://localhost:5173"
ALLOWED_DOMAIN = "umass.edu"

# --- Firebase Admin init ---
if not firebase_admin._apps:
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS env var is not set")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth dependency ---
def verify_token(req: Request):
    hdr = req.headers.get("Authorization", "")
    if not hdr.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = hdr.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ID token")

    email = (decoded.get("email") or "").lower()
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="UMass email required")

    provider = (decoded.get("firebase") or {}).get("sign_in_provider")
    if provider == "password" and not decoded.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your email to continue")
    return decoded

# --- Models ---
Role = Literal["student","staff","admin","professor","ta","club_officer"]
Year = Literal["freshman","sophomore","junior","senior","grad","alumni","staff","faculty","other"]
Visibility = Literal["public","campus","private"]

class UserProfile(BaseModel):
    uid: str
    email: str
    name: Optional[str] = None
    photoURL: Optional[str] = None
    primaryRole: Optional[Role] = None
    roles: List[Role] = Field(default_factory=list)
    year: Optional[Year] = None
    major: Optional[str] = None
    bio: Optional[str] = ""
    pronouns: Optional[str] = None
    phone: Optional[str] = None
    visibility: Visibility = "campus"
    notificationPrefs: Dict[str, bool] = Field(
        default_factory=lambda: {"eventReminders": True, "emailUpdates": False, "push": True}
    )
    domainOk: bool = True
    isStaffVerified: bool = False
    createdAt: Optional[Any] = None
    updatedAt: Optional[Any] = None

# Fields users are allowed to update via PATCH
ALLOWED_USER_FIELDS = {
    "name","photoURL","year","major","bio","pronouns","phone","visibility","notificationPrefs"
}

def _defaults_for_new_user(uid: str, email: str, name: Optional[str], photo: Optional[str]) -> dict:
    return {
        "uid": uid,
        "email": email,
        "name": name or "",
        "photoURL": photo or "",
        "primaryRole": "student",
        "roles": ["student"],
        "year": None,
        "major": None,
        "bio": "",
        "pronouns": None,
        "phone": None,
        "visibility": "campus",
        "notificationPrefs": {"eventReminders": True, "emailUpdates": False, "push": True},
        "domainOk": email.endswith(f"@{ALLOWED_DOMAIN}"),
        "isStaffVerified": False,
        "createdAt": afs.SERVER_TIMESTAMP,
        "updatedAt": afs.SERVER_TIMESTAMP,
        # Useful for search (optional but recommended)
        "nameLower": (name or "").lower(),
        "emailLower": (email or "").lower(),
        # Counters
        "friendsCount": 0,
        "pendingCount": 0,
    }

def _doc_to_profile(doc) -> UserProfile:
    data = doc.to_dict()
    return UserProfile(**data)

# --- Core user routes ---

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

@app.get("/users/me", response_model=UserProfile)
def get_or_create_me(decoded: dict = Depends(verify_token)):
    uid = decoded["uid"]
    email = decoded.get("email") or ""
    name = decoded.get("name")
    picture = decoded.get("picture")

    ref = db.collection("users").document(uid)
    snap = ref.get()
    if not snap.exists:
        ref.set(_defaults_for_new_user(uid, email, name, picture))
        snap = ref.get()
    return _doc_to_profile(snap)

@app.patch("/users/me", response_model=UserProfile)
def update_me(payload: dict = Body(...), decoded: dict = Depends(verify_token)):
    uid = decoded["uid"]
    ref = db.collection("users").document(uid)
    snap = ref.get()
    if not snap.exists:
        email = decoded.get("email") or ""
        name = decoded.get("name")
        picture = decoded.get("picture")
        ref.set(_defaults_for_new_user(uid, email, name, picture))

    update_data = {k: v for k, v in payload.items() if k in ALLOWED_USER_FIELDS}
    if not update_data:
        raise HTTPException(status_code=400, detail="No writable fields provided.")
    update_data["updatedAt"] = afs.SERVER_TIMESTAMP
    ref.set(update_data, merge=True)
    return _doc_to_profile(ref.get())

# --- Friends system API ---

friends = APIRouter(prefix="/friends", tags=["friends"])

def _user_doc(uid: str):
    return db.collection("users").document(uid)

def _friends_col(uid: str):
    return _user_doc(uid).collection("friends")

def _requests_col(uid: str):
    # inbox on recipient
    return _user_doc(uid).collection("friendRequests")

@friends.get("")
def list_friends(decoded: dict = Depends(verify_token)):
    """Return current user's friends with basic display fields."""
    me = decoded["uid"]
    snaps = list(_friends_col(me).stream())
    out = []
    for s in snaps:
        fuid = s.id
        # join minimal profile info
        u = _user_doc(fuid).get()
        udata = u.to_dict() or {}
        out.append({
            "uid": fuid,
            "name": udata.get("name") or (udata.get("email") or "").split("@")[0],
            "photoURL": udata.get("photoURL"),
            "since": (s.to_dict() or {}).get("since"),
        })
    return {"friends": out}

@friends.get("/requests")
def list_requests(decoded: dict = Depends(verify_token)):
    """Return incoming friend requests (pending)."""
    me = decoded["uid"]
    snaps = list(_requests_col(me).order_by("createdAt", direction=afs.Query.DESCENDING).stream())
    out = []
    for s in snaps:
        data = s.to_dict() or {}
        out.append({
            "fromUid": s.id,
            "createdAt": data.get("createdAt"),
        })
    return {"requests": out}

@friends.post("/requests/{to_uid}")
def send_request(to_uid: str = Path(...), decoded: dict = Depends(verify_token)):
    """Send a friend request to to_uid (idempotent)."""
    me = decoded["uid"]
    if me == to_uid:
        raise HTTPException(400, "Cannot friend yourself.")

    me_doc = _user_doc(me)
    them_doc = _user_doc(to_uid)
    req_ref = _requests_col(to_uid).document(me)  # stored under recipient inbox

    @afs.transactional
    def txn(tx: afs.Transaction):
        # ---- READS first
        them_exists = them_doc.get(transaction=tx).exists
        if not them_exists:
            raise HTTPException(404, "Recipient not found")

        # If already friends, bail early
        if _friends_col(me).document(to_uid).get(transaction=tx).exists:
            return

        req_snap = req_ref.get(transaction=tx)
        if req_snap.exists:
            # already pending; do nothing (idempotent)
            return

        # ---- WRITES
        tx.set(req_ref, {"createdAt": afs.SERVER_TIMESTAMP})
        tx.update(them_doc, {"pendingCount": Increment(1)})

    txn(db.transaction())
    return {"ok": True}

@friends.post("/requests/{from_uid}/accept")
def accept_request(from_uid: str = Path(...), decoded: dict = Depends(verify_token)):
    """
    Accept request sent by from_uid → current user.
    Creates mirrored edges, updates counts, removes request.
    """
    me = decoded["uid"]
    me_doc = _user_doc(me)
    them_doc = _user_doc(from_uid)

    req_ref = _requests_col(me).document(from_uid)
    me_edge = _friends_col(me).document(from_uid)
    them_edge = _friends_col(from_uid).document(me)

    @afs.transactional
    def txn(tx: afs.Transaction):
        # ---- READS first
        req_snap = req_ref.get(transaction=tx)
        if not req_snap.exists:
            raise HTTPException(404, "Request not found")

        me_data = me_doc.get(transaction=tx).to_dict() or {}
        them_data = them_doc.get(transaction=tx).to_dict() or {}

        me_edge_exists = me_edge.get(transaction=tx).exists
        them_edge_exists = them_edge.get(transaction=tx).exists

        # ---- WRITES
        now = afs.SERVER_TIMESTAMP

        if not me_edge_exists:
            tx.set(me_edge, {
                "uid": from_uid,
                "since": now,
                "lastUpdated": now,
                "name": them_data.get("name", ""),
                "photoURL": them_data.get("photoURL"),
            })
            tx.update(me_doc, {"friendsCount": Increment(1)})

        if not them_edge_exists:
            tx.set(them_edge, {
                "uid": me,
                "since": now,
                "lastUpdated": now,
                "name": me_data.get("name", ""),
                "photoURL": me_data.get("photoURL"),
            })
            tx.update(them_doc, {"friendsCount": Increment(1)})

        tx.delete(req_ref)
        tx.update(me_doc, {"pendingCount": Increment(-1)})

    txn(db.transaction())
    return {"ok": True}

@friends.post("/requests/{from_uid}/decline")
def decline_request(from_uid: str = Path(...), decoded: dict = Depends(verify_token)):
    """Decline (delete) an incoming request and decrement pendingCount."""
    me = decoded["uid"]
    me_doc = _user_doc(me)
    req_ref = _requests_col(me).document(from_uid)

    @afs.transactional
    def txn(tx: afs.Transaction):
        # ---- READS first
        snap = req_ref.get(transaction=tx)
        if not snap.exists:
            raise HTTPException(404, "Request not found")

        # ---- WRITES
        tx.delete(req_ref)
        tx.update(me_doc, {"pendingCount": Increment(-1)})

    txn(db.transaction())
    return {"ok": True}

@friends.delete("/{friend_uid}")
def unfriend(friend_uid: str, decoded: dict = Depends(verify_token)):
    """Remove friendship both directions and update counters appropriately (idempotent)."""
    me = decoded["uid"]
    if me == friend_uid:
        raise HTTPException(400, "Cannot unfriend yourself.")

    me_doc   = _user_doc(me)
    them_doc = _user_doc(friend_uid)
    me_edge  = _friends_col(me).document(friend_uid)
    them_edge = _friends_col(friend_uid).document(me)
    req_doc  = _requests_col(me).document(friend_uid)  # in case a pending request exists

    @afs.transactional
    def txn(tx: afs.Transaction):
        # ------- READS (all reads happen before any write) -------
        me_edge_snap   = me_edge.get(transaction=tx)
        them_edge_snap = them_edge.get(transaction=tx)
        req_snap       = req_doc.get(transaction=tx)

        # ------- WRITES -------
        if me_edge_snap.exists:
            tx.delete(me_edge)
            tx.update(me_doc, {"friendsCount": afs.Increment(-1)})

        if them_edge_snap.exists:
            tx.delete(them_edge)
            tx.update(them_doc, {"friendsCount": afs.Increment(-1)})

        # Clean up any pending incoming request (edge-case) without erroring
        if req_snap.exists:
            tx.delete(req_doc)
            tx.update(me_doc, {"pendingCount": afs.Increment(-1)})

    txn(db.transaction())
    return {"ok": True}

@friends.get("/search")
def search_users(q: str, decoded: dict = Depends(verify_token)):
    """
    Simple user search by prefix on nameLower OR emailLower.
    Returns minimal public info; excludes the requester.
    """
    me = decoded["uid"]
    q = (q or "").strip().lower()
    if len(q) < 2:
        return {"results": []}

    users_col = db.collection("users")
    limit_n = 20

    # Firestore has no OR — do two prefix queries and merge in Python
    end = q + "\uf8ff"

    # nameLower prefix
    by_name = users_col.where("nameLower", ">=", q).where("nameLower", "<=", end).limit(limit_n).stream()
    # emailLower prefix
    by_email = users_col.where("emailLower", ">=", q).where("emailLower", "<=", end).limit(limit_n).stream()

    seen = set()
    out = []
    for snap in list(by_name) + list(by_email):
        if snap.id in seen or snap.id == me:
            continue
        seen.add(snap.id)
        d = snap.to_dict() or {}
        # respect basic visibility ("private" hidden)
        if d.get("visibility") == "private":
            continue
        out.append({
            "uid": snap.id,
            "name": d.get("name") or (d.get("email") or "").split("@")[0],
            "photoURL": d.get("photoURL") or "",
        })
        if len(out) >= limit_n:
            break

    return {"results": out}

# Mount router
app.include_router(friends)