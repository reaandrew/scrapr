# Scrapr

A simple web scraping tool that uses Puppeteer to load web pages, wait for the DOM to fully load (including JavaScript execution), and output the rendered HTML.

## Installation

```bash
# Clone the repository
git clone https://github.com/reaandrew/scrapr.git
cd scrapr

# Install dependencies
npm install
```

## Usage

### Command Line

```bash
# Basic usage to get HTML
npm start https://example.com

# Download resources from a page
npm start https://example.com --download ./downloads

# Download specific file types (by extension)
npm start https://example.com --download ./downloads --extensions jpg,png,css

# Control download parallelism (default is 5)
npm start https://example.com --download ./downloads --concurrency 10

# Show help
npm start --help
```

### As a module

```javascript
import { scrapeUrl } from './src/scraper.js';

// Basic HTML scraping
async function basicExample() {
  const html = await scrapeUrl('https://example.com', {
    timeout: 60000,             // 60 seconds timeout
    waitForNetworkIdle: true    // Wait for network to be idle
  });
  
  console.log(html);
}

// Resource downloading example
async function downloadExample() {
  const result = await scrapeUrl('https://example.com', {
    downloadResources: './downloads',    // Directory to save resources
    resourceExtensions: ['jpg', 'png'],  // Only download these extensions
    concurrencyLimit: 10                 // Download 10 files at once
  });
  
  console.log(`HTML content: ${result.html.substring(0, 100)}...`);
  console.log(`Downloaded ${result.resources.length} resources`);
  
  // List successful downloads
  const successful = result.resources.filter(r => r.success);
  successful.forEach(r => {
    console.log(`- ${r.url} (${r.extension})`);
  });
}
```

## Development

### Testing

```bash
# Run tests
npm test

# Watch mode for development
npm run test:watch

# Debug mode with open handle detection
npm run test:debug
```

### Quality Gates

This project uses multiple tools to ensure code quality:

- **Pre-commit hook**: Runs tests before each commit to prevent committing broken code
- **Semantic release**: Ensures proper versioning based on conventional commits
- **SonarQube**: Analyzes code quality, test coverage, and potential issues

To run a local SonarQube analysis:

```bash
# Make sure you have SonarQube running locally or set up connection details
npm run sonar
```

These quality gates help maintain high code quality and prevent breaking changes from being pushed to the repository.

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and package publishing based on [Conventional Commits](https://www.conventionalcommits.org/).

Release types are determined by commit messages:
- `feat:` - Minor release (new feature)
- `fix:` - Patch release (bug fix)
- `feat!:` or `fix!:` or body contains `BREAKING CHANGE:` - Major release