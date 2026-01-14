#!/usr/bin/env node

/**
 * Generate all locale JSON files (bidi, overlay, settings, sb, trans) for missing languages using OpenAI API
 * 
 * Usage:
 *   OPENAI_API_KEY=your_key_here npm run generate:all-locales
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

// Locale file types to generate
const LOCALE_TYPES = [
  { prefix: 'bidi', name: 'Bidirectional' },
  { prefix: 'overlay', name: 'Overlay' },
  { prefix: 'settings', name: 'Settings' },
  { prefix: 'sb', name: 'Soundboard' },
  { prefix: 'trans', name: 'Translation' }
];

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  console.error('   Set it with: OPENAI_API_KEY=your_key_here npm run generate:all-locales');
  console.error('   Or create a .env file with OPENAI_API_KEY=your_key_here');
  process.exit(1);
}

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');

// Load template file
function loadTemplate(filePrefix) {
  const templateFile = path.join(LOCALES_DIR, `${filePrefix}-en.json`);
  try {
    const content = fs.readFileSync(templateFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading template file ${filePrefix}-en.json: ${error.message}`);
    return null;
  }
}

// Check if file already exists
function fileExists(filePrefix, languageCode) {
  const filePath = path.join(LOCALES_DIR, `${filePrefix}-${languageCode}.json`);
  return fs.existsSync(filePath);
}

// Translate using OpenAI API
async function translateWithOpenAI(text, targetLanguage, languageName, fileType) {
  const openai = require('openai');
  const client = new openai.OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `Translate the following JSON object to ${languageName} (language code: ${targetLanguage}). 
This is for a ${fileType} interface in a translation app called "Whispra".
Keep the exact same JSON structure and keys. Only translate the string values, not the keys.
Preserve all special characters, placeholders, formatting, and technical terms exactly as they are.
For technical terms like "VB Audio", "Push-to-Talk", "Bidirectional", keep them in English if they are commonly used technical terms.
Return ONLY the JSON object, no explanations, no markdown code blocks, no backticks.

JSON to translate:
${JSON.stringify(text, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator specializing in software UI translations. Translate JSON values accurately while preserving structure, formatting, and technical terms. Return only valid JSON.'
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
    console.error(`❌ Error translating ${fileType} to ${languageName}:`, error.message);
    throw error;
  }
}

// Save locale file
function saveLocaleFile(filePrefix, languageCode, data) {
  const filePath = path.join(LOCALES_DIR, `${filePrefix}-${languageCode}.json`);
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   ✅ Created: ${filePrefix}-${languageCode}.json`);
}

// Generate locale files for a specific type
async function generateLocaleType(filePrefix, fileTypeName, missingLanguages) {
  console.log(`\n📄 Processing ${fileTypeName} files...`);
  
  // Load template
  const template = loadTemplate(filePrefix);
  if (!template) {
    console.log(`   ⚠️  Skipping ${fileTypeName} - template not found`);
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  for (const [code, name] of missingLanguages) {
    // Skip if file already exists
    if (fileExists(filePrefix, code)) {
      console.log(`   ⏭️  Skipping ${filePrefix}-${code}.json (already exists)`);
      continue;
    }

    try {
      console.log(`   🌐 Translating ${fileTypeName} to ${name} (${code})...`);
      const translated = await translateWithOpenAI(template, code, name, fileTypeName);
      saveLocaleFile(filePrefix, code, translated);
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Failed to generate ${filePrefix}-${code}.json:`, error.message);
      failCount++;
    }
  }

  return { success: successCount, failed: failCount };
}

// Main function
async function main() {
  console.log('🚀 Starting locale generation for all file types...\n');

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

  // Check if openai package is installed
  try {
    require('openai');
  } catch (error) {
    console.error('❌ Error: openai package not found');
    console.error('   Install it with: npm install openai');
    process.exit(1);
  }

  // Generate all locale types
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const localeType of LOCALE_TYPES) {
    const result = await generateLocaleType(
      localeType.prefix,
      localeType.name,
      missingLanguages
    );
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully generated: ${totalSuccess} files`);
  console.log(`   ❌ Failed: ${totalFailed} files`);
  console.log(`   📁 Total file types: ${LOCALE_TYPES.length}`);
  console.log(`   🌍 Languages processed: ${missingLanguages.length}`);
  console.log('='.repeat(60) + '\n');

  if (totalFailed > 0) {
    console.log('⚠️  Some files failed to generate. You may need to:');
    console.log('   1. Check your OpenAI API key');
    console.log('   2. Check your API quota/credits');
    console.log('   3. Run the script again for failed files\n');
  } else {
    console.log('🎉 All locale files generated successfully!\n');
  }
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

