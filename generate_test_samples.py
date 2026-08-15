"""
Synthetic Test Image Generator for TobaccoShield Quality Checker.
Creates a set of benchmark test images representing good quality buccal mucosa photos
as well as specific failure modes (blur, underexposure, overexposure, glare, bad framing).
"""

from pathlib import Path
import cv2
import numpy as np


def create_mucosa_base_image(width=640, height=480) -> np.ndarray:
    """Generates a synthetic oral mucosa base image with realistic YCrCb pinkish-red tissue colors and texture."""
    # BGR color for oral mucosa tissue (pinkish/red)
    base_bgr = np.zeros((height, width, 3), dtype=np.uint8)
    base_bgr[:, :] = (110, 115, 210)  # B:110, G:115, R:210 (rich mucosal pink/red)

    # Add subtle organic tissue texture variations (perlin-like noise simulation)
    noise = np.random.normal(0, 12, (height, width, 3)).astype(np.float32)
    tissue_img = np.clip(base_bgr.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    # Add realistic mucosal surface details (vascular pattern / mucosal folds)
    for _ in range(15):
        pt1 = (np.random.randint(50, width - 50), np.random.randint(50, height - 50))
        pt2 = (pt1[0] + np.random.randint(-100, 100), pt1[1] + np.random.randint(-100, 100))
        cv2.line(tissue_img, pt1, pt2, (80, 85, 180), thickness=np.random.randint(1, 3), lineType=cv2.LINE_AA)

    return tissue_img


def generate_all_samples(output_dir="sample_images"):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    print(f"Generating synthetic test images in '{out_path.resolve()}'...")

    base_mucosa = create_mucosa_base_image()

    # 1. Good Mucosa Image
    cv2.imwrite(str(out_path / "01_good_mucosa.jpg"), base_mucosa)
    print(" [✓] Created 01_good_mucosa.jpg (Expected result: PASS)")

    # 2. Blurry Image
    blurry_img = cv2.GaussianBlur(base_mucosa, (35, 35), 0)
    cv2.imwrite(str(out_path / "02_blurry_mucosa.jpg"), blurry_img)
    print(" [✓] Created 02_blurry_mucosa.jpg (Expected result: FAIL -> blur)")

    # 3. Underexposed (too dark) Image
    dark_img = (base_mucosa.astype(np.float32) * 0.12).astype(np.uint8)
    cv2.imwrite(str(out_path / "03_underexposed_mucosa.jpg"), dark_img)
    print(" [✓] Created 03_underexposed_mucosa.jpg (Expected result: FAIL -> underexposed)")

    # 4. Overexposed (too bright) Image
    bright_img = np.clip(base_mucosa.astype(np.float32) + 120, 0, 255).astype(np.uint8)
    cv2.imwrite(str(out_path / "04_overexposed_mucosa.jpg"), bright_img)
    print(" [✓] Created 04_overexposed_mucosa.jpg (Expected result: FAIL -> overexposed)")

    # 5. Glare (specular flash highlights on wet mucosa)
    glare_img = base_mucosa.copy()
    # Draw several large pure white specular highlight patches (low saturation, max value)
    cv2.circle(glare_img, (200, 200), 70, (255, 255, 255), -1)
    cv2.circle(glare_img, (400, 280), 80, (255, 255, 255), -1)
    cv2.circle(glare_img, (320, 150), 60, (255, 255, 255), -1)
    cv2.imwrite(str(out_path / "05_glare_mucosa.jpg"), glare_img)
    print(" [✓] Created 05_glare_mucosa.jpg (Expected result: FAIL -> glare)")

    # 6. Bad Framing (non-mucosal object / dark blue background)
    bad_frame_img = np.zeros((480, 640, 3), dtype=np.uint8)
    bad_frame_img[:, :] = (180, 50, 20)  # Cool dark blue background
    cv2.putText(bad_frame_img, "NOT MUCOSA", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)
    cv2.imwrite(str(out_path / "06_bad_framing.jpg"), bad_frame_img)
    print(" [✓] Created 06_bad_framing.jpg (Expected result: FAIL -> bad_framing)")

    print(f"\nAll 6 test samples successfully generated in '{out_path}'.")


if __name__ == "__main__":
    generate_all_samples()
