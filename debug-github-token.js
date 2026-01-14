/**
 * Debug script to analyze GitHub JWT token structure
 * This will help identify what fields are available in the GitHub auth token
 */

const fs = require('fs');
const path = require('path');

function analyzeJWT(token) {
  try {
    console.log('🔍 Analyzing JWT token...');
    console.log('Token length:', token.length);
    
    const parts = token.split('.');
    console.log('Token parts:', parts.length);
    
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format - expected 3 parts, got', parts.length);
      return null;
    }
    
    // Decode header
    const header = JSON.parse(atob(parts[0]));
    console.log('📋 JWT Header:', JSON.stringify(header, null, 2));
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    console.log('📋 JWT Payload fields:', Object.keys(payload));
    console.log('📋 JWT Payload (sanitized):');
    
    // Show payload structure without sensitive data
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        sanitized[key] = `<string:${value.length}chars>`;
      } else if (typeof value === 'number') {
        sanitized[key] = `<number:${value}>`;
      } else if (typeof value === 'boolean') {
        sanitized[key] = `<boolean:${value}>`;
      } else if (Array.isArray(value)) {
        sanitized[key] = `<array:${value.length}items>`;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = `<object:${Object.keys(value).length}keys>`;
      } else {
        sanitized[key] = `<${typeof value}>`;
      }
    }
    
    console.log(JSON.stringify(sanitized, null, 2));
    
    // Check for common user ID fields
    const userIdFields = ['sub', 'user_id', 'id', 'userId', 'uid', 'github_id', 'user', 'login'];
    const foundUserIdFields = userIdFields.filter(field => payload.hasOwnProperty(field));
    
    console.log('🔍 User ID field analysis:');
    console.log('  Available user ID fields:', foundUserIdFields);
    console.log('  Missing user ID fields:', userIdFields.filter(f => !foundUserIdFields.includes(f)));
    
    // Check for email
    const emailFields = ['email', 'user_email', 'mail'];
    const foundEmailFields = emailFields.filter(field => payload.hasOwnProperty(field));
    console.log('  Available email fields:', foundEmailFields);
    
    return {
      header,
      payload,
      availableFields: Object.keys(payload),
      userIdFields: foundUserIdFields,
      emailFields: foundEmailFields
    };
    
  } catch (error) {
    console.error('❌ Error analyzing JWT:', error);
    return null;
  }
}

// Test with a sample GitHub JWT token structure
console.log('🧪 Testing GitHub JWT token analysis...');
console.log('This script will help identify what fields are available in GitHub auth tokens');
console.log('');

// Instructions for user
console.log('📝 To use this script:');
console.log('1. Sign in to your app and trigger the error');
console.log('2. The error report will show token details');
console.log('3. We can then update the TokenUtils to handle GitHub-specific fields');
console.log('');

// Example of what GitHub JWT might contain
const exampleGitHubPayload = {
  "iss": "https://github.com/login/oauth",
  "sub": "github|12345678",
  "aud": "your-app-id",
  "exp": 1234567890,
  "iat": 1234567890,
  "login": "username",
  "id": 12345678,
  "node_id": "MDQ6VXNlcjEyMzQ1Njc4",
  "avatar_url": "https://avatars.githubusercontent.com/u/12345678?v=4",
  "gravatar_id": "",
  "url": "https://api.github.com/users/username",
  "html_url": "https://github.com/username",
  "type": "User",
  "site_admin": false,
  "name": "User Name",
  "company": null,
  "blog": "",
  "location": null,
  "email": "user@example.com",
  "hireable": null,
  "bio": null,
  "twitter_username": null,
  "public_repos": 10,
  "public_gists": 0,
  "followers": 5,
  "following": 10,
  "created_at": "2020-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
};

console.log('📋 Example GitHub JWT payload structure:');
analyzeJWT(btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + 
          btoa(JSON.stringify(exampleGitHubPayload)) + '.' + 
          'signature');

module.exports = { analyzeJWT };