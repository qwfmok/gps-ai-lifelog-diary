from math import atan2, cos, radians, sin, sqrt
from datetime import datetime

def distance_meters(
    latitude1: float,
    longitude1: float,
    latitude2: float,
    longitude2: float,
) -> float:
    earth_radius = 6_371_000

    lat1 = radians(latitude1)
    lat2 = radians(latitude2)
    delta_lat = radians(latitude2 - latitude1)
    delta_lon = radians(longitude2 - longitude1)

    a = (
        sin(delta_lat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    )
    a = min(1.0, max(0.0, a))

    return earth_radius * 2 * atan2(sqrt(a), sqrt(1 - a))

def detect_stay_points(
    locations: list[dict],
    radius_meters: float = 100,
    min_duration_minutes: float = 15,
    max_gap_minutes: float = 5,
) -> list[dict]:
    if not locations:
        return []

    points = []

    for location in locations:
        point = dict(location)
        recorded_at = point["recorded_at"]

        if isinstance(recorded_at, str):
            recorded_at = datetime.fromisoformat(
                recorded_at.replace("Z", "+00:00")
            )

        if recorded_at.tzinfo is None:
            raise ValueError("recorded_at에는 시간대가 필요합니다.")

        point["recorded_at"] = recorded_at
        points.append(point)

    points.sort(key=lambda point: point["recorded_at"])

    stays = []

    def add_stay(group):
        start = group[0]["recorded_at"]
        end = group[-1]["recorded_at"]
        duration_minutes = (end - start).total_seconds() / 60

        if len(group) < 2 or duration_minutes < min_duration_minutes:
            return

        stays.append({
            "latitude": sum(p["latitude"] for p in group) / len(group),
            "longitude": sum(p["longitude"] for p in group) / len(group),
            "started_at": start.isoformat(),
            "ended_at": end.isoformat(),
            "duration_minutes": duration_minutes,
            "point_count": len(group),
        })

    group = [points[0]]

    for point in points[1:]:
        anchor = group[0]
        gap_minutes = (
            point["recorded_at"] - group[-1]["recorded_at"]
        ).total_seconds() / 60

        distance = distance_meters(
            anchor["latitude"],
            anchor["longitude"],
            point["latitude"],
            point["longitude"],
        )

        if distance <= radius_meters and gap_minutes <= max_gap_minutes:
            group.append(point)
        else:
            add_stay(group)
            group = [point]

    add_stay(group)

    return stays