import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Load configuration from a YAML file
 * 
 * @param {string} configPath - Path to the config file
 * @returns {Promise<Object>} Parsed configuration
 */
export async function loadConfig(configPath) {
  try {
    // Use absolute path if relative path is provided
    let resolvedPath = configPath;
    if (!path.isAbsolute(configPath)) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      resolvedPath = path.resolve(process.cwd(), configPath);
    }
    
    // Read and parse the config file
    const configFile = await fs.promises.readFile(resolvedPath, 'utf8');
    const config = yaml.load(configFile);
    
    // Handle different sections in the config
    if (config.confluence) {
      return config.confluence;
    }
    
    return config;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a sample configuration file
 * 
 * @param {string} configPath - Path to save the config file
 * @returns {Promise<void>}
 */
export async function createSampleConfig(configPath) {
  const sampleConfig = `# Scrapr Configuration File

# Confluence scraping configuration
confluence:
  # Required settings
  spaceId: TEAM            # Confluence space ID to scrape
  baseUrl: https://example.atlassian.net/wiki  # Base URL of Confluence instance
  
  # Optional settings
  output: ./confluence-output   # Output directory for JSON files
  concurrency: 5               # Number of concurrent requests
  stripHtml: true             # Whether to strip HTML from content
  
  # Authentication (recommended to use environment variables instead)
  # username: your-username@example.com
  # token: your-api-token
`;

  try {
    await fs.promises.writeFile(configPath, sampleConfig, 'utf8');
    console.log(`Created sample configuration file at ${configPath}`);
  } catch (error) {
    console.error(`Failed to create sample config: ${error.message}`);
    throw error;
  }
}