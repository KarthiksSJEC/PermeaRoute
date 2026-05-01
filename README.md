# 🚑 PermeaRoute AI Traffic Engine

**PermeaRoute** is a real-time computer vision system designed to optimize emergency vehicle (ambulance) routing in dense, unstructured traffic environments like India. 

Unlike traditional GPS systems that rely solely on velocity and congestion density (which treats a road full of yielding bikes the same as a road blocked by buses), PermeaRoute calculates a **Permeability Index (PI)** by categorizing traffic into "Flexible" and "Rigid" vehicles and analyzing physical road gaps.

## 🚀 Features

* **PCU-Weighted Permeability Index:** Weights traffic congestion by Passenger Car Units (PCU). A heavy cluster of yielding two-wheelers results in a high PI (green), while a cluster of buses results in a low PI (red).
* **Spatial Gap Detection:** The algorithm evaluates YOLO bounding boxes to find the largest continuous horizontal gap in the road, drawing a glowing cyan corridor if the ambulance can physically pass.
* **Live WebRTC Edge Simulation:** Run headless! Dispatchers can open multiple browser tabs and stream live YouTube traffic videos via WebRTC screen-capture directly to the AI backend.
* **Multi-Junction Routing:** The system processes multiple video feeds simultaneously over WebSockets to recommend the fastest, most permeable route in real-time.
* **Indian Traffic Specialization:** Powered by a YOLOv11 model fine-tuned on the **UVH-26 Dataset** from IISc Bangalore, allowing it to correctly identify Indian-specific vehicles like Auto-Rickshaws, Tempos, and E-Rickshaws.

## 🛠️ Tech Stack

* **Backend:** Python, FastAPI, WebSockets, Uvicorn
* **AI & Vision:** Ultralytics YOLOv11, OpenCV, NumPy
* **Frontend:** React.js, Vite, Recharts, Leaflet Maps
* **Architecture:** Edge-browser capture via `getDisplayMedia` to a centralized inference server.

## 💻 Running the Project Locally

### 1. Setup the Backend (AI Inference Server)
You must have the `uvh26.pt` model weights placed in the `backend/` or `backend/models/` directory for the system to boot up.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Setup the Frontend (Dispatcher Dashboard)
In a separate terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to view the dispatcher dashboard.

## 🚦 How to Demo the Simulation
1. Open the **Route Planner** on the dashboard.
2. Enter a Start Point and Destination, then click "Generate Routes".
3. Open 3 new browser tabs and navigate each to the **Live Stream** page.
4. On a separate screen, play 3 different YouTube drone traffic videos representing different junctions.
5. In each Live Stream tab, click "Share Tab & Capture" and select one of the YouTube videos.
6. The AI will analyze the traffic for 30 seconds, calculate the gaps, and the Planner will announce the **Winning Route** across all tabs automatically.


