"""Read or update the live Firestore security rules with the service account.

Usage:
  python3 -I scripts/firestore-rules.py get OUT_FILE
  python3 -I scripts/firestore-rules.py publish RULES_FILE

Reads VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_CLIENT_EMAIL and
VITE_FIREBASE_PRIVATE_KEY from the environment. Never prints credentials.
"""
import base64
import json
import os
import re
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

API = "https://firebaserules.googleapis.com/v1"


def access_token():
    key = os.environ["VITE_FIREBASE_PRIVATE_KEY"].strip().strip('"').replace("\\n", "\n")
    if "BEGIN" not in key:
        body = re.sub(r"\s", "", key)
        key = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(textwrap.wrap(body, 64)) + "\n-----END PRIVATE KEY-----\n"
    pk = serialization.load_pem_private_key(key.encode(), None)
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    now = int(time.time())
    claims = {
        "iss": os.environ["VITE_FIREBASE_CLIENT_EMAIL"],
        "scope": "https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    msg = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()) + b"." + b64(json.dumps(claims).encode())
    jwt = msg + b"." + b64(pk.sign(msg, padding.PKCS1v15(), hashes.SHA256()))
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt.decode(),
    }).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", data))["access_token"]


def call(token, method, path, body=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} failed: {e.code} {e.read().decode()[:500]}")


def main():
    action, path = sys.argv[1], sys.argv[2]
    project = os.environ["VITE_FIREBASE_PROJECT_ID"]
    release = f"projects/{project}/releases/cloud.firestore"
    token = access_token()
    if action == "get":
        ruleset = call(token, "GET", "/" + call(token, "GET", "/" + release)["rulesetName"])
        with open(path, "w") as f:
            f.write(ruleset["source"]["files"][0]["content"])
        print("Saved live rules to", path)
    elif action == "publish":
        with open(path) as f:
            content = f.read()
        ruleset = call(token, "POST", f"/projects/{project}/rulesets",
                       {"source": {"files": [{"name": "firestore.rules", "content": content}]}})
        call(token, "PATCH", "/" + release,
             {"release": {"name": release, "rulesetName": ruleset["name"]}})
        print("Published", ruleset["name"])
    else:
        sys.exit("action must be get or publish")


if __name__ == "__main__":
    main()
