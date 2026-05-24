import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

notebook_path = "notebooks/data_cleaning.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if 'source' in cell:
        source = "".join(cell['source'])
        if "COLS_TO_DROP" in source:
            print("--- Found COLS_TO_DROP definition ---")
            print(source)
