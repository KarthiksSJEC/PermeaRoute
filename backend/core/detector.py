import cv2
import numpy as np
from ultralytics import YOLO
from pathlib import Path
from .classifier import classify, get_emoji
from .pi_calculator import compute_pi

# Global model instance to avoid reloading on every request
_model = None

def load_model():
    global _model
    if _model is None:
        backend_root = Path(__file__).resolve().parent.parent
        candidate_paths = [
            backend_root / "uvh26.pt",
            backend_root / "models" / "uvh26.pt",
            backend_root / "models" / "best.pt",
        ]

        target_model = next((path for path in candidate_paths if path.exists()), None)
        if target_model is None:
            searched_paths = "', '".join(str(path) for path in candidate_paths)
            raise FileNotFoundError(
                f"UVH-26 model not found. Searched: '{searched_paths}'"
            )

        try:
            print(f"Loading custom Indian Traffic model from: {target_model}")
            _model = YOLO(target_model)
        except Exception as e:
            print(f"Error loading custom YOLO model: {e}")
            _model = None
    return _model

def detect_image(image_input, confidence_threshold=0.35):
    """
    image_input: numpy array representing BGR image
    Returns: annotated image, detection data, PI result
    """
    model = load_model()

    if image_input is None or image_input.size == 0:
        return None, [], {"error": "Invalid image"}

    # Run inference
    results = model(image_input, verbose=False)

    flexible = 0
    rigid = 0
    unknown = 0
    detections = []

    annotated = image_input.copy()
    
    # YOLO returns a list of Results objects
    for result in results:
        for box in result.boxes:
            conf = float(box.conf)
            if conf < confidence_threshold:
                continue

            cls_id = int(box.cls)
            cls_name = model.names[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            category = classify(cls_name)
            emoji = get_emoji(cls_name)

            # Color: green=flexible, red=rigid, grey=unknown
            if category == "flexible":
                color = (0, 220, 0)
                flexible += 1
            elif category == "rigid":
                color = (0, 0, 220)
                rigid += 1
            else:
                color = (150, 150, 150)
                unknown += 1

            # Skip emergency vehicles if we want to exclude them from count
            # if cls_name in ["ambulance", "fire engine"]:
            #     continue

            # Draw bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Label (OpenCV putText does not support emojis, so we omit it here)
            label = f"{cls_name} {conf:.2f}"
            cv2.putText(
                annotated, label,
                (x1, max(y1 - 8, 12)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5, color, 2
            )

            detections.append({
                "class": cls_name,
                "emoji": emoji,
                "category": category,
                "confidence": round(conf, 2),
                "bbox": [x1, y1, x2, y2]
            })

    boxes = [d["bbox"] for d in detections]
    h, w = image_input.shape[:2]
    pi_result = compute_pi(detections, boxes=boxes, frame_width=w, frame_height=h)

    # Draw Gap Overlay
    gap_start = pi_result.get("gap_start", 0)
    gap_end = pi_result.get("gap_end", 0)
    gap_score = pi_result.get("gap_score", 0)

    if gap_end > gap_start:
        road_top = int(h * 0.35)
        road_bottom = int(h * 0.85)
        
        # Draw road zone boundary
        cv2.rectangle(
            annotated,
            (0, road_top),
            (w, road_bottom),
            (255, 255, 0), 1
        )
        
        # Draw cyan open corridor
        cv2.rectangle(
            annotated,
            (int(gap_start), road_top),
            (int(gap_end), road_bottom),
            (255, 255, 0), 2
        )
        cv2.putText(
            annotated,
            f"GAP: {gap_score}%",
            (int(gap_start) + 5, road_top + 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6, (255, 255, 0), 2
        )

    return annotated, detections, pi_result
