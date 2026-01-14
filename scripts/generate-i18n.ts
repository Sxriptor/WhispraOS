#!/usr/bin/env node

/**
 * Generate missing language translations in i18n.ts file using OpenAI API
 * 
 * Usage:
 *   OPENAI_API_KEY=your_key_here npm run generate:i18n
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

// Languages needed
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

// Existing languages in i18n.ts (don't regenerate these)
const EXISTING_LANGUAGES = ['en', 'es', 'ru', 'zh', 'ja'];

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  console.error('   Set it with: OPENAI_API_KEY=your_key_here npm run generate:i18n');
  console.error('   Or create a .env file with OPENAI_API_KEY=your_key_here');
  process.exit(1);
}

const I18N_FILE = path.join(__dirname, '..', 'src', 'renderer', 'i18n.ts');

// Extract English translation object from i18n.ts
function extractEnglishTranslation() {
  try {
    const content = fs.readFileSync(I18N_FILE, 'utf8');
    
    // Find the 'en' translation object
    const enMatch = content.match(/'en':\s*\{([\s\S]*?)\n\s*\},/);
    if (!enMatch) {
      throw new Error('Could not find English translation in i18n.ts');
    }
    
    // Extract the object content
    const enContent = enMatch[1];
    
    // Parse it as JSON (need to wrap it)
    try {
      const jsonStr = '{' + enContent + '}';
      return JSON.parse(jsonStr);
    } catch (e) {
      // If JSON parse fails, try to extract using regex
      // This is a fallback - the structure should be valid JSON-like
      console.warn('Warning: Could not parse as JSON, using regex extraction');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error reading i18n.ts: ${error.message}`);
    process.exit(1);
  }
}

// Translate using OpenAI API
async function translateWithOpenAI(text, targetLanguage, languageName) {
  const openai = require('openai');
  const client = new openai.OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `Translate the following JSON object to ${languageName} (language code: ${targetLanguage}). 
This is for a translation app called "Whispra" UI interface.
Keep the exact same JSON structure and keys. Only translate the string values, not the keys.
Preserve all special characters, placeholders, formatting, and technical terms exactly as they are.
For technical terms like "VB Audio", "Push-to-Talk", "Bidirectional", keep them in English if they are commonly used technical terms.
Return ONLY the JSON object, no explanations, no markdown code blocks, no backticks.

JSON to translate:
${JSON.stringify(text, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
    console.error(`❌ Error translating to ${languageName}:`, error.message);
    throw error;
  }
}

// Convert JSON object to TypeScript object string format
function jsonToTypeScript(obj, indent = 12) {
  const indentStr = ' '.repeat(indent);
  const indentStr2 = ' '.repeat(indent + 4);
  
  if (typeof obj === 'string') {
    return `"${obj.replace(/"/g, '\\"')}"`;
  } else if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  } else if (obj === null) {
    return 'null';
  } else if (Array.isArray(obj)) {
    return '[' + obj.map(item => jsonToTypeScript(item, indent + 4)).join(', ') + ']';
  } else {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    
    const lines = entries.map(([key, value]) => {
      return `${indentStr2}"${key}": ${jsonToTypeScript(value, indent + 4)}`;
    });
    
    return `{\n${lines.join(',\n')}\n${indentStr}}`;
  }
}

// Insert translation into i18n.ts file
function insertTranslation(languageCode, languageName, translationObj) {
  try {
    let content = fs.readFileSync(I18N_FILE, 'utf8');
    
    // Find where to insert (before the closing of translations object, after the last language)
    // Look for the pattern: 'ja': { ... }, and insert before the closing };
    const lastLangMatch = content.match(/(\s*)'ja':\s*\{[\s\S]*?\n\s*\},/);
    
    if (!lastLangMatch) {
      // Try to find any language entry
      const anyLangMatch = content.match(/(\s*)'[a-z]{2}':\s*\{[\s\S]*?\n\s*\},/g);
      if (!anyLangMatch) {
        throw new Error('Could not find where to insert translation');
      }
      // Use the last one
      const lastMatch = anyLangMatch[anyLangMatch.length - 1];
      const insertPos = content.lastIndexOf(lastMatch) + lastMatch.length;
      
      // Generate the new translation entry
      const tsObj = jsonToTypeScript(translationObj);
      const newEntry = `,\n            '${languageCode}': ${tsObj}`;
      
      content = content.slice(0, insertPos) + newEntry + content.slice(insertPos);
    } else {
      // Insert after Japanese
      const insertPos = lastLangMatch.index + lastLangMatch[0].length;
      const tsObj = jsonToTypeScript(translationObj);
      const newEntry = `,\n            '${languageCode}': ${tsObj}`;
      
      content = content.slice(0, insertPos) + newEntry + content.slice(insertPos);
    }
    
    fs.writeFileSync(I18N_FILE, content, 'utf8');
    console.log(`   ✅ Inserted ${languageCode} translation into i18n.ts`);
  } catch (error) {
    console.error(`   ❌ Error inserting ${languageCode}:`, error.message);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting i18n.ts translation generation...\n');

  // Extract English translation
  console.log('📄 Extracting English translation template...');
  const englishTemplate = extractEnglishTranslation();
  
  if (!englishTemplate) {
    console.error('❌ Could not extract English template. The file structure may have changed.');
    process.exit(1);
  }
  
  console.log('✅ Template extracted\n');

  // Find missing languages
  const missingLanguages = Object.entries(LANGUAGES).filter(
    ([code]) => !EXISTING_LANGUAGES.includes(code)
  );

  if (missingLanguages.length === 0) {
    console.log('✅ All languages already exist in i18n.ts!');
    return;
  }

  console.log(`📝 Found ${missingLanguages.length} missing languages:\n`);
  missingLanguages.forEach(([code, name]) => {
    console.log(`   - ${code} (${name})`);
  });
  console.log('');

  // Check if openai package is installed
  try {
    require('openai');
  } catch (error) {
    console.error('❌ Error: openai package not found');
    console.error('   Install it with: npm install openai');
    process.exit(1);
  }

  // Translate and insert each missing language
  let successCount = 0;
  let failCount = 0;

  for (const [code, name] of missingLanguages) {
    try {
      console.log(`🌐 Translating to ${name} (${code})...`);
      const translated = await translateWithOpenAI(englishTemplate, code, name);
      insertTranslation(code, name, translated);
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to generate ${code}:`, error.message);
      failCount++;
    }
    console.log('');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully added: ${successCount} languages`);
  console.log(`   ❌ Failed: ${failCount} languages`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    console.log('⚠️  Some languages failed. You may need to:');
    console.log('   1. Check your OpenAI API key');
    console.log('   2. Check your API quota/credits');
    console.log('   3. Run the script again for failed languages\n');
  } else {
    console.log('🎉 All translations added to i18n.ts successfully!\n');
    console.log('⚠️  Note: Please review the generated code and ensure it compiles correctly.\n');
  }
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

