import json
import os
import shutil

log_path = r"C:\Users\user\.gemini\antigravity-cli\brain\a766ff83-1c50-4b59-9847-31231cab9725\.system_generated\logs\transcript_full.jsonl"
original_dashboard_path = r"C:\Users\user\OneDrive\바탕 화면\changgaeyeon\biasanalyzer\react\front\src\Dashboard.jsx"

# Start from the clean git checkout version
with open(original_dashboard_path, "r", encoding="utf-8") as f:
    current_content = f.read()

print(f"Original length: {len(current_content)}")

with open(log_path, "r", encoding="utf-8") as f:
    step_num = 0
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" not in data:
                continue
            for tc in data["tool_calls"]:
                name = tc.get("name", "")
                args = tc.get("args", {})
                target = args.get("TargetFile", "") or args.get("Target", "")
                if "Dashboard.jsx" not in target:
                    continue
                
                if name == "write_to_file":
                    overwrite = args.get("Overwrite", False)
                    if overwrite:
                        code = args.get("CodeContent", "")
                        current_content = code
                        print(f"[{step_num}] write_to_file (overwrite): new len {len(current_content)}")
                elif name == "replace_file_content":
                    target_str = args.get("TargetContent", "")
                    replacement = args.get("ReplacementContent", "")
                    if target_str in current_content:
                        current_content = current_content.replace(target_str, replacement, 1)
                        print(f"[{step_num}] replace_file_content: replaced chunk, new len {len(current_content)}")
                    else:
                        # try matching ignoring carriage returns
                        norm_current = current_content.replace("\r\n", "\n")
                        norm_target = target_str.replace("\r\n", "\n")
                        norm_replacement = replacement.replace("\r\n", "\n")
                        if norm_target in norm_current:
                            norm_current = norm_current.replace(norm_target, norm_replacement, 1)
                            current_content = norm_current
                            print(f"[{step_num}] replace_file_content (normalized): replaced chunk, new len {len(current_content)}")
                        else:
                            print(f"[{step_num}] WARNING: TargetContent not found!")
                elif name == "multi_replace_file_content":
                    chunks = args.get("ReplacementChunks", [])
                    print(f"[{step_num}] multi_replace_file_content: applying {len(chunks)} chunks")
                    for chunk in chunks:
                        target_str = chunk.get("TargetContent", "")
                        replacement = chunk.get("ReplacementContent", "")
                        if target_str in current_content:
                            current_content = current_content.replace(target_str, replacement, 1)
                        else:
                            norm_current = current_content.replace("\r\n", "\n")
                            norm_target = target_str.replace("\r\n", "\n")
                            norm_replacement = replacement.replace("\r\n", "\n")
                            if norm_target in norm_current:
                                norm_current = norm_current.replace(norm_target, norm_replacement, 1)
                                current_content = norm_current
                            else:
                                print(f"[{step_num}] WARNING: Chunk TargetContent not found!")
            step_num += 1
        except Exception as e:
            print(f"Error parsing line: {e}")

# Backup current file first
shutil.copy(original_dashboard_path, original_dashboard_path + ".bak")

with open(original_dashboard_path, "w", encoding="utf-8") as f:
    f.write(current_content)

print(f"Reconstruction complete. Saved to {original_dashboard_path}. Final length: {len(current_content)}")
