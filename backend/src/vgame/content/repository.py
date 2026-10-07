"""Read-only access to the bundled learning content."""

from functools import cache
from importlib import resources

from vgame.content.models import Catalog


@cache
def load_catalog() -> Catalog:
    """Load and validate ``data/zones.json`` once per process.

    Raises ``pydantic.ValidationError`` on invalid content; the app calls this at
    startup so bad content stops the deploy instead of failing a request.
    """
    raw = resources.files("vgame.content").joinpath("data", "zones.json").read_text("utf-8")
    return Catalog.model_validate_json(raw)
