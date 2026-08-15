"""
Seeds a RUNNING backend (default http://localhost:8000) with:
  - one doctor account, one health_worker account
  - a handful of fake patients
  - a mix of good / blurry / dark / bad-framing capture images per patient,
    run through the real pipeline (Member B stub -> Member C stub, or the
    real modules if you've installed them)

This is for manually poking at the doctor dashboard at /dashboard - it is
NOT the same as the automated pytest suite in tests/, which is what you
should actually rely on to say "my code is correct".

Usage:
    # 1. start the server in one terminal:
    uvicorn app.main:app --reload

    # 2. in another terminal:
    python3 scripts/seed_fake_data.py

Then open http://localhost:8000/dashboard and log in as:
    username: doctor1   password: doctor12345
"""
import base64
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "tests"))

from fake_image_utils import (  # noqa: E402
    good_mucosa_image_bytes, blurry_mucosa_image_bytes,
    dark_mucosa_image_bytes, bad_framing_image_bytes,
)

BASE_URL = "http://localhost:8000"

DOCTOR = {"username": "doctor1", "password": "doctor12345", "role": "doctor", "full_name": "Dr. A. Rao"}
HEALTH_WORKER = {"username": "asha1", "password": "asha12345", "role": "health_worker", "full_name": "Priya (ASHA worker)"}

FAKE_PATIENTS = [
    {"name": "Ramesh Kumar", "age": 52, "sex": "M", "village_or_facility": "Barwani PHC"},
    {"name": "Sunita Devi", "age": 46, "sex": "F", "village_or_facility": "Barwani PHC"},
    {"name": "Ajay Yadav", "age": 61, "sex": "M", "village_or_facility": "Sendhwa PHC"},
    {"name": "Geeta Bai", "age": 39, "sex": "F", "village_or_facility": "Sendhwa PHC"},
]

IMAGE_MIX = [good_mucosa_image_bytes, good_mucosa_image_bytes, blurry_mucosa_image_bytes,
             dark_mucosa_image_bytes, bad_framing_image_bytes, good_mucosa_image_bytes]


def register_and_login(user):
    requests.post(f"{BASE_URL}/auth/register", json=user)  # ignore 400 "already exists" on reruns
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": user["username"], "password": user["password"]})
    res.raise_for_status()
    return res.json()["access_token"]


def main():
    try:
        requests.get(f"{BASE_URL}/health", timeout=2)
    except requests.exceptions.ConnectionError:
        print(f"Could not reach {BASE_URL}. Start the server first: uvicorn app.main:app --reload")
        sys.exit(1)

    print("Creating accounts...")
    register_and_login(DOCTOR)
    hw_token = register_and_login(HEALTH_WORKER)
    headers = {"Authorization": f"Bearer {hw_token}"}

    print("Creating fake patients + cases...")
    for i, patient_payload in enumerate(FAKE_PATIENTS):
        res = requests.post(f"{BASE_URL}/patients", json=patient_payload, headers=headers)
        res.raise_for_status()
        patient_id = res.json()["id"]
        print(f"  Patient: {patient_payload['name']} ({patient_id})")

        # give each patient 1-2 captures with a mix of quality outcomes
        n_cases = 2 if i % 2 == 0 else 1
        for j in range(n_cases):
            img_fn = IMAGE_MIX[(i + j) % len(IMAGE_MIX)]
            files = {"file": ("capture.jpg", img_fn(), "image/jpeg")}
            data = {"patient_id": patient_id}
            case_res = requests.post(f"{BASE_URL}/cases", data=data, files=files, headers=headers)
            case_res.raise_for_status()
            case = case_res.json()
            print(f"    Case {case['id'][:8]}: status={case['status']}"
                  + (f" risk={case['risk_assessment']['risk_category']}" if case.get("risk_assessment") else ""))

    print("\nDone. Log into the dashboard at "
          f"{BASE_URL}/dashboard as username='{DOCTOR['username']}' password='{DOCTOR['password']}'")


if __name__ == "__main__":
    main()
