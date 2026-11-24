import csv
import io
import json
from datetime import datetime, timezone

from app.schemas.location import LocationCreate


MAX_IMPORT_POINTS = 10_000


def parse_location_file(filename: str, content: bytes) -> list[LocationCreate]:
    """Parse a CSV or JSON file containing timestamped GPS points."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("UTF-8 인코딩 파일만 가져올 수 있습니다.") from exc

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension == "csv":
        rows = list(csv.DictReader(io.StringIO(text)))
    elif extension == "json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("JSON 파일 형식이 올바르지 않습니다.") from exc
        rows = payload.get("locations") if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise ValueError("JSON 파일은 위치 배열 또는 locations 배열을 포함해야 합니다.")
    else:
        raise ValueError("CSV 또는 JSON 파일을 선택해 주세요.")

    if not rows:
        raise ValueError("파일에 위치 기록이 없습니다.")
    if len(rows) > MAX_IMPORT_POINTS:
        raise ValueError(f"한 번에 최대 {MAX_IMPORT_POINTS:,}개 위치까지 가져올 수 있습니다.")

    points = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"{index}번째 위치 기록이 객체가 아닙니다.")
        try:
            latitude = row.get("latitude", row.get("lat"))
            longitude = row.get("longitude", row.get("lng", row.get("lon")))
            if latitude is None and row.get("latitudeE7") is not None:
                latitude = int(row["latitudeE7"]) / 10_000_000
            if longitude is None and row.get("longitudeE7") is not None:
                longitude = int(row["longitudeE7"]) / 10_000_000
            timestamp = row.get("recorded_at", row.get("timestamp", row.get("time")))
            if timestamp is None and row.get("timestampMs") is not None:
                timestamp = datetime.fromtimestamp(int(row["timestampMs"]) / 1000, tz=timezone.utc)
            elif isinstance(timestamp, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
            elif isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            point = LocationCreate(
                latitude=latitude,
                longitude=longitude,
                accuracy=row.get("accuracy"),
                recorded_at=timestamp,
            )
            if point.recorded_at.tzinfo is None:
                raise ValueError("시간대가 포함된 시각이어야 합니다.")
            points.append(point)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{index}번째 위치 기록을 읽을 수 없습니다: {exc}") from exc

    return points
