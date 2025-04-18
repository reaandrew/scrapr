#!/usr/bin/env node
import { Command } from 'commander';
import { scrapeUrl } from './scraper.js';
import { scrapeConfluence } from './confluence.js';
import { loadConfig, createSampleConfig } from './config.js';
import path from 'path';
import fs from 'fs';

// Create the main program
const program = new Command();

program
  .name('scrapr')
  .description('A CLI tool for web scraping')
  .version('0.0.0-development');

// Define the scrape command (default)
program
  .command('scrape', { isDefault: true })
  .description('Scrape a web page and optionally download resources')
  .argument('<url>', 'URL to scrape')
  .option('-d, --download <dir>', 'Download resources to specified directory')
  .option('-e, --extensions <list>', 'Comma-separated list of extensions to download', val => val.split(','))
  .option('-c, --concurrency <num>', 'Number of concurrent downloads', parseInt, 5)
  .action(async (url, options) => {
    try {
      console.log(`Scraping ${url}...`);
      console.log('This may take a while depending on the page size and number of resources...');
      
      const scrapeOptions = {};
      
      if (options.download) {
        console.log(`Will download resources to: ${options.download}`);
        scrapeOptions.downloadResources = options.download;
        
        // Set concurrency limit for parallel downloads
        scrapeOptions.concurrencyLimit = options.concurrency;
        console.log(`Using concurrency level: ${options.concurrency} parallel downloads`);
        
        if (options.extensions && options.extensions.length > 0) {
          console.log(`Filtering for extensions: ${options.extensions.join(', ')}`);
          scrapeOptions.resourceExtensions = options.extensions;
        } else {
          console.log('Will download all resource types');
        }
      }
      
      const result = await scrapeUrl(url, scrapeOptions);
      
      if (options.download) {
        // If we're downloading resources, write the HTML to a file too
        const outputDir = options.download;
        await fs.promises.mkdir(outputDir, { recursive: true });
        
        // Write HTML to file
        const htmlPath = path.join(outputDir, 'page.html');
        await fs.promises.writeFile(htmlPath, result.html);
        console.log(`HTML saved to: ${htmlPath}`);
        
        // Show download results
        const successful = result.resources.filter(r => r.success).length;
        const failed = result.resources.filter(r => !r.success).length;
        console.log(`Downloaded ${successful} resources (${failed} failed)`);
        
        // Group resources by extension
        const byExtension = {};
        for (const resource of result.resources) {
          if (resource.success) {
            const ext = resource.extension;
            byExtension[ext] = (byExtension[ext] || 0) + 1;
          }
        }
        
        console.log('Resources by extension:');
        for (const [ext, count] of Object.entries(byExtension)) {
          console.log(`  ${ext}: ${count}`);
        }
      } else {
        // Just print the HTML
        console.log(result);
      }
    } catch (error) {
      console.error('Error during scraping:', error.message);
      process.exit(1);
    }
  });

// Define the confluence command
program
  .command('confluence')
  .description('Scrape Confluence pages and store as JSON')
  .option('-s, --space-id <id>', 'Confluence space ID to scrape')
  .option('-b, --base-url <url>', 'Base URL of Confluence instance')
  .option('-o, --output <dir>', 'Output directory for JSON files', './output')
  .option('-u, --username <user>', 'Confluence username (for authentication)')
  .option('-t, --token <token>', 'API token for authentication')
  .option('-c, --concurrency <num>', 'Number of concurrent requests', parseInt, 5)
  .option('-f, --config <file>', 'Path to config file', './scrapr.config.yml')
  .action(async (options) => {
    try {
      // Try to load config file if it exists
      let configOptions = {};
      if (options.config) {
        try {
          configOptions = await loadConfig(options.config);
          console.log(`Loaded configuration from ${options.config}`);
        } catch (configError) {
          // Only show warning if the default config file doesn't exist
          if (options.config !== './scrapr.config.yml' || configError.code !== 'ENOENT') {
            console.warn(`Warning: Could not load config file: ${configError.message}`);
          }
        }
      }
      
      // Merge config with command line options (command line takes precedence)
      const mergedOptions = {
        ...configOptions,
        ...options,
      };
      
      // Check if required options are present after merging
      if (!mergedOptions.spaceId) {
        console.error('Error: Space ID is required. Provide it with --space-id or in the config file.');
        process.exit(1);
      }
      
      if (!mergedOptions.baseUrl) {
        console.error('Error: Base URL is required. Provide it with --base-url or in the config file.');
        process.exit(1);
      }
      
      console.log(`Scraping Confluence space: ${mergedOptions.spaceId} from ${mergedOptions.baseUrl}...`);
      console.log('This may take a while depending on the space size and number of pages...');
      
      if (mergedOptions.stripHtml) {
        console.log('HTML stripping is enabled - content will be converted to plain text');
      }
      
      const confluenceOptions = {
        baseUrl: mergedOptions.baseUrl,
        spaceId: mergedOptions.spaceId,
        outputDir: mergedOptions.output,
        concurrencyLimit: mergedOptions.concurrency,
        stripHtml: mergedOptions.stripHtml,
      };
      
      // Add authentication if provided
      if (mergedOptions.username && mergedOptions.token) {
        confluenceOptions.auth = {
          username: mergedOptions.username,
          token: mergedOptions.token
        };
      }
      
      const result = await scrapeConfluence(confluenceOptions);
      
      console.log(`Scraped ${result.pageCount} pages from Confluence space ${mergedOptions.spaceId}`);
      console.log(`Results saved to: ${mergedOptions.output}`);
    } catch (error) {
      console.error('Error during Confluence scraping:', error.message);
      process.exit(1);
    }
  });

// Create configuration command
program
  .command('init-config')
  .description('Create a sample configuration file')
  .option('-o, --output <file>', 'Path for the configuration file', './scrapr.config.yml')
  .action(async (options) => {
    try {
      await createSampleConfig(options.output);
    } catch (error) {
      console.error('Error creating configuration file:', error.message);
      process.exit(1);
    }
  });

program.parse();