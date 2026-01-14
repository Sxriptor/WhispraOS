#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Simple PaddleOCR screen translation script
Takes a screenshot and extracts text using PaddleOCR
"""

import sys
import json
import os
from pathlib import Path

# Add AppData Paddle folders to Python path for dependencies
app_data_path = os.path.expanduser('~\\AppData\\Roaming\\whispra\\models\\Paddle')
gpu_paddle_path = os.path.expanduser('~\\AppData\\Roaming\\whispra\\models\\Paddle\\gpu')

# Global OCR instance cache (won't persist between process invocations)
# Use file-based caching instead via pickle
import pickle
import hashlib
import tempfile

# Paths will be added conditionally based on use_gpu flag in run_ocr function
# This ensures GPU path is prioritized only when GPU mode is enabled

def run_ocr(image_path, target_language='en', use_gpu=False):
    """
    Run OCR on the given image using PaddleOCR

    Args:
        image_path (str): Path to the image file
        target_language (str): Target language for OCR ('en', 'ch', 'ru', etc.)
        use_gpu (bool): Whether to use GPU acceleration (requires CUDA)

    Returns:
        dict: OCR results with text boxes and translations
    """
    global _ocr_cache, _ocr_cache_key
    
    try:
        # Clear any existing Paddle paths from sys.path to avoid conflicts
        sys.path = [p for p in sys.path if 'Paddle' not in p]
        
        # Add paths based on GPU mode - GPU path first if GPU mode enabled
        if use_gpu and os.path.exists(gpu_paddle_path):
            sys.path.insert(0, gpu_paddle_path)
            print(f"🎮 GPU MODE: Added GPU Paddle path (priority): {gpu_paddle_path}", file=sys.stderr)
            if os.path.exists(app_data_path):
                sys.path.insert(1, app_data_path)
                print(f"🔧 Added CPU Paddle path (fallback): {app_data_path}", file=sys.stderr)
        else:
            # CPU mode: use regular Paddle path
            if os.path.exists(app_data_path):
                sys.path.insert(0, app_data_path)
                print(f"💻 CPU MODE: Added CPU Paddle path: {app_data_path}", file=sys.stderr)
            if os.path.exists(gpu_paddle_path):
                sys.path.insert(1, gpu_paddle_path)
                print(f"🔧 Added GPU Paddle path (available but not used): {gpu_paddle_path}", file=sys.stderr)
        
        if not os.path.exists(app_data_path) and not os.path.exists(gpu_paddle_path):
            print(f"⚠️ No Paddle paths found. AppData: {app_data_path}, GPU: {gpu_paddle_path}", file=sys.stderr)
        
        # Debug: Print current Python path for Paddle
        print(f"📋 Python path entries containing 'Paddle':", file=sys.stderr)
        for p in sys.path:
            if 'Paddle' in p:
                print(f"  - {p}", file=sys.stderr)
        
        # Try to import PaddleOCR
        try:
            from paddleocr import PaddleOCR
            print("✅ PaddleOCR imported successfully", file=sys.stderr)
            
            # Try to detect which version was imported
            try:
                import paddle
                print(f"🔍 PaddlePaddle version: {paddle.__version__}", file=sys.stderr)
                print(f"🔍 PaddlePaddle location: {paddle.__file__}", file=sys.stderr)
                if 'gpu' in paddle.__file__.lower():
                    print("🎮 GPU PaddlePaddle detected!", file=sys.stderr)
                else:
                    print("💻 CPU PaddlePaddle detected", file=sys.stderr)
            except Exception as e:
                print(f"⚠️ Could not detect PaddlePaddle version: {e}", file=sys.stderr)
        except (ImportError, RuntimeError) as e:
            error_msg = str(e)
            print(f"❌ PaddleOCR import error: {error_msg}", file=sys.stderr)
            
            # Check if it's a NumPy ABI mismatch with GPU PaddlePaddle
            if 'numpy' in error_msg.lower() and ('ABI version' in error_msg or 'multiarray' in error_msg):
                if use_gpu:
                    print("⚠️ GPU PaddlePaddle NumPy compatibility issue detected", file=sys.stderr)
                    print("⚠️ Falling back to CPU PaddlePaddle...", file=sys.stderr)
                    
                    # Try to remove GPU path and retry with CPU path only
                    sys.path = [p for p in sys.path if 'gpu' not in p.lower()]
                    
                    # Add CPU path
                    if os.path.exists(app_data_path):
                        sys.path.insert(0, app_data_path)
                        print(f"💻 Retrying with CPU Paddle path only: {app_data_path}", file=sys.stderr)
                    
                    # Retry import with CPU path
                    try:
                        from paddleocr import PaddleOCR
                        print("✅ PaddleOCR imported successfully from CPU path", file=sys.stderr)
                        # Override use_gpu to False since we're falling back to CPU
                        use_gpu = False
                        print("⚠️ GPU mode disabled due to NumPy compatibility - using CPU mode", file=sys.stderr)
                    except (ImportError, RuntimeError) as retry_error:
                        print(f"❌ Retry import also failed: {retry_error}", file=sys.stderr)
                        return {
                            'success': False,
                            'error': f'PaddleOCR import failed: NumPy ABI mismatch with GPU PaddlePaddle. Please reinstall GPU PaddlePaddle with compatible NumPy version.',
                            'text_boxes': []
                        }
                else:
                    return {
                        'success': False,
                        'error': f'PaddleOCR import failed: {error_msg}',
                        'text_boxes': []
                    }
            else:
                return {
                    'success': False,
                    'error': 'PaddleOCR not installed. Please install with: pip install paddleocr',
                    'text_boxes': []
                }
        except Exception as e:
            print(f"❌ PaddleOCR import exception: {e}", file=sys.stderr)
            # Check if it's a NumPy ABI issue
            if 'ABI version' in str(e) or 'numpy' in str(e).lower():
                return {
                    'success': False,
                    'error': f'NumPy version compatibility issue: {e}. Please reinstall with compatible NumPy version.',
                    'text_boxes': []
                }
            return {
                'success': False,
                'error': f'PaddleOCR import failed: {e}',
                'text_boxes': []
            }

        # Map language codes to PaddleOCR language codes
        lang_map = {
            'en': 'en',
            'zh': 'ch',
            'ja': 'japan',
            'ko': 'korean',
            'ru': 'cyrillic',
            'ar': 'arabic',
            'hi': 'devanagari',
            'th': 'thai',
            'es': 'latin',
            'fr': 'latin',
            'de': 'latin',
            'it': 'latin',
            'pt': 'latin'
        }

        # Get the appropriate language for PaddleOCR
        paddle_lang = lang_map.get(target_language, 'en')

        print(f"🔍 Running OCR with language: {paddle_lang} (from {target_language})", file=sys.stderr)
        print(f"⚡ GPU mode: {'ENABLED (Fast)' if use_gpu else 'DISABLED (Normal)'}", file=sys.stderr)

        # Create cache key based on language and GPU mode
        cache_key = f"{paddle_lang}_{use_gpu}"
        
        # Reuse cached OCR instance if available and matches current settings
        if cache_key == _ocr_cache_key and cache_key in _ocr_cache:
            ocr = _ocr_cache[cache_key]
            print("♻️ Reusing cached PaddleOCR instance (much faster!)", file=sys.stderr)
        else:
            # Initialize new PaddleOCR instance and cache it
            print(f"🚀 Initializing PaddleOCR with use_gpu={use_gpu}...", file=sys.stderr)
            ocr = PaddleOCR(
                use_angle_cls=False,  # Disable angle classification for faster initialization and processing
                lang=paddle_lang,
                use_gpu=use_gpu,  # Enable GPU acceleration if available
                show_log=False,  # Disable logging to prevent stdout pollution (debug info goes to stderr)
                enable_mkldnn=False,  # Disable MKLDNN for GPU mode (can cause issues)
                cpu_threads=4 if not use_gpu else 1,  # Use fewer threads for GPU mode
                det_model_dir=None,  # Use default models
                rec_model_dir=None,  # Use default models
                cls_model_dir=None  # No angle classification model
            )
            
            # Cache the instance
            _ocr_cache[cache_key] = ocr
            _ocr_cache_key = cache_key
            
            # Verify GPU usage after initialization
            if use_gpu:
                try:
                    # Check if GPU is actually being used
                    import paddle
                    if hasattr(paddle, 'is_compiled_with_cuda'):
                        is_cuda_compiled = paddle.is_compiled_with_cuda()
                        print(f"🔍 PaddlePaddle compiled with CUDA: {is_cuda_compiled}", file=sys.stderr)
                        if is_cuda_compiled:
                            if hasattr(paddle, 'device'):
                                device_count = paddle.device.cuda.device_count()
                                print(f"🎮 CUDA devices available: {device_count}", file=sys.stderr)
                            print("✅ GPU acceleration should be active!", file=sys.stderr)
                        else:
                            print("⚠️ PaddlePaddle not compiled with CUDA - GPU mode may not work", file=sys.stderr)
                except Exception as e:
                    print(f"⚠️ Could not verify GPU status: {e}", file=sys.stderr)
        
        # Check if image exists
        if not os.path.exists(image_path):
            return {
                'success': False,
                'error': f'Image file not found: {image_path}',
                'text_boxes': []
            }

        print(f"📸 Processing image: {image_path}", file=sys.stderr)

        # Run OCR (cls=False since we disabled angle classification)
        result = ocr.ocr(image_path, cls=False)

        # Parse results
        text_boxes = []
        full_text = []

        if result and result[0]:
            for line in result[0]:
                if line:
                    # Extract bounding box and text
                    bbox = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                    text_info = line[1]  # (text, confidence)

                    if bbox and text_info:
                        text = text_info[0]
                        confidence = text_info[1]

                        # Convert bbox to x, y, width, height
                        x1, y1 = bbox[0]
                        x2, y2 = bbox[2]  # Bottom right corner

                        x = min(x1, x2)
                        y = min(y1, y2)
                        width = abs(x2 - x1)
                        height = abs(y2 - y1)

                        text_boxes.append({
                            'text': text,
                            'x': int(x),
                            'y': int(y),
                            'width': int(width),
                            'height': int(height),
                            'confidence': float(confidence)
                        })

                        full_text.append(text)
                        print(f"📝 Found text: '{text}' at ({int(x)}, {int(y)}) confidence: {confidence:.2f}", file=sys.stderr)

        print(f"✅ Found {len(text_boxes)} text boxes", file=sys.stderr)

        return {
            'success': True,
            'text_boxes': text_boxes,
            'full_text': ' '.join(full_text),
            'language': paddle_lang,
            'total_boxes': len(text_boxes)
        }

    except Exception as e:
        print(f"❌ OCR error: {str(e)}", file=sys.stderr)
        return {
            'success': False,
            'error': str(e),
            'text_boxes': []
        }

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python ocr_screen.py <image_path> [language] [use_gpu]'
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    target_language = sys.argv[2] if len(sys.argv) > 2 else 'en'
    use_gpu_arg = sys.argv[3] if len(sys.argv) > 3 else 'false'
    use_gpu = use_gpu_arg.lower() == 'true'
    
    # Debug: Print received arguments
    print(f"📥 Received arguments:", file=sys.stderr)
    print(f"  - image_path: {image_path}", file=sys.stderr)
    print(f"  - target_language: {target_language}", file=sys.stderr)
    print(f"  - use_gpu_arg: '{use_gpu_arg}'", file=sys.stderr)
    print(f"  - use_gpu (parsed): {use_gpu}", file=sys.stderr)

    # Run OCR
    result = run_ocr(image_path, target_language, use_gpu)

    # Flush stderr to ensure all debug output is written before JSON
    sys.stderr.flush()
    
    # Output JSON result with ASCII-safe encoding to prevent Unicode errors
    print(json.dumps(result, ensure_ascii=True, indent=2))

if __name__ == '__main__':
    main()
