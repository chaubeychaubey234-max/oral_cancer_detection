"""
Expanded Synthetic & Realistic Test Image Generator for TobaccoShield Quality Engine.
Creates an expanded benchmark suite (12 images) including realistic camera artifacts (sensor noise, JPEG compression),
threshold calibration samples, and edge-case framing scenarios (lips only, teeth only, shadows, distant shots, combined failures).
"""

import io
from pathlib import Path
import cv2
import numpy as np
from PIL import Image


def apply_camera_artifacts(image_bgr: np.ndarray, noise_std=6, jpeg_quality=85) -> np.ndarray:
    """Simulates realistic smartphone camera sensor noise and JPEG compression loss."""
    h, w, c = image_bgr.shape
    noise = np.random.normal(0, noise_std, (h, w, c)).astype(np.float32)
    noisy_img = np.clip(image_bgr.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    pil_img = Image.fromarray(cv2.cvtColor(noisy_img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=jpeg_quality)
    buf.seek(0)
    compressed = cv2.cvtColor(np.array(Image.open(buf)), cv2.COLOR_RGB2BGR)
    return compressed


def create_mucosa_base_image(width=640, height=480) -> np.ndarray:
    """Generates a synthetic oral mucosa base image with realistic YCrCb pinkish-red tissue colors and texture."""
    base_bgr = np.zeros((height, width, 3), dtype=np.uint8)
    base_bgr[:, :] = (110, 115, 210)  # B:110, G:115, R:210 (rich mucosal pink/red)

    noise = np.random.normal(0, 12, (height, width, 3)).astype(np.float32)
    tissue_img = np.clip(base_bgr.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    for _ in range(20):
        pt1 = (np.random.randint(40, width - 40), np.random.randint(40, height - 40))
        pt2 = (pt1[0] + np.random.randint(-120, 120), pt1[1] + np.random.randint(-120, 120))
        cv2.line(tissue_img, pt1, pt2, (80, 85, 180), thickness=np.random.randint(1, 3), lineType=cv2.LINE_AA)

    return tissue_img


def generate_all_samples(output_dir="sample_images"):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    print(f"Generating expanded benchmark test images in '{out_path.resolve()}'...")

    base_mucosa = create_mucosa_base_image()

    # 1. Good Mucosa Image (Passed)
    good_img = apply_camera_artifacts(base_mucosa)
    cv2.imwrite(str(out_path / "01_good_mucosa.jpg"), good_img)
    print(" [✓] 01_good_mucosa.jpg (PASS)")

    # 2. Blurry Mucosa (Out of focus)
    blurry_raw = cv2.GaussianBlur(base_mucosa, (51, 51), 0)
    blurry_img = apply_camera_artifacts(blurry_raw, noise_std=2)
    cv2.imwrite(str(out_path / "02_blurry_mucosa.jpg"), blurry_img)
    print(" [✓] 02_blurry_mucosa.jpg (FAIL -> blur)")

    # 3. Underexposed (too dark)
    dark_raw = (base_mucosa.astype(np.float32) * 0.12).astype(np.uint8)
    dark_img = apply_camera_artifacts(dark_raw)
    cv2.imwrite(str(out_path / "03_underexposed_mucosa.jpg"), dark_img)
    print(" [✓] 03_underexposed_mucosa.jpg (FAIL -> underexposed)")

    # 4. Overexposed (too bright)
    bright_raw = np.clip(base_mucosa.astype(np.float32) + 120, 0, 255).astype(np.uint8)
    bright_img = apply_camera_artifacts(bright_raw)
    cv2.imwrite(str(out_path / "04_overexposed_mucosa.jpg"), bright_img)
    print(" [✓] 04_overexposed_mucosa.jpg (FAIL -> overexposed)")

    # 5. Glare (specular flash highlights on wet mucosa)
    glare_raw = base_mucosa.copy()
    cv2.circle(glare_raw, (200, 200), 70, (255, 255, 255), -1)
    cv2.circle(glare_raw, (400, 280), 80, (255, 255, 255), -1)
    glare_img = apply_camera_artifacts(glare_raw)
    cv2.imwrite(str(out_path / "05_glare_mucosa.jpg"), glare_img)
    print(" [✓] 05_glare_mucosa.jpg (FAIL -> glare)")

    # 6. Bad Framing - Non mucosa object / background
    bad_frame_img = np.zeros((480, 640, 3), dtype=np.uint8)
    bad_frame_img[:, :] = (180, 50, 20)  # Cool dark blue
    cv2.putText(bad_frame_img, "NOT MUCOSA", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)
    cv2.imwrite(str(out_path / "06_bad_framing_background.jpg"), bad_frame_img)
    print(" [✓] 06_bad_framing_background.jpg (FAIL -> bad_framing)")

    # 7. Edge Case: Lips Only Framing (outer facial skin & lip outline, missing central inner mucosa)
    lips_img = np.zeros((480, 640, 3), dtype=np.uint8)
    lips_img[:, :] = (150, 175, 200)  # Typical facial skin (Cb >= 115, Cr <= 150)
    # Outer lip vermilion outline
    cv2.ellipse(lips_img, (320, 240), (220, 50), 0, 0, 360, (110, 110, 190), 8)
    lips_img = apply_camera_artifacts(lips_img)
    cv2.imwrite(str(out_path / "07_edgecase_lips_only.jpg"), lips_img)
    print(" [✓] 07_edgecase_lips_only.jpg (FAIL -> bad_framing)")

    # 8. Edge Case: Teeth Only (incisors/molars dominating frame)
    teeth_img = np.zeros((480, 640, 3), dtype=np.uint8)
    teeth_img[:, :] = (220, 230, 235)  # Bright enamel
    for x in range(100, 550, 60):
        cv2.line(teeth_img, (x, 150), (x, 330), (160, 160, 160), 3)
    teeth_img = apply_camera_artifacts(teeth_img)
    cv2.imwrite(str(out_path / "08_edgecase_teeth_only.jpg"), teeth_img)
    print(" [✓] 08_edgecase_teeth_only.jpg (FAIL -> bad_framing)")

    # 9. Edge Case: Deep Shadow / Void
    shadow_img = base_mucosa.copy()
    cv2.circle(shadow_img, (320, 240), 180, (10, 10, 10), -1)  # Central dark void
    shadow_img = apply_camera_artifacts(shadow_img)
    cv2.imwrite(str(out_path / "09_edgecase_deep_shadow.jpg"), shadow_img)
    print(" [✓] 09_edgecase_deep_shadow.jpg (FAIL -> bad_framing)")

    # 10. Edge Case: Distant Shot (mucosa region occupies only 10% of frame center)
    distant_img = np.zeros((480, 640, 3), dtype=np.uint8)
    distant_img[:, :] = (150, 175, 200)  # Surrounding face skin
    cv2.rectangle(distant_img, (280, 200), (360, 280), (110, 115, 210), -1)
    distant_img = apply_camera_artifacts(distant_img)
    cv2.imwrite(str(out_path / "10_edgecase_distant_shot.jpg"), distant_img)
    print(" [✓] 10_edgecase_distant_shot.jpg (FAIL -> bad_framing)")

    # 11. Multi-Failure Case: Both Blurry AND Misframed
    multi_fail = cv2.GaussianBlur(bad_frame_img, (41, 41), 0)
    cv2.imwrite(str(out_path / "11_multi_fail_blur_and_framing.jpg"), multi_fail)
    print(" [✓] 11_multi_fail_blur_and_framing.jpg (FAIL -> blur + bad_framing)")

    # 12. Realistic Camera Photo (Simulated realistic smartphone photo)
    real_sim = create_mucosa_base_image()
    Y, X = np.ogrid[:480, :640]
    dist_from_center = np.sqrt((X - 320)**2 + (Y - 240)**2)
    vignette = np.clip(1.1 - (dist_from_center / 400.0), 0.5, 1.2)[:, :, np.newaxis]
    real_sim = np.clip(real_sim.astype(np.float32) * vignette, 0, 255).astype(np.uint8)
    real_sim = apply_camera_artifacts(real_sim, noise_std=8, jpeg_quality=75)
    cv2.imwrite(str(out_path / "12_realistic_camera_photo.jpg"), real_sim)
    print(" [✓] 12_realistic_camera_photo.jpg (PASS - Realistic photo)")

    print(f"\nAll 12 expanded test samples successfully generated in '{out_path}'.")


if __name__ == "__main__":
    generate_all_samples()
