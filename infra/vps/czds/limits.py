"""Shared, bounded import budgets; larger zones require an explicit profile."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ImportLimits:
    compressed: int
    expanded: int
    start_free: int


GIB = 1024**3
MIN_FREE = 20 * GIB
PILOT = ImportLimits(256 * 1024**2, 2 * GIB, MIN_FREE)
MEDIUM = ImportLimits(1 * GIB, 8 * GIB, 60 * GIB)
PROFILES = {"pilot": PILOT, "medium": MEDIUM}
