import puppeteer from 'puppeteer';

/**
 * Scrape a URL and return the HTML content after page is fully loaded
 * 
 * @param {string} url - The URL to scrape
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait for page to load in ms (default: 30000)
 * @param {boolean} options.waitForNetworkIdle - Whether to wait for network to be idle (default: true)
 * @returns {Promise<string>} The HTML content of the page
 */
export async function scrapeUrl(url, options = {}) {
  const { 
    timeout = 30000,
    waitForNetworkIdle = true 
  } = options;
  
  if (!url) {
    throw new Error('URL is required');
  }
  
  const browser = await puppeteer.launch({
    headless: 'new'
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to URL
    await page.goto(url, { 
      timeout,
      waitUntil: waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded'
    });
    
    // Get the page content
    const content = await page.content();
    
    return content;
  } finally {
    await browser.close();
  }
}