import json

log_path = r"C:\Users\user\.gemini\antigravity-cli\brain\a766ff83-1c50-4b59-9847-31231cab9725\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    idx = 0
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" in data:
                for tc in data["tool_calls"]:
                    args = tc.get("args", {})
                    target = args.get("TargetFile", "") or args.get("Target", "")
                    if "Dashboard.jsx" in target and ("ReplacementContent" in args or "CodeContent" in args):
                        content = args.get("ReplacementContent") or args.get("CodeContent")
                        filename = f"recovered_dashboard_{idx}_{len(content)}.jsx"
                        with open(filename, "w", encoding="utf-8") as out:
                            out.write(content)
                        print(f"Saved {filename} with size {len(content)}")
                        idx += 1
        except Exception as e:
            pass
