#!/usr/bin/env node
import { scrapeUrl } from './scraper.js';
import path from 'path';
import fs from 'fs';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    downloadResources: null,
    resourceExtensions: [],
    concurrency: 5, // Default concurrency
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--download' || arg === '-d') {
      options.downloadResources = args[++i];
    } else if (arg === '--extensions' || arg === '-e') {
      options.resourceExtensions = args[++i].split(',');
    } else if (arg === '--concurrency' || arg === '-c') {
      options.concurrency = parseInt(args[++i], 10);
      if (isNaN(options.concurrency) || options.concurrency < 1) {
        options.concurrency = 5; // Reset to default if invalid
      }
    } else if (!options.url) {
      options.url = arg;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
Scrapr - A web scraping tool

Usage: 
  npm start <url> [options]

Arguments:
  url                   URL to scrape

Options:
  -h, --help               Show this help message
  -d, --download <dir>     Download resources to specified directory
  -e, --extensions <list>  Comma-separated list of extensions to download (e.g., jpg,png,css)
  -c, --concurrency <num>  Number of concurrent downloads (default: 5)

Examples:
  npm start https://example.com
  npm start https://example.com --download ./downloads
  npm start https://example.com --download ./downloads --extensions jpg,png,gif
  npm start https://example.com --download ./downloads --concurrency 10
  `);
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  if (!options.url) {
    console.error('Please provide a URL to scrape');
    console.error('Usage: npm start <url> [options]');
    console.error('Try "npm start --help" for more information');
    process.exit(1);
  }
  
  try {
    console.log(`Scraping ${options.url}...`);
    console.log('This may take a while depending on the page size and number of resources...');
    
    const scrapeOptions = {};
    
    if (options.downloadResources) {
      console.log(`Will download resources to: ${options.downloadResources}`);
      scrapeOptions.downloadResources = options.downloadResources;
      
      // Set concurrency limit for parallel downloads
      scrapeOptions.concurrencyLimit = options.concurrency;
      console.log(`Using concurrency level: ${options.concurrency} parallel downloads`);
      
      if (options.resourceExtensions.length > 0) {
        console.log(`Filtering for extensions: ${options.resourceExtensions.join(', ')}`);
        scrapeOptions.resourceExtensions = options.resourceExtensions;
      } else {
        console.log('Will download all resource types');
      }
    }
    
    const result = await scrapeUrl(options.url, scrapeOptions);
    
    if (options.downloadResources) {
      // If we're downloading resources, write the HTML to a file too
      const outputDir = options.downloadResources;
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
}

main();