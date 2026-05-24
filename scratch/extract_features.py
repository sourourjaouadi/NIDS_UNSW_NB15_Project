import json
import sys

# Ensure stdout handles UTF-8
sys.stdout.reconfigure(encoding='utf-8')

notebook_path = "notebooks/binary_training.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if 'source' in cell:
        source = "".join(cell['source'])
        if "MODEL_FEATURES" in source or "X_train.columns" in source or "FEATURE_NAMES" in source:
            print("--- Cell Start ---")
            print(source)
            print("--- Cell End ---")
