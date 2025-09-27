# grant_admin.py
# Give a user admin rights via custom claims, and mirror to /users/{uid}

import os
import sys
import firebase_admin
from firebase_admin import credentials, auth, firestore

# --- Init Admin SDK ---
# Point GOOGLE_APPLICATION_CREDENTIALS to your service account JSON
#   export GOOGLE_APPLICATION_CREDENTIALS=backend/secrets/firebase.json
if not firebase_admin._apps:
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        raise RuntimeError("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON")
    firebase_admin.initialize_app(credentials.Certificate(cred_path))

db = firestore.client()

def grant_admin_by_uid(uid: str):
    # 1) Set custom claims (this is what your rules check)
    auth.set_custom_user_claims(uid, {"role": "admin", "roles": ["admin"]})
    print(f"✅ Set custom claims for {uid}: role=admin, roles=['admin']")

    # 2) (Optional) Update Firestore profile so UI chips show “Admin”
    db.collection("users").document(uid).set(
        {
            "primaryRole": "admin",
            "roles": firestore.ArrayUnion(["admin"]),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    print(f"✅ Updated /users/{uid} profile to include admin role")

def grant_admin_by_email(email: str):
    user = auth.get_user_by_email(email)
    grant_admin_by_uid(user.uid)
    print(f"User {email} -> uid={user.uid}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage:\n  python grant_admin.py <uid|email>")
        sys.exit(1)

    identifier = sys.argv[1]
    if "@" in identifier:
        grant_admin_by_email(identifier)
    else:
        grant_admin_by_uid(identifier)

    print("\n👉 Have the user sign out/in (or call getIdToken(true)) to refresh the token.")