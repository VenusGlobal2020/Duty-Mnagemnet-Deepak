import math

EARTH_RADIUS_M = 6371000
ACCURACY_THRESHOLD_M = 50          # drop points with worse than 100m reported accuracy
MAX_SPEED_MPS = 33                  # ~120 km/h ceiling — catches GPS teleport glitches


def haversine_meters(lat1, lng1, lat2, lng2):
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2)
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_ts(value):
    if isinstance(value, (int, float)):
        return float(value) / 1000.0 if value > 1e12 else float(value)
    from datetime import datetime
    v = value.replace("Z", "+00:00") if isinstance(value, str) else value
    return datetime.fromisoformat(v).timestamp()


def clean_track_points(raw_points, previous_last=None):
    stats = {"droppedAccuracy": 0, "droppedJump": 0, "input": len(raw_points)}

    accurate = []
    for p in raw_points:
        acc = p.get("accuracy")
        if acc is not None and acc > ACCURACY_THRESHOLD_M:
            stats["droppedAccuracy"] += 1
            continue
        accurate.append(p)

    accurate.sort(key=lambda p: _parse_ts(p["recordedAt"]))

    cleaned = []
    cursor = previous_last
    for p in accurate:
        if cursor is not None:
            dist = haversine_meters(cursor["lat"], cursor["lng"], p["lat"], p["lng"])
            dt = max(_parse_ts(p["recordedAt"]) - _parse_ts(cursor["recordedAt"]), 0.001)
            implied_speed = dist / dt
            if implied_speed > MAX_SPEED_MPS:
                stats["droppedJump"] += 1
                continue
        cleaned.append(p)
        cursor = p

    stats["output"] = len(cleaned)
    return cleaned, stats