from __future__ import annotations

import json

try:
    from ids_pipeline.main import run_demo_pipeline
except ImportError:  # pragma: no cover
    from main import run_demo_pipeline


if __name__ == "__main__":
    result = run_demo_pipeline()
    print(json.dumps(result, indent=2))

