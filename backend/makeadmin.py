import os, firebase_admin
from firebase_admin import credentials, auth
cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
firebase_admin.initialize_app(cred)
auth.set_custom_user_claims("ZNzo9dlOFHPIrRpc9Bo4SDC0A013", {"role":"admin","roles":["admin"]})
print("done")