import json
from collections import Counter
from pathlib import Path

INDEX_PATH = Path("data/bike_index.json")

def main():
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    dms = data["data_modules"]

    elem_counter = Counter()
    attr_counter = Counter()

    examples = {}

    for dm in dms:
        sig = dm.get("applicability_signals") or {}
        for e in sig.get("elements", []):
            name = e.get("name") or ""
            if name:
                elem_counter[name] += 1
                examples.setdefault(name, e.get("text", ""))

        for a in sig.get("attributes", []):
            key = f'{a.get("element","")}@{a.get("attr","")}'
            if key != "@":
                attr_counter[key] += 1

    print("Top applicability element names:")
    for name, count in elem_counter.most_common(20):
        ex = examples.get(name, "")
        print(f"- {name}: {count}  | example: {ex[:120]}")

    if attr_counter:
        print("\nTop applicability attributes:")
        for name, count in attr_counter.most_common(20):
            print(f"- {name}: {count}")

if __name__ == "__main__":
    main()
