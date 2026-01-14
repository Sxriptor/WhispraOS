/**
 * Script to download LanguageTool and its dependencies
 * This script uses Maven to download LanguageTool server and all language modules
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GRAMMAR_DIR = path.join(__dirname, '..', 'resources', 'engines', 'grammar');
const LIBS_DIR = path.join(GRAMMAR_DIR, 'libs');
const TEMP_DIR = path.join(__dirname, '..', 'temp-languagetool-setup');

// LanguageTool version to download
const LANGUAGETOOL_VERSION = '6.4'; // Update this to the latest version

console.log('🔧 Setting up LanguageTool...');
console.log(`📦 Target directory: ${GRAMMAR_DIR}`);
console.log(`📚 Libs directory: ${LIBS_DIR}`);

// Check if Maven is available
function checkMaven() {
  try {
    execSync('mvn --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Create temporary Maven project to download dependencies
function createTempMavenProject() {
  console.log('📝 Creating temporary Maven project...');
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.whispra</groupId>
    <artifactId>languagetool-downloader</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <repositories>
        <repository>
            <id>central</id>
            <url>https://repo1.maven.org/maven2</url>
        </repository>
    </repositories>
    
    <dependencies>
        <!-- LanguageTool Server -->
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-server</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        
        <!-- Language modules - add more as needed -->
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-en</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-es</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-fr</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-de</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-pt</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-it</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-ru</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-ja</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
        <dependency>
            <groupId>org.languagetool</groupId>
            <artifactId>languagetool-language-zh</artifactId>
            <version>${LANGUAGETOOL_VERSION}</version>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-dependency-plugin</artifactId>
                <version>3.6.0</version>
                <executions>
                    <execution>
                        <id>copy-dependencies</id>
                        <phase>package</phase>
                        <goals>
                            <goal>copy-dependencies</goal>
                        </goals>
                        <configuration>
                            <outputDirectory>\${project.build.directory}/libs</outputDirectory>
                            <includeScope>runtime</includeScope>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>`.replace(/\${LANGUAGETOOL_VERSION}/g, LANGUAGETOOL_VERSION);

  fs.writeFileSync(path.join(TEMP_DIR, 'pom.xml'), pomXml);
  console.log('✅ Maven pom.xml created');
}

// Download dependencies using Maven
function downloadDependencies() {
  console.log('📥 Downloading LanguageTool dependencies via Maven...');
  console.log('⏳ This may take a few minutes...');
  
  try {
    execSync('mvn dependency:copy-dependencies', {
      cwd: TEMP_DIR,
      stdio: 'inherit'
    });
    console.log('✅ Dependencies downloaded');
  } catch (error) {
    console.error('❌ Failed to download dependencies');
    throw error;
  }
}

// Copy JARs to libs directory
function copyJars() {
  console.log('📋 Copying JARs to libs directory...');
  
  const mavenLibsDir = path.join(TEMP_DIR, 'target', 'dependency');
  
  if (!fs.existsSync(mavenLibsDir)) {
    throw new Error(`Maven libs directory not found: ${mavenLibsDir}`);
  }

  // Ensure libs directory exists
  if (!fs.existsSync(LIBS_DIR)) {
    fs.mkdirSync(LIBS_DIR, { recursive: true });
  }

  // Copy all JARs
  const jars = fs.readdirSync(mavenLibsDir).filter(file => file.endsWith('.jar'));
  console.log(`📦 Found ${jars.length} JAR files`);
  
  for (const jar of jars) {
    const source = path.join(mavenLibsDir, jar);
    const dest = path.join(LIBS_DIR, jar);
    fs.copyFileSync(source, dest);
    console.log(`  ✓ ${jar}`);
  }
  
  console.log(`✅ Copied ${jars.length} JAR files to ${LIBS_DIR}`);
}

// Find and copy the server JAR
function copyServerJar() {
  console.log('🔍 Looking for LanguageTool server JAR...');
  
  const serverJarPatterns = [
    'languagetool-server-*.jar',
    'languagetool-server.jar'
  ];
  
  const mavenLibsDir = path.join(TEMP_DIR, 'target', 'dependency');
  const jars = fs.readdirSync(mavenLibsDir);
  
  const serverJar = jars.find(jar => jar.includes('languagetool-server'));
  
  if (!serverJar) {
    throw new Error('LanguageTool server JAR not found');
  }
  
  const source = path.join(mavenLibsDir, serverJar);
  const dest = path.join(GRAMMAR_DIR, 'grammar-core.jar');
  
  fs.copyFileSync(source, dest);
  console.log(`✅ Copied server JAR: ${serverJar} → grammar-core.jar`);
}

// Cleanup temporary files
function cleanup() {
  console.log('🧹 Cleaning up temporary files...');
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('✅ Cleanup complete');
  }
}

// Main execution
async function main() {
  try {
    // Check if Maven is available
    if (!checkMaven()) {
      console.error('❌ Maven is not installed or not in PATH');
      console.error('📖 Please install Maven from: https://maven.apache.org/download.cgi');
      console.error('\nAlternatively, you can:');
      console.error('1. Build LanguageTool from source (see README.md)');
      console.error('2. Download a pre-built release that includes lib/ folder');
      process.exit(1);
    }
    
    // Create temp Maven project
    createTempMavenProject();
    
    // Download dependencies
    downloadDependencies();
    
    // Copy JARs
    copyJars();
    
    // Copy server JAR
    copyServerJar();
    
    // Cleanup
    cleanup();
    
    console.log('\n✅ LanguageTool setup complete!');
    console.log(`📁 Server JAR: ${path.join(GRAMMAR_DIR, 'grammar-core.jar')}`);
    console.log(`📚 Libs directory: ${LIBS_DIR}`);
    console.log('\n🔍 Verifying language modules...');
    
    const languageJars = fs.readdirSync(LIBS_DIR)
      .filter(file => file.includes('languagetool-language-'));
    
    if (languageJars.length > 0) {
      console.log(`✅ Found ${languageJars.length} language module(s):`);
      languageJars.forEach(jar => console.log(`   - ${jar}`));
    } else {
      console.warn('⚠️  No language modules found!');
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n💡 Alternative options:');
    console.error('1. Install Maven and try again');
    console.error('2. Build LanguageTool from source');
    console.error('3. Manually download and extract LanguageTool release');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

