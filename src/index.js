#!/usr/bin/env node
import { scrapeUrl } from './scraper.js';

// Get the URL from command line arguments
const url = process.argv[2];

if (!url) {
  console.error('Please provide a URL to scrape');
  console.error('Usage: npm start <url>');
  process.exit(1);
}

async function main() {
  try {
    console.log(`Scraping ${url}...`);
    const html = await scrapeUrl(url);
    console.log(html);
  } catch (error) {
    console.error('Error during scraping:', error.message);
    process.exit(1);
  }
}

main();