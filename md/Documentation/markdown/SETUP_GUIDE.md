# 🚀 Quick Setup Guide

## The Issue You're Experiencing

The error "All translation providers failed" means the API keys aren't configured properly. Let's fix this step by step.

## ✅ Step 1: Get Your API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to "API Keys" section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

### ElevenLabs API Key
1. Go to https://elevenlabs.io/
2. Sign up or log in
3. Go to your profile settings
4. Find "API Key" section
5. Copy the key (32-character hex string)

## ✅ Step 2: Configure the Application

1. **Launch the app:**
   ```bash
   npm run dev:simple
   ```

2. **Open Settings:**
   - Click the "⚙️ Settings" button in the app

3. **Enter API Keys:**
   - Paste your OpenAI API key in the first field
   - Paste your ElevenLabs API key in the second field
   - Click "Save Settings"

4. **Verify Configuration:**
   - The debug console should show "API keys configured"
   - If not, check the console for error messages

## ✅ Step 3: Test the System

1. **Select Devices:**
   - Choose a microphone from the dropdown
   - Select a target language (e.g., Spanish, Russian)
   - Pick a voice for output

2. **Test Translation:**
   - Click "🧪 Test Translation"
   - You should hear translated audio in your headphones
   - Check debug console for detailed logs

3. **Test Microphone:**
   - Click "🎧 Hear Yourself"
   - Speak for 3 seconds, then hear playback

4. **Test Virtual Microphone:**
   - Click "📢 Test Virtual Mic"
   - This sends audio to virtual microphone for other apps

## 🐛 Troubleshooting

### "All translation providers failed"
- **Cause**: API keys not configured or invalid
- **Solution**: 
  1. Check API keys in settings
  2. Verify keys are correct (no extra spaces)
  3. Check API account has credits/quota

### "Audio playback error"
- **Cause**: Browser audio permissions or codec issues
- **Solution**:
  1. Allow microphone access when prompted
  2. Check system audio settings
  3. Try different browser if using web version

### Debug Console Shows Errors
- **Enable Debug Console**: Click "Show Debug Console" at bottom
- **Look for specific errors**: API key validation, network issues, etc.
- **Check API quotas**: Ensure you have credits in OpenAI/ElevenLabs accounts

## 🎯 Expected Behavior

When working correctly, you should see:

```
[Time] API keys configured
[Time] Testing translation pipeline...
[Time] Translating "Hello, this is a test" to es
[Time] Translation result: "Hola, esto es una prueba"
[Time] Synthesizing speech with voice: adam
[Time] TTS synthesis complete: 45678 bytes
[Time] Audio playback initiated
[Time] ✅ Test completed successfully
```

## 🔧 Manual Debug

If issues persist, run the debug script:

```bash
node debug-api-keys.js
```

This will show exactly what's happening with your configuration.

## 💡 Quick Fixes

1. **Restart the app** after configuring API keys
2. **Check internet connection** for API calls
3. **Verify API account status** (not suspended, has credits)
4. **Try different voice** if TTS fails
5. **Check browser permissions** for microphone access

Once API keys are properly configured, the translation should work perfectly! 🎉