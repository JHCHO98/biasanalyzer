"""LLM endpoints do not need the ELECTRA or embedding models to load."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

if __package__:
    from .embedding_api import RecommendationVideo
    from .llm_service import RecommendationLLM, LLMError
else:
    from embedding_api import RecommendationVideo
    from llm_service import RecommendationLLM, LLMError

router = APIRouter()
service = RecommendationLLM()


class QueryRequest(BaseModel):
    history: list[RecommendationVideo] = Field(min_length=1, max_length=500)
    diversity: float = Field(default=0.35, ge=0, le=1)


class RankedVideo(RecommendationVideo):
    matched_topic: str = Field(default='', max_length=80)


class ExplanationRequest(BaseModel):
    history: list[RecommendationVideo] = Field(min_length=1, max_length=500)
    recommendations: list[RankedVideo] = Field(min_length=1, max_length=6)


def llm_http_error(exc):
    return HTTPException(status_code=exc.status_code, detail={'code': exc.code, 'message': str(exc)})


@router.post('/api/recommendations/queries')
def suggest_queries(request: QueryRequest):
    try:
        return service.queries([video.model_dump() for video in request.history], request.diversity)
    except LLMError as exc:
        raise llm_http_error(exc) from exc


@router.post('/api/recommendations/explain')
def explain_recommendations(request: ExplanationRequest):
    try:
        return service.explain([video.model_dump() for video in request.history],
                               [video.model_dump() for video in request.recommendations])
    except LLMError as exc:
        raise llm_http_error(exc) from exc
