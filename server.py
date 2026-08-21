"""
Mahindra UDO EV Companion & Admin Portal Web Server
"""

import os
import shutil
import json
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header, Depends, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Auto-Fix for flattened GitHub web uploads (static-index.html -> static/index.html)
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

for filename in os.listdir(BASE_DIR):
    if filename.startswith("static-"):
        real_name = filename.replace("static-", "", 1)
        src_path = os.path.join(BASE_DIR, filename)
        dst_path = os.path.join(STATIC_DIR, real_name)
        try:
            shutil.move(src_path, dst_path)
            print(f"Auto-fixed static file: {filename} -> static/{real_name}")
        except Exception as e:
            print("Auto-fix move error:", e)

app = FastAPI(title="Mahindra UDO EV Companion Server", version="2.0.0")
DATA_FILE = os.path.join(BASE_DIR, "facts.json")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mahindra2026")

DEFAULT_FACTS = [
    "Did you know Mahindra Last Mile Mobility has been the No.1 Commercial Electric Vehicle company for 4 years",
    "Customers have collectively covered 9 billion e kms. Equal to going to the moon and coming back 12 times",
    "Mahindra Last Mile Mobility is the 1st company to cross the 4 lakh milestone. This is also including passenger vehicle segment",
    "With the number of kms driven we have saved CO2 equivalent of planting 83 lakh trees"
]

active_heartbeats = {}
current_broadcast = {"message": "", "timestamp": 0, "duration_ms": 6000}


def load_facts() -> List[str]:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            print("Error loading facts.json:", e)
    return DEFAULT_FACTS.copy()


def save_facts(facts: List[str]):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(facts, f, indent=2)
    except Exception as e:
        print("Error saving facts.json:", e)


facts_store = load_facts()


class FactModel(BaseModel):
    fact: str

class BroadcastModel(BaseModel):
    message: str
    duration_ms: Optional[int] = 6000

class HeartbeatModel(BaseModel):
    username: Optional[str] = "Employee"
    device: Optional[str] = "Web Client"


@app.get("/")
def get_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Mahindra UDO EV Web Companion Server Active!"})


@app.get("/admin")
def get_admin():
    admin_path = os.path.join(STATIC_DIR, "admin.html")
    if os.path.exists(admin_path):
        return FileResponse(admin_path)
    return JSONResponse({"message": "Admin Portal UI missing."})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/api/facts")
def get_all_facts():
    return {"facts": facts_store}


@app.get("/api/broadcast")
def get_broadcast():
    if time.time() - current_broadcast["timestamp"] < 30:
        return current_broadcast
    return {"message": "", "timestamp": 0}


@app.post("/api/heartbeat")
def post_heartbeat(hb: HeartbeatModel = Body(...), x_forwarded_for: Optional[str] = Header(None)):
    client_ip = x_forwarded_for or "10.2.93.227"
    active_heartbeats[client_ip] = time.time()
    return {"status": "ok", "active_clients": len(get_active_clients_count())}


def get_active_clients_count() -> List[str]:
    now = time.time()
    return [ip for ip, ts in active_heartbeats.items() if now - ts < 60]


@app.get("/api/status")
def get_status():
    active_count = len(get_active_clients_count())
    return {
        "status": "online",
        "app_name": "Mahindra UDO EV Companion Server",
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_facts": len(facts_store),
        "active_connected_users": max(1, active_count),
        "corporate_domain": "corp.mahindra.com"
    }


def verify_admin(x_admin_key: Optional[str] = Header(None)):
    if x_admin_key != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Password")
    return True


@app.post("/api/admin/facts", dependencies=[Depends(verify_admin)])
def add_fact(model: FactModel):
    fact_text = model.fact.strip()
    if not fact_text:
        raise HTTPException(status_code=400, detail="Fact text cannot be empty")
    facts_store.append(fact_text)
    save_facts(facts_store)
    return {"status": "success", "facts": facts_store}


@app.delete("/api/admin/facts/{fact_idx}", dependencies=[Depends(verify_admin)])
def delete_fact(fact_idx: int):
    if fact_idx < 0 or fact_idx >= len(facts_store):
        raise HTTPException(status_code=404, detail="Fact index out of bounds")
    removed = facts_store.pop(fact_idx)
    save_facts(facts_store)
    return {"status": "success", "removed": removed, "facts": facts_store}


@app.post("/api/admin/broadcast", dependencies=[Depends(verify_admin)])
def send_broadcast(model: BroadcastModel):
    global current_broadcast
    msg = model.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Broadcast message cannot be empty")
    current_broadcast = {
        "message": msg,
        "timestamp": time.time(),
        "duration_ms": model.duration_ms or 6000
    }
    return {"status": "success", "broadcast": current_broadcast}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
