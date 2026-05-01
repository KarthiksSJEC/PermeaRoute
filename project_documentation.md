# PermeaRoute AI Traffic Engine: Technical Documentation

## 1. Prototype & Simulation Overview

**The Concept:** 
PermeaRoute is a real-time computer vision system designed to optimize emergency vehicle (ambulance) routing in dense, unstructured traffic environments like India. Unlike traditional GPS systems that rely solely on velocity and congestion density, PermeaRoute calculates a **Permeability Index (PI)** by categorizing traffic into "Flexible" (bikes, auto-rickshaws) and "Rigid" (buses, trucks, cars) vehicles. A high density of flexible vehicles means an ambulance can still "permeate" through the traffic, whereas rigid vehicles cause hard gridlocks.

**The Simulation Prototype:**
To demonstrate this in a live hackathon environment without direct access to secured municipal RTSP traffic cameras, we built a highly robust multi-feed simulation environment. The prototype allows a dispatcher to input a start and destination point. The system generates three possible routes, and the dispatcher opens three separate browser tabs playing live traffic videos (e.g., from YouTube) representing key junctions on those routes. The system ingests all three video streams simultaneously, analyzes the traffic, and dynamically recommends the fastest viable route in real-time.

### Materials and Software Stack
*   **Deep Learning & Vision:** YOLOv11 nano/small architectures, fine-tuned on the **UVH-26 Dataset** (Indian Institute of Science) specifically designed for 14 Indian vehicle categories (e.g., auto-rickshaws, tempos). OpenCV for image manipulation.
*   **Backend Server:** Python, FastAPI, WebSockets (for ultra-low latency bi-directional streaming), Uvicorn.
*   **Frontend Dashboard:** React, Vite, Vanilla CSS (Premium Dark Mode Glassmorphism).
*   **Data Visualization & Mapping:** Recharts (live telemetry graphing), React-Leaflet & OpenStreetMap Nominatim API (geocoding and mapping).
*   **Stream Ingestion:** Native Browser WebRTC API (`navigator.mediaDevices.getDisplayMedia`).

---

## 2. Implementation Approach

Our implementation followed a modular, distributed edge-simulation approach:

1.  **AI Classification Engine:** We integrated the UVH-26 fine-tuned weights to accurately identify Indian traffic modalities. We mapped the 14 classes into two binary categories:
    *   *Rigid Vehicles:* Cars, SUVs, Buses, LCVs, Trucks.
    *   *Flexible Vehicles:* Two-wheelers, Auto-rickshaws, Bicycles.
2.  **Permeability Index (PI) Algorithm:** We implemented a mathematical model to calculate the PI score. The formula heavily penalizes rigid vehicles and rewards flexible vehicles, calculating a final percentage score indicating how easily an ambulance can part the traffic.
3.  **Distributed Feed Ingestion:** Instead of building a heavy, centralized video processing pipeline, we pushed the feed ingestion to the "edge" (the user's browser). Using WebRTC, each browser tab captures the local screen, converts the frames to Base64, and streams them over WebSockets to the FastAPI backend at 5 FPS.
4.  **Deterministic Routing Logic:** We implemented a route selection algorithm that polls the live PI scores every 30 seconds. To ensure high reliability during life-or-death dispatch scenarios, the logic is deterministic: any route with a PI below 40% is immediately marked as **Blocked**. The system then selects the shortest geographic route among the remaining eligible candidates.

---

## 3. Testing Approach & Parameters Evaluated

We conducted comprehensive end-to-end testing of the dispatcher simulation flow. 

**Testing Methodology:**
We utilized a multi-tab simulation test. Three browser tabs were opened, each streaming a different Indian traffic scenario (e.g., a heavy gridlock, a fluid two-wheeler dense road, and an empty road). 

**Parameters Evaluated:**
*   **Inference Latency & FPS:** The time taken from frame capture on the client, transmission, YOLO inference on the server, and return transmission.
*   **PI Accuracy & Stability:** Verification that the Permeability Index correctly reflected the visual state of the traffic, and did not fluctuate wildly frame-by-frame.
*   **Concurrent Feed Stability:** The backend's ability to maintain state across multiple simultaneous WebSocket connections without dropping frames or crossing data streams.
*   **Routing Determinism:** Ensuring the route planner accurately eliminated routes dropping below the 40% PI threshold.

---

## 4. Test Results 

*   **Latency & Performance:** The system successfully maintained a steady 5 FPS processing cap per feed across multiple parallel feeds. End-to-end latency remained under 500ms, ensuring real-time dashboard responsiveness.
*   **Algorithm Stability:** Raw PI scores fluctuated too aggressively. We successfully resolved this by implementing a temporal smoothing algorithm (`collections.deque` with a 30-frame moving average buffer) on the backend, resulting in a highly stable, readable UI graph.
*   **Model Efficacy:** The UVH-26 model demonstrated excellent accuracy on Indian specific modalities. Auto-rickshaws and dense clusters of two-wheelers were identified with high confidence, proving the core thesis of the project.
*   **Routing Verification:** The planner reliably re-computed the "Recommended Route" every 30 seconds, successfully avoiding gridlocked junctions in our simulated tests.

---

## 5. User Feedback & Iterative Improvements

Throughout the development cycle, significant architectural pivots were made based on testing feedback:

**Improvement 1: The Headless Server Problem**
*   *Feedback/Issue:* Initial testing utilized the `mss` Python library for server-side screen capturing. However, when deployed to a headless cloud AI server (without a physical monitor), the capture failed via `XGetImage` errors, rendering the system untestable.
*   *Improvement Made:* We completely re-architected the ingestion pipeline. We shifted from server-side capturing to client-side WebRTC capturing (`getDisplayMedia`). This allowed the system to capture video directly from the user's local browser tabs and stream it to the remote server, making the application infinitely more scalable and universally deployable.

**Improvement 2: Route Scoring Predictability**
*   *Feedback/Issue:* The initial route planner utilized a complex weighted score combining distance, PI, and data freshness. During testing, this resulted in fragile and unpredictable route recommendations that were difficult to explain to a dispatcher.
*   *Improvement Made:* We stripped out the weighted algorithm and implemented a strict, deterministic filter: **PI < 40% = Blocked**. The winner is the shortest remaining route. This change drastically improved the reliability of the system and made the UI much more intuitive for emergency dispatchers to trust.
