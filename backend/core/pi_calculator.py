import math

PCU_VALUES = {
    # FLEXIBLE
    "two-wheeler":         0.5,
    "motorcycle":          0.5,
    "motorbike":           0.5,
    "scooter":             0.5,
    "bike":                0.5,
    "bicycle":             0.3,
    "cycle":               0.3,
    "auto-rickshaw":       0.8,
    "autorickshaw":        0.8,
    "auto rickshaw":       0.8,
    "auto":                0.8,
    "e-rickshaw":          0.8,
    "erickshaw":           0.8,
    "e rickshaw":          0.8,

    # RIGID
    "car":                 1.0,
    "sedan":               1.0,
    "hatchback":           1.0,
    "suv":                 1.5,
    "van":                 1.5,
    "lcv":                 1.5,
    "light commercial":    1.5,
    "minibus":             2.5,
    "bus":                 3.7,
    "city bus":            3.7,
    "truck":               3.5,
    "lorry":               3.5,
    "heavy vehicle":       3.5,
    "three-wheeler goods": 1.2,
    "tempo":               1.5,
}

FLEXIBLE_CLASSES = [
    "two-wheeler", "motorcycle", "motorbike",
    "scooter", "bike", "bicycle", "cycle",
    "auto-rickshaw", "autorickshaw", "auto",
    "e-rickshaw", "erickshaw", "e rickshaw"
]

def get_pcu(class_name: str) -> float:
    name = class_name.lower().strip()
    for key, val in PCU_VALUES.items():
        if key in name:
            return val
    return 1.0

def is_flexible(class_name: str) -> bool:
    name = class_name.lower().strip()
    return any(f in name for f in FLEXIBLE_CLASSES)

def find_largest_gap(boxes, frame_width, frame_height):
    if not boxes:
        return 0, frame_width, 1.0

    road_top    = int(frame_height * 0.35)
    road_bottom = int(frame_height * 0.85)
    
    occupied_segments = []
    for (x1, y1, x2, y2) in boxes:
        box_center_y = (y1 + y2) / 2
        if road_top <= box_center_y <= road_bottom:
            occupied_segments.append((max(0, x1), min(frame_width, x2)))
            
    if not occupied_segments:
        return 0, frame_width, 1.0
        
    occupied_segments.sort(key=lambda x: x[0])
    merged = [occupied_segments[0]]
    for start, end in occupied_segments[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
            
    gaps = []
    if merged[0][0] > 0:
        gaps.append((0, merged[0][0]))
    for i in range(1, len(merged)):
        gap_start = merged[i-1][1]
        gap_end = merged[i][0]
        if gap_end > gap_start:
            gaps.append((gap_start, gap_end))
    if merged[-1][1] < frame_width:
        gaps.append((merged[-1][1], frame_width))
        
    if not gaps:
        return 0, 0, 0.05
        
    largest_gap = max(gaps, key=lambda g: g[1] - g[0])
    gap_width = largest_gap[1] - largest_gap[0]
    
    AMBULANCE_WIDTH_PX = 50
    if gap_width < AMBULANCE_WIDTH_PX:
        gap_score = 0.05
    else:
        gap_score = min(1.0, gap_width / frame_width)
        
    return largest_gap[0], largest_gap[1], round(gap_score, 3)

def compute_pi(detections: list, boxes: list = None, frame_width: int = 640, frame_height: int = 480) -> dict:
    if not detections:
        return _insufficient("No vehicles detected")

    if len(detections) < 3:
        return _insufficient(f"Only {len(detections)} vehicle(s). Need minimum 3 for reliable PI.")

    flex_pcu = rigid_pcu = 0.0
    flex_count = rigid_count = 0

    for det in detections:
        pcu  = get_pcu(det["class"])
        flex = is_flexible(det["class"])
        if flex:
            flex_pcu   += pcu
            flex_count += 1
        else:
            rigid_pcu   += pcu
            rigid_count += 1

    total_pcu   = flex_pcu + rigid_pcu
    total_count = flex_count + rigid_count

    composition_score = flex_pcu / total_pcu if total_pcu > 0 else 0.0

    gap_start = gap_end = 0
    if boxes is not None and len(boxes) > 0:
        gap_start, gap_end, gap_score = find_largest_gap(boxes, frame_width, frame_height)
    else:
        density = total_count / 30.0
        gap_score = max(0.1, 1.0 - density)

    avg_conf = sum(d.get("confidence", 0.7) for d in detections) / len(detections)
    clearance_score = avg_conf

    raw_pi = (composition_score * 0.4) + (gap_score * 0.5) + (clearance_score * 0.1)

    pi = round(raw_pi * 100, 1)
    pi = max(0.0, min(100.0, pi))

    if pi >= 65:
        tier  = "GREEN"
        emoji = "🟢"
        label = "Ambulance Friendly"
        rec   = "✅ SAFE TO ROUTE"
    elif pi >= 45:
        tier  = "AMBER"
        emoji = "🟡"
        label = "Marginal — Caution"
        rec   = "⚠️ USE WITH CAUTION"
    elif pi >= 25:
        tier  = "RED"
        emoji = "🔴"
        label = "Solid Block — Avoid"
        rec   = "❌ AVOID — find alternate"
    else:
        tier  = "CRITICAL"
        emoji = "🚫"
        label = "Complete Blockage"
        rec   = "🚫 DO NOT ROUTE"

    return {
        "pi":                pi,
        "tier":              tier,
        "tier_emoji":        emoji,
        "tier_label":        label,
        "recommendation":    rec,
        "flexible":          flex_count,
        "rigid":             rigid_count,
        "total":             total_count,
        "composition_score": round(composition_score*100, 1),
        "gap_score":         round(gap_score*100, 1),
        "gap_start":         gap_start,
        "gap_end":           gap_end,
        "clearance_score":   round(clearance_score*100, 1),
    }

def _insufficient(reason: str) -> dict:
    return {
        "pi":             100.0,
        "tier":           "GREEN",
        "tier_emoji":     "🟢",
        "tier_label":     "Clear Road",
        "recommendation": "✅ CLEAR ROUTE - Empty road is fully permeable",
        "flexible":       0,
        "rigid":          0,
        "total":          0,
        "composition_score": 0,
        "gap_score":      100.0,
        "gap_start":      0,
        "gap_end":        0,
        "clearance_score":100.0,
    }
