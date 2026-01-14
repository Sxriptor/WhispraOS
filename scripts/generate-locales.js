#!/usr/bin/env node

/**
 * Generate locale JSON files for missing languages using OpenAI API
 * 
 * Usage:
 *   OPENAI_API_KEY=your_key_here npm run generate:locales
 * 
 * Or create a .env file with:
 *   OPENAI_API_KEY=your_key_here
 */

const fs = require('fs');
const path = require('path');

// Try to load .env file if dotenv is available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, that's okay
}

// Languages needed (from profile dropdown)
const LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  tr: 'Turkish',
  pl: 'Polish',
  nl: 'Dutch',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian'
};

// Existing locale files (don't regenerate these)
const EXISTING_LOCALES = ['en', 'es', 'ja', 'zh', 'ru'];

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  console.error('   Set it with: OPENAI_API_KEY=your_key_here node scripts/generate-locales.js');
  console.error('   Or create a .env file with OPENAI_API_KEY=your_key_here');
  process.exit(1);
}

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const TEMPLATE_FILE = path.join(LOCALES_DIR, 'en.json');

// Load the English template
function loadTemplate() {
  try {
    const content = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading template file: ${error.message}`);
    process.exit(1);
  }
}

// Translate using OpenAI API
async function translateWithOpenAI(text, targetLanguage, languageName) {
  const openai = require('openai');
  const client = new openai.OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `Translate the following JSON object to ${languageName} (language code: ${targetLanguage}). 
Keep the exact same JSON structure and keys. Only translate the string values, not the keys.
Preserve all special characters, placeholders, and formatting exactly as they are.
Return ONLY the JSON object, no explanations, no markdown code blocks, no backticks.

JSON to translate:
${JSON.stringify(text, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency (~$0.15 per 1M input tokens)
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate JSON values accurately while preserving structure and formatting. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    });

    let translatedText = response.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    translatedText = translatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(translatedText);
      return parsed;
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = translatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error(`Failed to parse JSON: ${e.message}`);
        }
      }
      throw new Error(`Failed to extract JSON from response: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`❌ Error translating to ${languageName}:`, error.message);
    throw error;
  }
}

// Save locale file
function saveLocaleFile(languageCode, data) {
  const filePath = path.join(LOCALES_DIR, `${languageCode}.json`);
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Created: ${languageCode}.json`);
}

// Main function
async function main() {
  console.log('🚀 Starting locale generation...\n');

  // Load template
  console.log('📄 Loading English template...');
  const template = loadTemplate();
  console.log('✅ Template loaded\n');

  // Find missing languages
  const missingLanguages = Object.entries(LANGUAGES).filter(
    ([code]) => !EXISTING_LOCALES.includes(code)
  );

  if (missingLanguages.length === 0) {
    console.log('✅ All locale files already exist!');
    return;
  }

  console.log(`📝 Found ${missingLanguages.length} missing languages:\n`);
  missingLanguages.forEach(([code, name]) => {
    console.log(`   - ${code} (${name})`);
  });
  console.log('');

  // Check if openai package is installed
  let openai;
  try {
    openai = require('openai');
  } catch (error) {
    console.error('❌ Error: openai package not found');
    console.error('   Install it with: npm install openai');
    process.exit(1);
  }

  // Translate and save each missing language
  let successCount = 0;
  let failCount = 0;

  for (const [code, name] of missingLanguages) {
    try {
      console.log(`🌐 Translating to ${name} (${code})...`);
      const translated = await translateWithOpenAI(template, code, name);
      saveLocaleFile(code, translated);
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Failed to generate ${code}.json:`, error.message);
      failCount++;
    }
    console.log('');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully generated: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('='.repeat(50) + '\n');

  if (failCount > 0) {
    console.log('⚠️  Some files failed to generate. You may need to:');
    console.log('   1. Check your OpenAI API key');
    console.log('   2. Check your API quota/credits');
    console.log('   3. Run the script again for failed languages\n');
  }
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

