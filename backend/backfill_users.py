#!/usr/bin/env python3
"""
Backfill `uid` field in RSVP docs:
- Target path: /events/{eventId}/rsvps/{uidDocId}
- If a doc under rsvps is missing `uid`, set it to the document ID.

Usage:
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
  pip install firebase-admin
  python backfill_rsvps_uid.py [--dry-run] [--batch-size 400] [--limit N]
"""

import argparse
import math
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore

def init_firebase():
    # Requires GOOGLE_APPLICATION_CREDENTIALS env var to be set.
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()

def backfill(db, dry_run: bool = False, batch_size: int = 400, limit: Optional[int] = None):
    assert 1 <= batch_size <= 500, "batch_size must be between 1 and 500 (Firestore limit is 500)."

    print(f"Scanning collection group 'rsvps'... (dry_run={dry_run}, batch_size={batch_size}, limit={limit})")

    # collection_group requires python Admin SDK / google-cloud-firestore 2.x+
    qry = db.collection_group("rsvps")
    if limit:
        qry = qry.limit(limit)

    snaps = list(qry.stream())
    total = len(snaps)
    print(f"Found {total} RSVP docs to inspect.")

    to_fix = []
    for d in snaps:
        data = d.to_dict() or {}
        if "uid" not in data or not data.get("uid"):
            to_fix.append(d)

    print(f"{len(to_fix)} docs missing `uid` (or empty).")

    if dry_run or not to_fix:
        print("Dry run or nothing to update. Exiting.")
        return

    # Batch updates
    batches = math.ceil(len(to_fix) / batch_size)
    updated = 0
    for i in range(batches):
        start = i * batch_size
        chunk = to_fix[start : start + batch_size]
        batch = db.batch()
        for doc_snap in chunk:
            # In RSVP subcollection, doc.id is the user's uid
            batch.set(doc_snap.reference, {"uid": doc_snap.id}, merge=True)
        batch.commit()
        updated += len(chunk)
        print(f"Committed batch {i+1}/{batches} (+{len(chunk)}), total updated={updated}")

    print(f"Done. Updated {updated} RSVP docs with `uid`.")

def main():
    parser = argparse.ArgumentParser(description="Backfill `uid` field in /events/*/rsvps/* docs.")
    parser.add_argument("--dry-run", action="store_true", help="Scan only; do not write.")
    parser.add_argument("--batch-size", type=int, default=400, help="Writes per batch (<=500).")
    parser.add_argument("--limit", type=int, default=None, help="Optional limit on RSVP docs to scan.")
    args = parser.parse_args()

    db = init_firebase()
    backfill(db, dry_run=args.dry_run, batch_size=args.batch_size, limit=args.limit)

if __name__ == "__main__":
    main()