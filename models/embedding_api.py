"""Validated ranking endpoint, independent of the ELECTRA classifiers."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

if __package__:
    from .embedding_service import EmbeddingService, EmbeddingUnavailable
else:
    from embedding_service import EmbeddingService, EmbeddingUnavailable

router = APIRouter()
service = EmbeddingService()


class RecommendationVideo(BaseModel):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{11}$')
    title: str = Field(min_length=1, max_length=500, pattern=r'\S')
    description: str = Field(default='', max_length=10000)
    channel: str = Field(default='', max_length=200)
    topic: str = Field(default='기타', max_length=80)


class RankingRequest(BaseModel):
    history: List[RecommendationVideo] = Field(min_length=1, max_length=500)
    candidates: List[RecommendationVideo] = Field(min_length=1, max_length=100)
    limit: int = Field(default=6, ge=1, le=20)
    diversity: float = Field(default=0.35, ge=0, le=1)


@router.post('/api/recommendations/rank')
def rank_recommendations(request: RankingRequest):
    try:
        return service.rank(
            [video.model_dump() for video in request.history],
            [video.model_dump() for video in request.candidates],
            request.limit, request.diversity,
        )
    except EmbeddingUnavailable as exc:
        logging.getLogger(__name__).exception('Embedding model unavailable')
        raise HTTPException(status_code=503, detail=str(exc)) from exc
