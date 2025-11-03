import os
from dotenv import load_dotenv
from typing import Optional, Literal, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Request, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

import asyncio
from firebase_admin.auth import ActionCodeSettings 
from google.cloud.firestore_v1 import Increment
from google.cloud.firestore_v1.base_query import FieldFilter
import firebase_admin
from firebase_admin import auth as fb_auth, credentials, firestore

# Alias for clarity in transactional sections
afs = firestore

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

class PasswordResetRequest(BaseModel):
    email: str = Field(..., example="user@umass.edu", description="The user's registered email address")

class PasswordChangeRequest(BaseModel):
    oobCode: str = Field(..., description="The out-of-band code received in the reset link")
    newPassword: str = Field(..., min_length=6, description="The new password")

class EmailVerificationRequest(BaseModel):
    email: str = Field(..., example="user@umass.edu", description="The user's email address to verify")

# Load environment variables from .env file
load_dotenv()

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

# --- password reset --- 
@auth_router.post("/forgot-password", summary="Request a password reset email")
async def forgot_password(request: PasswordResetRequest):
    """
    Sends a password reset email to the provided email address using Firebase Auth.
    """

    action_code_settings = ActionCodeSettings(
        url="http://localhost:5173/reset-password",
        handle_code_in_app=False # Use snake_case here for Python SDK class
    )

    try:
        # Pass the ActionCodeSettings object correctly
        await run_in_threadpool(
            fb_auth.generate_password_reset_link,
            email=request.email,
            action_code_settings=action_code_settings
        )
        return {"message": "If the email is registered, a password reset link has been sent."}

    except fb_auth.UserNotFoundError:
        # For security, return a generic success message even if the user isn't found
        return {"message": "If the email is registered, a password reset link has been sent."}
    except Exception as e:
        # Catch other potential errors (e.g., invalid email format, network issues)
        print(f"Error generating password reset link: {e}")
        
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while trying to send the reset email."
        )

@auth_router.post("/reset-password", summary="Reset the password using the OOB code")
async def reset_password(request: PasswordChangeRequest):
    """
    Finalizes the password reset using the out-of-band code from the email link
    and the new password.
    """
    try:
        # Firebase handles verifying the code and updating the password
        # This function runs synchronously and must be awaited using run_in_threadpool
        await run_in_threadpool(
            fb_auth.verify_password_reset_code_and_set_password,
            oob_code=request.oobCode,
            new_password=request.newPassword
        )
        return {"message": "Your password has been successfully reset."}

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid oobCode or new password format."
        )
    except Exception as e:
        print(f"Error resetting password: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The link is invalid or expired. Please request a new one."
        )

# --- deleting expired events ---

def delete_expired_events():
    """
    Background task to find and delete expired events from Firestore.
    """
    print("Running background task to delete expired events...")
    # Define the collection where your events are stored
    events_ref = db.collection('events')

    # Use a standard datetime object for the query comparison
    now_utc = datetime.now(timezone.utc)

    # Query for events where 'endDate' is less than the current time
    try:
        expired_events_query = events_ref.where(filter=FieldFilter('end', '<', now_utc))
        snapshots = expired_events_query.stream() # This returns a sync generator

        # A batch allows you to delete multiple documents in a single request.
        batch = db.batch()
        count = 0

        # Loop over the synchronous generator
        for doc_snapshot in snapshots:
            batch.delete(doc_snapshot.reference)
            count += 1
            if count % 500 == 0:
                batch.commit() # Commit synchronously
                batch = db.batch()

        if count > 0:
            batch.commit() # Commit the final batch
            print(f"Deleted {count} expired events.")
        else:
            print("No expired events found.")

    except Exception as e:
        print(f"Error during expired event cleanup: {e}")


# Initialize the scheduler globally to be accessed in the lifespan context manager
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup...")

    # Your existing startup logic
    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path:
            raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS env var is not set")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    
    # 1. Run initial cleanup immediately in a threadpool
    await run_in_threadpool(delete_expired_events)

    # 2. Start the periodic scheduler, which will also use run_in_threadpool
    scheduler.add_job(lambda: asyncio.create_task(run_in_threadpool(delete_expired_events)), IntervalTrigger(hours=24))
    scheduler.start()
    
    yield

    # 3. Shut down the scheduler gracefully
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
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

# Endpoint to create a new event
@app.post("/events", status_code=status.HTTP_201_CREATED)
async def create_event(event_data: NewEventPayload, decoded_token: dict = Depends(verify_token)):
    # The 'decoded_token' contains the user's information (including UID) from the verified token
    uid = decoded_token['uid']
    
    # Optional: You could check user roles here if needed (e.g., ensure the user is an 'organizer')
    # user_doc = db.collection("users").document(uid).get()
    # if not user_doc.exists or 'organizer' not in user_doc.get('roles', []):
    #    raise HTTPException(status_code=403, detail="User is not authorized to create events")

    # Convert incoming data types for Firestore
    try:
        start_time = datetime.fromisoformat(event_data.start)
        end_time = datetime.fromisoformat(event_data.end) if event_data.end else None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")

    if end_time and end_time <= start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time.")

    doc_data: Dict[str, any] = {
        "title": event_data.title,
        "desc": event_data.desc,
        "locationName": event_data.locationName,
        "location": GeoPoint(event_data.location.lat, event_data.location.lng),
        "start": start_time,
        "end": end_time,
        "tags": event_data.tags,
        "bannerUrl": event_data.bannerUrl,
        "createdBy": uid,
        "createdAt": server_timestamp(),
        "updatedAt": server_timestamp(),
        "status": "pending_review", # Added a status for moderation
    }

    try:
        # Add document to the 'events' collection
        doc_ref = await run_in_threadpool(db.collection("events").add, doc_data)
        return {"id": doc_ref[1].id, "message": "Event created successfully"}
    except Exception as e:
        # In a real app, log the detailed exception
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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

@app.delete("/users/me")
def delete_me(decoded: dict = Depends(verify_token)):
    """Deletes the authenticated user's account and all associated data."""
    uid = decoded["uid"]

    try:
        user_ref = db.collection("users").document(uid)

        # delete subcollections (friends, friendRequests, posts)
        subcollections = ["friends", "friendRequests", "posts"]
        for sub in subcollections:
            sub_ref = user_ref.collection(sub)
            for doc in sub_ref.stream():
                doc.reference.delete()

        # delete Firestore user document
        user_ref.delete()

        # delete from Firebase Authentication
        fb_auth.delete_user(uid)

        return {"ok": True, "message": "Account deleted successfully."}

    except fb_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

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

@friends.get("/status/{other_uid}")
def status(other_uid: str, decoded: dict = Depends(verify_token)):
    me = decoded["uid"]
    me_edge   = _friends_col(me).document(other_uid).get()
    them_edge = _friends_col(other_uid).document(me).get()
    incoming  = _requests_col(me).document(other_uid).get()
    outgoing  = _requests_col(other_uid).document(me).get()
    return {
        "friend": me_edge.exists and them_edge.exists,
        "incomingPending": incoming.exists,
        "iSentPending": outgoing.exists,
    }

# Mount router
app.include_router(friends)



