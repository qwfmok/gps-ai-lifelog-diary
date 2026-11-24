import csv
import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from app.schemas.location import LocationCreate


MAX_IMPORT_POINTS = 10_000
MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
GEO_COORDINATES = re.compile(r"geo:([+-]?[\d.]+),([+-]?[\d.]+)")


@dataclass(frozen=True)
class ImportedVisit:
    latitude: float
    longitude: float
    started_at: datetime
    ended_at: datetime
    source_place_name: str | None = None


@dataclass(frozen=True)
class ParsedLocationFile:
    points: list[LocationCreate]
    visits: list[ImportedVisit]


def parse_location_file(filename: str, content: bytes) -> ParsedLocationFile:
    """Read timestamped points and visit segments from CSV or JSON exports."""
    if len(content) > MAX_IMPORT_FILE_BYTES:
        raise ValueError("파일은 10 MiB 이하여야 합니다.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("UTF-8 인코딩 파일만 가져올 수 있습니다.") from exc

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension == "csv":
        rows = list(csv.DictReader(io.StringIO(text)))
        points = [_parse_point(row, index) for index, row in enumerate(rows, start=1)]
        result = ParsedLocationFile(points=points, visits=[])
    elif extension == "json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("JSON 파일 형식이 올바르지 않습니다.") from exc
        if isinstance(payload, list):
            rows = payload
            semantic_segments = []
            legacy_segments = []
        elif isinstance(payload, dict):
            rows = payload.get("locations", [])
            semantic_segments = payload.get("semanticSegments", [])
            legacy_segments = payload.get("timelineObjects", [])
            if not any((rows, semantic_segments, legacy_segments)):
                raise ValueError("JSON에서 locations 또는 Timeline 방문 구간을 찾지 못했습니다.")
        else:
            raise ValueError("JSON은 위치 배열 또는 Timeline 내보내기 객체여야 합니다.")

        if not all(isinstance(items, list) for items in (rows, semantic_segments, legacy_segments)):
            raise ValueError("JSON 위치와 방문 구간은 배열이어야 합니다.")
        if len(rows) > MAX_IMPORT_POINTS:
            raise ValueError(f"한 번에 최대 {MAX_IMPORT_POINTS:,}개 위치까지 가져올 수 있습니다.")
        points = [_parse_point(row, index) for index, row in enumerate(rows, start=1)]
        visits = _parse_semantic_segments(semantic_segments)
        visits.extend(_parse_legacy_segments(legacy_segments))
        if len(visits) > MAX_IMPORT_POINTS:
            raise ValueError(f"한 번에 최대 {MAX_IMPORT_POINTS:,}개 방문 구간까지 가져올 수 있습니다.")
        result = ParsedLocationFile(points=points, visits=visits)
    else:
        raise ValueError("CSV 또는 JSON 파일을 선택해 주세요.")

    if not result.points and not result.visits:
        raise ValueError("파일에 유효한 위치 기록이나 방문 구간이 없습니다.")
    return result


def _parse_point(row: object, index: int) -> LocationCreate:
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
        if timestamp is None:
            timestamp = row.get("timestampMs")
        recorded_at = _parse_timestamp(timestamp)
        return LocationCreate(
            latitude=latitude,
            longitude=longitude,
            accuracy=row.get("accuracy"),
            recorded_at=recorded_at,
        )
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"{index}번째 위치 기록을 읽을 수 없습니다: {exc}") from exc


def _parse_semantic_segments(segments: list) -> list[ImportedVisit]:
    visits = []
    for index, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict) or not isinstance(segment.get("visit"), dict):
            continue
        visit = segment["visit"]
        candidate = visit.get("topCandidate") or {}
        location = candidate.get("placeLocation") or visit.get("placeLocation")
        latitude, longitude = _parse_place_location(location)
        try:
            started_at = _parse_timestamp(segment.get("startTime"))
            ended_at = _parse_timestamp(segment.get("endTime"))
            if ended_at < started_at:
                raise ValueError("방문 종료 시각이 시작 시각보다 빠릅니다.")
            visits.append(ImportedVisit(latitude, longitude, started_at, ended_at))
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{index}번째 Timeline 방문 구간을 읽을 수 없습니다: {exc}") from exc
    return visits


def _parse_legacy_segments(segments: list) -> list[ImportedVisit]:
    visits = []
    for index, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict) or not isinstance(segment.get("placeVisit"), dict):
            continue
        visit = segment["placeVisit"]
        location = visit.get("location") or {}
        try:
            latitude = int(location["latitudeE7"]) / 10_000_000
            longitude = int(location["longitudeE7"]) / 10_000_000
            duration = visit.get("duration", {})
            started_at = _parse_timestamp(duration.get("startTimestamp"))
            ended_at = _parse_timestamp(duration.get("endTimestamp"))
            if ended_at < started_at:
                raise ValueError("방문 종료 시각이 시작 시각보다 빠릅니다.")
            visits.append(ImportedVisit(
                latitude,
                longitude,
                started_at,
                ended_at,
                location.get("name"),
            ))
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{index}번째 Legacy Timeline 방문을 읽을 수 없습니다: {exc}") from exc
    return visits


def _parse_place_location(value: object) -> tuple[float, float]:
    if isinstance(value, str):
        match = GEO_COORDINATES.fullmatch(value.strip())
        if not match:
            raise ValueError("placeLocation 좌표가 geo:위도,경도 형식이 아닙니다.")
        return float(match.group(1)), float(match.group(2))
    if isinstance(value, dict):
        latitude = value.get("latitude", value.get("lat"))
        longitude = value.get("longitude", value.get("lng", value.get("lon")))
        return float(latitude), float(longitude)
    raise ValueError("방문 구간에 장소 좌표가 없습니다.")


def _parse_timestamp(value: object) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)):
        parsed = datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("시간 값을 읽을 수 없습니다.")
    if parsed.tzinfo is None:
        raise ValueError("시간대가 포함된 시각이어야 합니다.")
    return parsed
