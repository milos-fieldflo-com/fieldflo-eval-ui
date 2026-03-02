"""Pydantic models mirroring evals/evaluators/types.py (independent copy)."""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field


# --- Groundedness ---

class ClaimAssessment(BaseModel):
    claim: str
    label: Literal["supported", "unsupported", "contradicted", "properly_marked_uncertain"]
    severity: Literal["high", "moderate", "minor"] = "minor"
    evidence: str = ""


class GroundednessResult(BaseModel):
    score: int = Field(ge=1, le=5)
    supported_rate: float = 0.0
    weighted_error_rate: float = 0.0
    claims: list[ClaimAssessment] = Field(default_factory=list)
    reasoning: str = ""


# --- Completeness ---

class RequiredItemScore(BaseModel):
    item: str
    category: Literal["steps", "hazards", "controls", "context"]
    item_score: int = Field(ge=0, le=2)
    weight: int = Field(ge=1, le=3)
    evidence: str = ""


class CompletenessResult(BaseModel):
    score: int = Field(ge=1, le=5)
    completeness_pct: float = 0.0
    required_items: list[RequiredItemScore] = Field(default_factory=list)
    reasoning: str = ""


# --- Form Groundedness ---

class FormFieldAssessment(BaseModel):
    field_id: str
    field_value: Union[str, bool, int, float, list] = ""
    label: Literal["supported", "unsupported", "contradicted"] = "supported"
    severity: Literal["high", "moderate", "minor"] = "minor"
    evidence: str = ""


class FormGroundednessResult(BaseModel):
    score: int = Field(ge=1, le=5)
    supported_rate: float = 0.0
    weighted_error_rate: float = 0.0
    fields: list[FormFieldAssessment] = Field(default_factory=list)
    reasoning: str = ""


# --- Form Completeness ---

class FormCompletenessItem(BaseModel):
    transcript_item: str
    category: Literal["task_step", "hazard", "control", "ppe", "context"]
    item_score: int = Field(ge=0, le=2)
    weight: int = Field(ge=1, le=3)
    evidence: str = ""


class FormCompletenessResult(BaseModel):
    score: int = Field(ge=1, le=5)
    completeness_pct: float = 0.0
    items: list[FormCompletenessItem] = Field(default_factory=list)
    reasoning: str = ""
