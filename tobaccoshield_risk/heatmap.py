"""
Grad-CAM / suspicious region heatmap generator.
Returns PNG bytes of a heatmap overlay on the input image.
"""
import io
import logging
from typing import Optional
import numpy as np
from PIL import Image

logger = logging.getLogger("tobaccoshield.risk.heatmap")


def generate_gradcam(image_array: np.ndarray, model, class_index: int) -> Optional[bytes]:
    """
    Generates a Grad-CAM heatmap overlay for the specified class index.

    Args:
        image_array: Normalized numpy array of shape (1, 224, 224, 3) with values in [0, 1].
        model: Loaded Keras MobileNetV2 model.
        class_index: Predicted class index (0: high_risk, 1: normal, 2: suspicious).

    Returns:
        PNG image bytes of the heatmap overlay, or None on failure.
    """
    try:
        import tensorflow as tf

        # If 3D array (224, 224, 3), add batch dimension
        if image_array.ndim == 3:
            img_tensor = np.expand_dims(image_array, axis=0)
        else:
            img_tensor = image_array

        # Check if model has nested backbone (e.g. mobilenetv2)
        backbone = None
        for layer in model.layers:
            if hasattr(layer, "layers") and len(layer.layers) > 1:
                backbone = layer
                break

        if backbone is not None:
            # Find last conv layer in backbone
            last_conv_layer = None
            for layer in reversed(backbone.layers):
                if isinstance(layer, tf.keras.layers.Conv2D) or "conv" in layer.name.lower() or "out_relu" in layer.name.lower():
                    last_conv_layer = layer
                    break

            if last_conv_layer is None:
                last_conv_layer = backbone.layers[-1]

            backbone_model = tf.keras.Model(
                inputs=backbone.inputs,
                outputs=[last_conv_layer.output, backbone.output]
            )

            with tf.GradientTape() as tape:
                conv_outputs, backbone_features = backbone_model(img_tensor)
                tape.watch(conv_outputs)

                # Propagate through top classifier layers
                x = backbone_features
                for layer in model.layers[2:]:
                    x = layer(x, training=False)
                loss = x[:, class_index]

            grads = tape.gradient(loss, conv_outputs)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            conv_outputs = conv_outputs[0]
            heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
            heatmap = tf.squeeze(heatmap)
            heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
            heatmap = heatmap.numpy()
        else:
            # Top-level model layers
            last_conv_layer = None
            for layer in reversed(model.layers):
                if isinstance(layer, tf.keras.layers.Conv2D) or "conv" in layer.name.lower():
                    last_conv_layer = layer
                    break

            if last_conv_layer is None:
                return _generate_fallback_overlay(img_tensor[0], class_index)

            grad_model = tf.keras.models.Model(
                inputs=model.inputs,
                outputs=[last_conv_layer.output, model.output]
            )

            with tf.GradientTape() as tape:
                conv_outputs, predictions = grad_model(img_tensor)
                loss = predictions[:, class_index]

            grads = tape.gradient(loss, conv_outputs)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            conv_outputs = conv_outputs[0]
            heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
            heatmap = tf.squeeze(heatmap)
            heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
            heatmap = heatmap.numpy()

        # Resize heatmap to match image size (224, 224)
        heatmap_img = Image.fromarray(np.uint8(255 * heatmap))
        heatmap_img = heatmap_img.resize((224, 224), Image.Resampling.BILINEAR)
        heatmap_arr = np.array(heatmap_img)

        # Apply colormap (Jet-like heat map)
        orig_img = Image.fromarray(np.uint8(img_tensor[0] * 255)).convert("RGBA")
        
        # Color mapping: Red/Orange for high activation
        r = heatmap_arr
        g = np.uint8(heatmap_arr * 0.4)
        b = np.uint8(255 - heatmap_arr)
        alpha = np.uint8(heatmap_arr * 0.65)  # Transparency proportional to heat
        
        rgba = np.stack([r, g, b, alpha], axis=-1)
        overlay = Image.fromarray(rgba, mode="RGBA")

        # Composite overlay on original image
        combined = Image.alpha_composite(orig_img, overlay).convert("RGB")

        buf = io.BytesIO()
        combined.save(buf, format="PNG")
        return buf.getvalue()

    except Exception as e:
        logger.warning(f"Grad-CAM computation failed ({e}), using fallback overlay.")
        return _generate_fallback_overlay(img_tensor[0] if 'img_tensor' in locals() else image_array, class_index)


def _generate_fallback_overlay(img_arr: np.ndarray, class_index: int) -> bytes:
    """Generates a clean visual indicator overlay if Grad-CAM fails."""
    from PIL import ImageDraw
    
    img = Image.fromarray(np.uint8(img_arr * 255)).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    w, h = img.size
    cx, cy = w // 2, h // 2
    r = int(min(w, h) * 0.25)
    
    # Class colors: 0=high (red), 2=suspicious (amber), 1=normal (green)
    color_map = {
        0: (239, 68, 68, 120),   # Red
        2: (245, 158, 11, 100),  # Amber
        1: (34, 197, 94, 80),    # Green
    }
    fill_color = color_map.get(class_index, (239, 68, 68, 100))
    
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill_color)
    combined = Image.alpha_composite(img, overlay).convert("RGB")
    
    buf = io.BytesIO()
    combined.save(buf, format="PNG")
    return buf.getvalue()
