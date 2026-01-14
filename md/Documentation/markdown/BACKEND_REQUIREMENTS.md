# Managed API Backend Requirements

## Overview

This document outlines the backend API requirements for implementing a Managed API service. The backend proxies API requests to external AI services (OpenAI, ElevenLabs, etc.) while tracking usage and enforcing limits.

**Note:** This is a reference architecture. You must deploy your own backend and configure your own API keys, database, and billing system.

## Base URL

Configure your backend URL via environment variable:

```
MANAGED_API_URL=https://your-api-domain.com/v1/api
```

## Authentication

All requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <user_jwt_token>
```

The backend should validate the JWT token and extract the user ID for usage tracking and subscription validation.

## API Endpoints

### 1. OpenAI Proxy Endpoints

#### POST /openai/chat/completions

Proxy OpenAI chat completions API for translation services.

**Request Format:**
```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a translator..."
    },
    {
      "role": "user", 
      "content": "Translate the following..."
    }
  ],
  "max_tokens": 1000,
  "temperature": 0.3
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "choices": [
      {
        "message": {
          "content": "Translated text"
        }
      }
    ]
  },
  "usage": {
    "cost": 0.002,
    "totalCost": 8.45,
    "remainingBalance": 1.55,
    "isLimitExceeded": false,
    "billingPeriodEnd": "2024-02-01T00:00:00Z"
  }
}
```

#### POST /openai/audio/transcriptions

Proxy OpenAI Whisper transcription API.

**Request Format:**
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: Audio file (required)
  - `model`: Model name (default: "whisper-1")
  - `language`: Language code (optional)
  - `prompt`: Transcription prompt (optional)
  - `response_format`: Response format (default: "verbose_json")
  - `temperature`: Temperature (default: 0)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "text": "Transcribed text",
    "language": "en",
    "duration": 2.5,
    "segments": [...]
  },
  "usage": {
    "cost": 0.006,
    "totalCost": 8.456,
    "remainingBalance": 1.544,
    "isLimitExceeded": false,
    "billingPeriodEnd": "2024-02-01T00:00:00Z"
  }
}
```

### 2. ElevenLabs Proxy Endpoints

#### POST /elevenlabs/text-to-speech/{voiceId}

Proxy ElevenLabs text-to-speech API.

**Request Format:**
```json
{
  "text": "Text to synthesize",
  "model_id": "eleven_v3",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.5,
    "style": 0.0,
    "use_speaker_boost": true
  }
}
```

**Response Format:**
```json
{
  "success": true,
  "data": "<base64_encoded_audio_data>",
  "usage": {
    "cost": 0.02,
    "totalCost": 8.476,
    "remainingBalance": 1.524,
    "isLimitExceeded": false,
    "billingPeriodEnd": "2024-02-01T00:00:00Z"
  }
}
```

### 3. Usage Management Endpoints

#### GET /usage/current

Get current usage statistics for the authenticated user.

**Response Format:**
```json
{
  "totalCost": 8.45,
  "remainingBalance": 1.55,
  "billingPeriodStart": "2024-01-01T00:00:00Z",
  "billingPeriodEnd": "2024-02-01T00:00:00Z",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "isLimitExceeded": false,
  "breakdown": {
    "openai": {
      "cost": 5.20,
      "requests": 150
    },
    "elevenlabs": {
      "cost": 3.25,
      "requests": 45
    }
  }
}
```

### 4. Subscription Management Endpoints

#### GET /subscription/status

Check subscription status and managed API access for the authenticated user.

**Response Format:**
```json
{
  "hasAccess": true,
  "subscriptionActive": true,
  "planName": "pro",
  "expiresAt": "2024-02-01T00:00:00Z"
}
```

## Error Responses

All error responses should follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "additional": "context"
  }
}
```

### Error Codes

- `USAGE_LIMIT_EXCEEDED` (429) - Monthly usage limit reached
- `SUBSCRIPTION_REQUIRED` (403) - No active managed API subscription
- `SUBSCRIPTION_EXPIRED` (403) - Subscription expired
- `AUTHENTICATION_FAILED` (401) - Invalid or expired JWT token
- `RATE_LIMITED` (429) - Too many requests
- `INVALID_REQUEST` (400) - Malformed request
- `SERVICE_UNAVAILABLE` (503) - Upstream API unavailable

## Database Schema (Reference)

These are example schemas. Adapt to your database system and requirements.

### Usage Tracking Table

```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  service VARCHAR(20) NOT NULL, -- 'openai', 'elevenlabs', etc.
  endpoint VARCHAR(100) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  cost DECIMAL(10,6) NOT NULL,
  billing_period DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_user_period ON api_usage(user_id, billing_period);
CREATE INDEX idx_usage_created ON api_usage(created_at);
```

### Usage Summary Table

```sql
CREATE TABLE api_usage_summary (
  user_id UUID NOT NULL REFERENCES users(id),
  billing_period DATE NOT NULL,
  total_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  openai_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  elevenlabs_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (user_id, billing_period)
);
```

### Subscription Plans Table

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  managed_api_access BOOLEAN DEFAULT FALSE,
  usage_limit DECIMAL(10,2) DEFAULT NULL, -- NULL = unlimited
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Implementation Requirements

### 1. Authentication & Authorization

- Validate JWT tokens on every request
- Extract user ID from token payload
- Check if user has active subscription with managed API access
- Return 401 for invalid tokens, 403 for insufficient access

### 2. Usage Tracking

- Track every API request with cost calculation
- Update usage summary in real-time
- Enforce configurable monthly limits per user
- Reset usage at billing period boundaries
- Store detailed logs for billing and analytics

### 3. Cost Calculation

Implement cost calculation based on current API pricing. Refer to official documentation:
- [OpenAI Pricing](https://openai.com/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)

### 4. Rate Limiting

- Implement per-user rate limiting to prevent abuse
- Configurable limits (requests per minute/hour)
- Return 429 status code when limits exceeded

### 5. Proxy Logic

- Forward requests to upstream APIs
- Use your API keys for upstream requests
- Handle upstream rate limits and errors gracefully
- Implement retry logic with exponential backoff
- Return consistent response format

## Environment Variables

```bash
# API Keys (your own keys)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Database
DATABASE_URL=postgresql://...

# Auth Provider (configure for your provider)
AUTH_PROVIDER_URL=https://...
AUTH_SECRET=...

# Rate Limiting (optional)
REDIS_URL=redis://...

# Monitoring (optional)
SENTRY_DSN=...
LOG_LEVEL=info

# Usage Limits (configure as needed)
MONTHLY_USAGE_LIMIT=10.00
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_PER_HOUR=1000
```

## CORS Configuration

The desktop application expects these response headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

## Security Considerations

- Validate all input data
- Sanitize file uploads (audio files)
- Implement request size limits
- Use HTTPS only
- Store API keys securely (environment variables/secrets manager)
- Implement CORS policies appropriately
- Never expose upstream API keys to clients

## Deployment

This is a reference architecture. You are responsible for:

1. Deploying your own backend service
2. Configuring your own database
3. Setting up your own authentication provider
4. Managing your own API keys
5. Implementing your own billing system (if needed)

### Suggested Stack

- **Runtime**: Node.js, Python, Go, or your preferred language
- **Database**: PostgreSQL, MySQL, or any SQL database
- **Cache**: Redis (for rate limiting)
- **Deployment**: Docker, Kubernetes, or serverless

## Client Configuration

Configure the desktop app to use your backend by setting environment variables:

```bash
MANAGED_API_URL=https://your-api.example.com/v1/api
MANAGED_API_WS_URL=wss://your-api.example.com/v1/ws
```

See `OPEN_SOURCE_SETUP.md` for complete configuration instructions.
