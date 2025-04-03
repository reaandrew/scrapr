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
# Basic usage
npm start https://example.com

# Or with node directly
node src/index.js https://example.com
```

### As a module

```javascript
import { scrapeUrl } from './src/scraper.js';

async function example() {
  const html = await scrapeUrl('https://example.com', {
    timeout: 60000,             // 60 seconds timeout
    waitForNetworkIdle: true    // Wait for network to be idle
  });
  
  console.log(html);
}

example();
```

## Development

### Testing

```bash
# Run tests
npm test

# Watch mode for development
npm run test:watch
```

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and package publishing based on [Conventional Commits](https://www.conventionalcommits.org/).

Release types are determined by commit messages:
- `feat:` - Minor release (new feature)
- `fix:` - Patch release (bug fix)
- `feat!:` or `fix!:` or body contains `BREAKING CHANGE:` - Major release