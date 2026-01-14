#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Persistent PaddleOCR service - stays alive between OCR requests
Communicates via JSON stdin/stdout
"""

import sys
import json
import os
from pathlib import Path

# Add AppData Paddle folders to Python path for dependencies
app_data_path = os.path.expanduser('~\\AppData\\Roaming\\whispra\\models\\Paddle')
gpu_paddle_path = os.path.expanduser('~\\AppData\\Roaming\\whispra\\models\\Paddle\\gpu')

# Global OCR instance cache - persists for the lifetime of this process
_ocr_cache = {}

def get_cache_key(language, use_gpu):
    """Generate cache key for OCR instance"""
    return f"{language}_{use_gpu}"

def initialize_ocr(language, use_gpu):
    """Initialize PaddleOCR instance or return cached one"""
    cache_key = get_cache_key(language, use_gpu)
    
    if cache_key in _ocr_cache:
        print(f"♻️ Reusing cached OCR instance for {cache_key}", file=sys.stderr)
        return _ocr_cache[cache_key]
    
    # Setup Python paths
    sys.path = [p for p in sys.path if 'Paddle' not in p]
    
    if use_gpu and os.path.exists(gpu_paddle_path):
        sys.path.insert(0, gpu_paddle_path)
        if os.path.exists(app_data_path):
            sys.path.insert(1, app_data_path)
    else:
        if os.path.exists(app_data_path):
            sys.path.insert(0, app_data_path)
        if os.path.exists(gpu_paddle_path):
            sys.path.insert(1, gpu_paddle_path)
    
    # Import PaddleOCR
    try:
        from paddleocr import PaddleOCR
        print(f"🚀 Initializing PaddleOCR (language={language}, use_gpu={use_gpu})...", file=sys.stderr)
        
        ocr = PaddleOCR(
            use_angle_cls=False,  # Disable angle classification for faster processing
            lang=language,
            use_gpu=use_gpu,
            show_log=False,
            enable_mkldnn=False,
            cpu_threads=4 if not use_gpu else 1
        )
        
        # Cache the instance
        _ocr_cache[cache_key] = ocr
        print(f"✅ OCR instance cached for {cache_key}", file=sys.stderr)
        
        # Verify GPU if enabled
        if use_gpu:
            try:
                import paddle
                if hasattr(paddle, 'is_compiled_with_cuda') and paddle.is_compiled_with_cuda():
                    device_count = paddle.device.cuda.device_count() if hasattr(paddle.device, 'cuda') else 0
                    print(f"🎮 GPU available: {device_count} devices", file=sys.stderr)
            except:
                pass
        
        return ocr
    except Exception as e:
        print(f"❌ Failed to initialize OCR: {e}", file=sys.stderr)
        raise

def run_ocr(image_path, target_language='en', use_gpu=False):
    """Run OCR on the given image"""
    try:
        # Map language codes
        lang_map = {
            'en': 'en', 'zh': 'ch', 'ja': 'japan', 'ko': 'korean',
            'ru': 'cyrillic', 'ar': 'arabic', 'hi': 'devanagari',
            'th': 'thai', 'es': 'latin', 'fr': 'latin', 'de': 'latin',
            'it': 'latin', 'pt': 'latin'
        }
        paddle_lang = lang_map.get(target_language, 'en')
        
        # Get or create OCR instance
        ocr = initialize_ocr(paddle_lang, use_gpu)
        
        # Check if image exists
        if not os.path.exists(image_path):
            return {
                'success': False,
                'error': f'Image file not found: {image_path}',
                'text_boxes': []
            }
        
        # Run OCR
        result = ocr.ocr(image_path, cls=False)
        
        # Parse results
        text_boxes = []
        full_text = []
        
        if result and result[0]:
            for line in result[0]:
                if line:
                    bbox = line[0]
                    text_info = line[1]
                    
                    if bbox and text_info:
                        text = text_info[0]
                        confidence = text_info[1]
                        
                        x1, y1 = bbox[0]
                        x2, y2 = bbox[2]
                        
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
    """Main service loop - reads JSON commands from stdin"""
    print("🔄 PaddleOCR persistent service started", file=sys.stderr)
    
    try:
        # Read commands from stdin line by line
        for line in sys.stdin:
            if not line.strip():
                continue
            
            try:
                command = json.loads(line.strip())
                cmd_type = command.get('type')
                
                if cmd_type == 'ocr':
                    # Run OCR
                    result = run_ocr(
                        command.get('image_path'),
                        command.get('language', 'en'),
                        command.get('use_gpu', False)
                    )
                    # Output result as JSON
                    print(json.dumps(result, ensure_ascii=True))
                    sys.stdout.flush()
                    
                elif cmd_type == 'ping':
                    # Health check
                    print(json.dumps({'success': True, 'type': 'pong'}))
                    sys.stdout.flush()
                    
                elif cmd_type == 'shutdown':
                    # Cleanup and exit
                    print("🛑 Shutting down OCR service...", file=sys.stderr)
                    break
                    
            except json.JSONDecodeError as e:
                print(json.dumps({
                    'success': False,
                    'error': f'Invalid JSON: {e}'
                }))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({
                    'success': False,
                    'error': str(e)
                }))
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        print("🛑 Service interrupted", file=sys.stderr)
    except Exception as e:
        print(f"❌ Service error: {e}", file=sys.stderr)
    finally:
        print("🔄 PaddleOCR service stopped", file=sys.stderr)

if __name__ == '__main__':
    main()

