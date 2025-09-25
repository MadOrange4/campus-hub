# backfill_users.py
import os
import firebase_admin
from firebase_admin import auth, credentials, firestore

UID = "ZNzo9dlOFHPIrRpc9Bo4SDC0A013"  # <- your UID

# 1) Initialize Admin SDK
# Option A: use GOOGLE_APPLICATION_CREDENTIALS env var (recommended)
#   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

if firebase_admin._apps:
    app = firebase_admin.get_app()
else:
    if cred_path:
        app = firebase_admin.initialize_app(credentials.Certificate(cred_path))
    else:
        # Option B: fall back to Application Default Credentials if configured
        # (gcloud auth application-default login / or running on GCP)
        app = firebase_admin.initialize_app()

# 2) Set custom claims (this is what your security + frontend should read)
auth.set_custom_user_claims(UID, {"role": "admin", "roles": ["admin"]})
print(f"Set custom claims for {UID}")

# 3) (Optional) Mirror to Firestore profile so UI displays consistently
db = firestore.client()
user_ref = db.collection("users").document(UID)
user_ref.set(
    {
        "primaryRole": "admin",
        "roles": firestore.ArrayUnion(["admin"]),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    },
    merge=True,
)
print("Updated Firestore user document roles/primaryRole.")

# 4) Show what we set
user = auth.get_user(UID)
print("Custom claims now:", user.custom_claims)