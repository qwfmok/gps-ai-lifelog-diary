import logging

import httpx

from app.services.geocoding import reverse_geocode
from app.services.place_lookup import NearbyPlace, find_nearby_place


logger = logging.getLogger(__name__)


def infer_activity_candidates(category_group_code: str) -> list[dict]:
    """Map a nearby venue category to cautious, user-confirmable suggestions."""
    suggestions = {
        "CE7": [("카페 이용", 0.45)],
        "FD6": [("식사", 0.50)],
        "SC4": [("수업 또는 학교 활동", 0.50)],
        "AC5": [("수업 또는 학습", 0.50)],
        "HP8": [("병원 방문", 0.60)],
        "CT1": [("문화생활", 0.45)],
        "AT4": [("관광 또는 나들이", 0.45)],
        "MT1": [("장보기", 0.45)],
        "CS2": [("간단한 물품 구매", 0.35)],
    }
    return [
        {
            "name": name,
            "confidence": confidence,
            "source": "nearby_place_category",
        }
        for name, confidence in suggestions.get(category_group_code, [])
    ]


def infer_from_place_name(place_name: str | None) -> list[dict]:
    if not place_name:
        return []
    name = place_name.lower()
    rules = (
        (("카페", "커피", "스타벅스", "투썸", "cafe", "coffee"), "카페 이용", 0.35),
        (("식당", "음식점", "restaurant", "diner"), "식사", 0.40),
        (("학교", "대학교", "학원", "school", "academy"), "수업 또는 학습", 0.40),
        (("병원", "의원", "hospital", "clinic"), "병원 방문", 0.45),
        (("도서관", "library"), "독서 또는 공부", 0.45),
        (("공원", "park"), "산책 또는 운동", 0.35),
    )
    for keywords, activity, confidence in rules:
        if any(keyword in name for keyword in keywords):
            return [{
                "name": activity,
                "confidence": confidence,
                "source": "imported_place_name",
            }]
    return []


async def enrich_stays_with_places(stays: list[dict]) -> list[dict]:
    """Look up venues once per nearby coordinate cluster, then enrich stays."""
    cache: dict[tuple[float, float], tuple[NearbyPlace | None, str | None]] = {}
    for stay in stays:
        source_place_name = stay.get("place_name")
        key = (round(stay["latitude"], 4), round(stay["longitude"], 4))
        if key not in cache:
            place = None
            address = None
            try:
                place = await find_nearby_place(stay["latitude"], stay["longitude"])
            except httpx.HTTPError as exc:
                logger.warning("Nearby place lookup failed: %s", type(exc).__name__)
            if place is None:
                try:
                    address = await reverse_geocode(
                        latitude=stay["latitude"], longitude=stay["longitude"]
                    )
                except httpx.HTTPError as exc:
                    logger.warning("Stay point address lookup failed: %s", type(exc).__name__)
            cache[key] = (place, address)

        place, address = cache[key]
        if place:
            stay["place_name"] = place.name
            stay["address"] = place.address
            stay["place_category"] = place.category
            stay["place_category_code"] = place.category_group_code
            stay["place_distance_meters"] = place.distance_meters
            stay["activity_candidates"] = infer_activity_candidates(place.category_group_code)
            continue

        stay["place_name"] = source_place_name
        stay["address"] = address
        stay["place_category"] = None
        stay["place_category_code"] = None
        stay["place_distance_meters"] = None
        stay["activity_candidates"] = infer_from_place_name(source_place_name)
    return stays
