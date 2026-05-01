# Rigid vs Flexible lookup — core of PI formula

FLEXIBLE = [
    "two-wheeler", "two wheeler", "twowheeler",
    "motorcycle", "motorbike", "scooter", "bike",
    "bicycle", "cycle",
    "auto-rickshaw", "autorickshaw", "auto rickshaw",
    "auto", "rickshaw",
    "e-rickshaw", "erickshaw", "e rickshaw",
    "electric rickshaw", "toto",
    "three-wheeler", "three wheeler", "threewheeler"
]

RIGID = [
    "car", "sedan", "hatchback", "suv",
    "muv", "bus", "minibus", "mini-bus", "city bus",
    "truck", "lorry", "heavy vehicle",
    "lcv", "light commercial vehicle",
    "van", "tempo", "tempo-traveller", "tempo traveller", "traveller", "mini truck",
    "three-wheeler goods", "goods vehicle"
]

def classify(class_name: str) -> str:
    name = class_name.lower().strip()
    for f in FLEXIBLE:
        if f in name:
            return "flexible"
    for r in RIGID:
        if r in name:
            return "rigid"
    return "unknown"

def get_emoji(class_name: str) -> str:
    name = class_name.lower()
    if any(x in name for x in ["two", "motor", "bike", "scooter"]):
        return "🏍️"
    if any(x in name for x in ["auto", "rickshaw"]):
        return "🛺"
    if "cycle" in name or "bicycle" in name:
        return "🚲"
    if "bus" in name:
        return "🚌"
    if "truck" in name or "lorry" in name:
        return "🚛"
    if "car" in name:
        return "🚗"
    if "lcv" in name or "van" in name:
        return "🚐"
    return "🚘"
