from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from uuid import uuid4
import asyncio
import time
from collections import deque
from fastapi.middleware.cors import CORSMiddleware
from core.detector import detect_image
import cv2
import numpy as np
import base64

app = FastAPI(title="PermeaRoute API")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "PermeaRoute API is running"}


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_feed_housekeeping_loop())


# Simple in-memory feed registry for browser-capture feeds
class FeedCreate(BaseModel):
    name: str
    route_id: str | None = None
    route_name: str | None = None
    sampling_junction: str | None = None
    start_name: str | None = None
    destination_name: str | None = None

# FEEDS structure:
# { feed_id: {id, name, active, latest_pi, last_seen_ts, latest_image, clients:set(), buffer: deque }}
FEEDS = {}
FEED_STALE_SECONDS = 30
FEED_PURGE_SECONDS = 300


def _feed_snapshot(feed_id, data):
    return {
        "id": feed_id,
        "name": data.get("name"),
        "route_id": data.get("route_id"),
        "route_name": data.get("route_name"),
        "sampling_junction": data.get("sampling_junction"),
        "start_name": data.get("start_name"),
        "destination_name": data.get("destination_name"),
        "active": data.get("active", False),
        "latest_pi": data.get("latest_pi"),
        "last_seen_ts": data.get("last_seen_ts"),
        "latest_image": data.get("latest_image"),
        "client_count": len(data.get("clients", set())),
    }


def _mark_feed_state():
    now = time.time()
    stale_feed_ids = []

    for feed_id, data in FEEDS.items():
        last_seen = data.get("last_seen_ts")
        if last_seen is None:
            continue

        age = now - last_seen
        if age > FEED_STALE_SECONDS:
            data["active"] = False

        if age > FEED_PURGE_SECONDS and not data.get("clients"):
            stale_feed_ids.append(feed_id)

    for feed_id in stale_feed_ids:
        FEEDS.pop(feed_id, None)


async def _feed_housekeeping_loop():
    while True:
        _mark_feed_state()
        await asyncio.sleep(5)


@app.post("/feeds")
def create_feed(payload: FeedCreate):
    feed_id = str(uuid4())
    FEEDS[feed_id] = {
        "id": feed_id,
        "name": payload.name,
        "route_id": payload.route_id,
        "route_name": payload.route_name,
        "sampling_junction": payload.sampling_junction,
        "start_name": payload.start_name,
        "destination_name": payload.destination_name,
        "active": True,
        "latest_pi": None,
        "last_seen_ts": None,
        "latest_image": None,
        "clients": set(),
        "buffer": deque(maxlen=30)
    }
    return {"feed_id": feed_id}


@app.get("/feeds")
def list_feeds():
    _mark_feed_state()
    result = []
    for fid, data in FEEDS.items():
        result.append(_feed_snapshot(fid, data))
    return result


@app.get("/feeds/{feed_id}")
def get_feed(feed_id: str):
    _mark_feed_state()
    if feed_id not in FEEDS:
        return {"error": "Feed not found"}
    return _feed_snapshot(feed_id, FEEDS[feed_id])

@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...), confidence: float = Form(0.35)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    annotated, detections, pi_result = detect_image(img, confidence_threshold=confidence)
    
    _, buffer = cv2.imencode('.jpg', annotated)
    b64_img = base64.b64encode(buffer).decode('utf-8')
    
    return {
        "image": f"data:image/jpeg;base64,{b64_img}",
        "pi_result": pi_result,
        "detections": detections
    }

@app.websocket("/stream/screen")
async def stream_screen(websocket: WebSocket):
    await websocket.accept()
    
    # Temporal smoothing buffer for this connection
    pi_history = deque(maxlen=30)
    flex_history = deque(maxlen=30)
    rigid_history = deque(maxlen=30)
    
    try:
        while True:
            # Receive frame from client (base64)
            data = await websocket.receive_text()
            
            # Extract base64 image data (removing data:image/jpeg;base64, prefix if present)
            if "," in data:
                b64_data = data.split(",")[1]
            else:
                b64_data = data
                
            img_bytes = base64.b64decode(b64_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                await websocket.send_json({"error": "Failed to decode image"})
                continue
                
            # Resize for performance if needed
            img = cv2.resize(img, (640, 480))
            
            # Detect
            try:
                annotated, detections, pi_result = detect_image(img)
            except FileNotFoundError as fnf_err:
                await websocket.send_json({"error": str(fnf_err)})
                continue
            except Exception as det_err:
                await websocket.send_json({"error": f"Detection failed: {str(det_err)}"})
                continue
            
            # Apply Temporal Smoothing
            if pi_result.get("pi") is not None:
                pi_history.append(pi_result["pi"])
                flex_history.append(pi_result["flexible"])
                rigid_history.append(pi_result["rigid"])
                
                smoothed_pi = sum(pi_history) / len(pi_history)
                smoothed_flex = sum(flex_history) / len(flex_history)
                smoothed_rigid = sum(rigid_history) / len(rigid_history)
                
                pi_result["smoothed_pi"] = round(smoothed_pi, 1)
                pi_result["smoothed_flexible"] = round(smoothed_flex, 1)
                pi_result["smoothed_rigid"] = round(smoothed_rigid, 1)
            else:
                pi_result["smoothed_pi"] = None
                
            # Encode annotated image to JPEG
            _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            out_b64 = base64.b64encode(buffer).decode('utf-8')
            
            payload = {
                "image": f"data:image/jpeg;base64,{out_b64}",
                "pi_result": pi_result,
                "detections_count": len(detections)
            }
            
            await websocket.send_json(payload)
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Websocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
            await websocket.close()
        except:
            pass


@app.websocket("/stream/{feed_id}")
async def stream_feed(websocket: WebSocket, feed_id: str):
    # Parameterized feed stream. Clients must register a feed via POST /feeds first.
    if feed_id not in FEEDS:
        await websocket.accept()
        await websocket.send_json({"error": f"Feed '{feed_id}' not found. Register via POST /feeds."})
        await websocket.close()
        return

    feed = FEEDS[feed_id]
    await websocket.accept()
    feed["clients"].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()

            # Extract base64 image data
            if "," in data:
                b64_data = data.split(",")[1]
            else:
                b64_data = data

            import base64
            import numpy as np
            import cv2

            try:
                img_bytes = base64.b64decode(b64_data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                await websocket.send_json({"error": f"Failed to decode image: {str(e)}"})
                continue

            if img is None:
                await websocket.send_json({"error": "Failed to decode image"})
                continue

            # Run detection (synchronous call to existing detector)
            try:
                annotated, detections, pi_result = detect_image(img)
            except Exception as det_err:
                await websocket.send_json({"error": f"Detection failed: {str(det_err)}"})
                continue

            # Encode annotated image to JPEG for dashboard tiles and tab previews
            _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            out_b64 = base64.b64encode(buffer).decode('utf-8')

            # Update feed state
            feed["latest_pi"] = pi_result
            feed["last_seen_ts"] = time.time()
            feed["active"] = True
            feed["buffer"].append(pi_result.get("pi"))
            feed["latest_image"] = f"data:image/jpeg;base64,{out_b64}"

            # Broadcast to all connected clients for this feed
            payload = {
                "feed_id": feed_id,
                "feed_name": feed.get("name"),
                "image": feed["latest_image"],
                "pi_result": pi_result,
                "detections_count": len(detections),
                "active": True
            }

            to_remove = []
            for client in list(feed["clients"]):
                try:
                    await client.send_json(payload)
                except Exception:
                    to_remove.append(client)

            for c in to_remove:
                feed["clients"].discard(c)

    except WebSocketDisconnect:
        print(f"Client disconnected from feed {feed_id}")
        feed["clients"].discard(websocket)
    except Exception as e:
        print(f"Websocket error (feed {feed_id}): {e}")
        try:
            await websocket.send_json({"error": str(e)})
            await websocket.close()
        except:
            pass
