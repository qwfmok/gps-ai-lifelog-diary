from dataclasses import dataclass


@dataclass(frozen=True)
class ActivityGuess:
    category: str
    activity: str
    confidence: float


def infer_place_and_activity(address: str | None) -> list[ActivityGuess]:
    """Suggest an activity conservatively from recognizable place-name words."""
    if not address:
        return []

    name = address.lower()
    rules = (
        (("카페", "커피", "cafe"), "음식점", "카페 이용", 0.45),
        (("식당", "음식점", "푸드", "restaurant", "food"), "음식점", "식사", 0.55),
        (("대학교", "학교", "학원", "대학", "school", "academy"), "교육", "수업 또는 공부", 0.50),
        (("병원", "의원", "clinic", "hospital"), "의료", "진료", 0.60),
        (("공원", "산책로", "park"), "공원", "산책 또는 운동", 0.45),
        (("도서관", "library"), "문화·교육", "독서 또는 공부", 0.55),
        (("마트", "시장", "백화점", "쇼핑", "market", "mall"), "쇼핑", "쇼핑", 0.45),
    )

    for keywords, category, activity, confidence in rules:
        if any(keyword in name for keyword in keywords):
            return [ActivityGuess(category, activity, confidence)]
    return []
