#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script to verify PaddleOCR can be imported
"""

import sys
import json
import os

def test_paddle_import():
    # Add AppData Paddle folder to Python path for dependencies
    app_data_path = os.path.expanduser('~\\AppData\\Roaming\\whispra\\models\\Paddle')
    if os.path.exists(app_data_path):
        sys.path.insert(0, app_data_path)
        print(f"Added to sys.path: {app_data_path}", file=sys.stderr)
    """Test if PaddleOCR can be imported"""
    try:
        print("Python version:", sys.version, file=sys.stderr)
        print("Python path:", sys.path, file=sys.stderr)

        print("Attempting to import PaddleOCR...", file=sys.stderr)
        from paddleocr import PaddleOCR
        print("✅ PaddleOCR imported successfully!", file=sys.stderr)

        # Try to create an instance
        print("Creating PaddleOCR instance...", file=sys.stderr)
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        print("✅ PaddleOCR instance created successfully!", file=sys.stderr)

        return {
            'success': True,
            'message': 'PaddleOCR is working correctly',
            'python_version': sys.version,
            'available_languages': ['en', 'ch', 'japan', 'korean', 'cyrillic', 'arabic', 'devanagari', 'thai', 'latin']
        }

    except ImportError as e:
        print(f"❌ Import error: {e}", file=sys.stderr)
        return {
            'success': False,
            'error': f'ImportError: {str(e)}',
            'python_version': sys.version,
            'python_path': sys.path
        }
    except Exception as e:
        print(f"❌ General error: {e}", file=sys.stderr)
        return {
            'success': False,
            'error': f'Error: {str(e)}',
            'python_version': sys.version
        }

if __name__ == '__main__':
    result = test_paddle_import()
    print(json.dumps(result, indent=2))