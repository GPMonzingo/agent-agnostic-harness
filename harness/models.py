"""Provider-neutral model contracts."""
from dataclasses import dataclass, field
from typing import Any, Protocol

@dataclass
class ModelRequest:
    system: str
    prompt: str
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass
class ModelResponse:
    text: str
    raw: Any = None

class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResponse: ...
