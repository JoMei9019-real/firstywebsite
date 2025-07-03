# backend/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os

app = FastAPI()

# MongoDB setup
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client["firstybot"]
verifications = db["verifications"]

# Simple token auth
API_TOKEN = os.getenv("API_TOKEN") or "changeme"

def auth_header(token: str):
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/verify/{username}")
async def get_user_iccid(username: str, token: str = Depends(auth_header)):
    entry = await verifications.find_one({"username": username.lower()})
    if not entry:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": entry["username"],
        "esim_number": entry["esim_number"],
        "timestamp": entry["timestamp"]
    }
