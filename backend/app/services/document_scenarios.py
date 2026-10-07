"""Explicitly fictional, versioned documents for reproducible local demos."""

import copy
import hashlib
import json


def scenarios():
    definitions = [
        ("registration", "Event registration", "What is the registration deadline?", "registration deadline",
         "Registration for the fictional Campus Buildathon closes on 18 November at 18:00 IST.",
         "Registration for the fictional Campus Buildathon closes on 12 November at 12:00 IST."),
        ("eligibility", "Team eligibility", "What is the team eligibility rule?", "team eligibility",
         "Campus Buildathon teams must have 2 to 4 currently enrolled college students.",
         "Campus Buildathon teams must have exactly 3 final-year students."),
        ("submission", "Submission requirements", "What are the submission requirements?", "submission requirements",
         "Submit a public repository link, a 3-minute demo video, and a README by 20 November at 20:00 IST.",
         "Submit only a slide deck by 19 November at 17:00 IST."),
    ]
    result = []
    for key, title, question, topic, current, archived in definitions:
        current_id = f"{key}-current"
        result.append({"id": key, "name": title, "dataSource": "fictional-demo",
                       "question": question, "expectedAnswer": current, "expectedCitation": current_id,
                       "documents": [
                           {"documentId": f"{key}-archived", "title": f"Archived {title.lower()}",
                            "topic": topic, "text": archived, "current": False},
                           {"documentId": current_id, "title": f"Current {title.lower()}",
                            "topic": topic, "text": current, "current": True},
                           {"documentId": f"{key}-notice", "title": "Library maintenance notice",
                            "topic": "library maintenance", "text": "The fictional campus library is closed on Sunday for maintenance.",
                            "current": True}]})
    return copy.deepcopy(result)


def scenario_fingerprint():
    encoded = json.dumps(scenarios(), sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
