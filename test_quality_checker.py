"""
Standalone Test Runner for TobaccoShield Image Quality Module — Member B.
Runs check_image_quality() / run_quality_pipeline() on sample images and prints a pretty tabular summary.
"""

import sys
from pathlib import Path
from tabulate import tabulate

from tobaccoshield_quality import QualityConfig, check_image_quality


def run_tests_on_directory(sample_dir: str = "sample_images"):
    folder_path = Path(sample_dir)
    if not folder_path.exists() or not folder_path.is_dir():
        print(f"Error: Sample directory '{sample_dir}' not found.")
        print("Run 'python3 generate_test_samples.py' first to create test images.")
        sys.exit(1)

    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    image_files = sorted([f for f in folder_path.iterdir() if f.suffix.lower() in image_extensions])

    if not image_files:
        print(f"No image files found in '{sample_dir}'.")
        sys.exit(1)

    print(f"\n==========================================================================================")
    print(f" TOBACCOSHIELD IMAGE QUALITY TEST SUITE & THRESHOLD CALIBRATION BENCHMARK (MEMBER B)")
    print(f" Target Directory: {folder_path.resolve()}")
    print(f" Total Images Evaluated: {len(image_files)}")
    print(f"==========================================================================================\n")

    table_data = []
    pass_count = 0
    fail_count = 0

    for img_path in image_files:
        try:
            res = check_image_quality(str(img_path))
            
            is_pass = res["passed"]
            reason = res["reason"] if res["reason"] is not None else "-"
            all_reasons = ", ".join(res.get("all_failed_reasons", [])) if res.get("all_failed_reasons") else "-"
            q_score = res.get("quality_score", 0.0)
            ai_ready = "YES" if res.get("ai_ready_image") is not None else "NO"
            human_reason = res.get("human_reason", "-")

            if is_pass:
                pass_count += 1
                status_str = "PASS"
            else:
                fail_count += 1
                status_str = "FAIL"

            table_data.append([
                img_path.name,
                status_str,
                f"{q_score:.2f}",
                reason,
                ai_ready,
                human_reason[:40] + ("..." if len(human_reason) > 40 else ""),
                all_reasons,
            ])
        except Exception as e:
            table_data.append([img_path.name, "ERROR", "0.00", str(e), "NO", "-", "-"])

    headers = [
        "Filename",
        "Verdict",
        "Q Score",
        "Primary Reason",
        "AI-Ready",
        "Human Reason / Retake Prompt",
        "All Failure Reasons",
    ]

    print(tabulate(table_data, headers=headers, tablefmt="grid"))

    print(f"\n------------------------------------------------------------------------------------------")
    print(f" SUMMARY: Total Processed: {len(image_files)} | Passed: {pass_count} | Failed: {fail_count}")
    print(f"------------------------------------------------------------------------------------------\n")


if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "sample_images"
    run_tests_on_directory(target_dir)
