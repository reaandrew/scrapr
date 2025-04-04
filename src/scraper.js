import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import url from 'url';

/**
 * Create a browser instance
 * 
 * @returns {Promise<Object>} Puppeteer browser instance
 */
export async function createBrowser() {
  return puppeteer.launch({
    headless: 'new'
  });
}

/**
 * Extract file extension from URL
 * 
 * @param {string} urlString - URL to extract extension from
 * @returns {string} File extension or 'unknown' if no extension found
 */
export function getExtension(urlString) {
  try {
    const pathname = new URL(urlString).pathname;
    const ext = path.extname(pathname).toLowerCase().slice(1);
    return ext || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Ensure output directory exists
 * 
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Download a file from URL
 * 
 * @param {Object} page - Puppeteer page object
 * @param {string} resourceUrl - URL of resource to download
 * @param {string} outputDir - Directory to save downloaded file
 * @returns {Promise<Object>} Result of download operation
 */
export async function downloadResource(page, resourceUrl, outputDir) {
  try {
    const extension = getExtension(resourceUrl);
    const extensionDir = path.join(outputDir, extension);
    await ensureDirectoryExists(extensionDir);
    
    // Get file name from URL
    const urlObj = new URL(resourceUrl);
    const fileName = path.basename(urlObj.pathname);
    const filePath = path.join(extensionDir, fileName);
    
    // Download the file
    const response = await page.goto(resourceUrl, { waitUntil: 'networkidle0' });
    const buffer = await response.buffer();
    await fs.promises.writeFile(filePath, buffer);
    
    return { 
      success: true, 
      url: resourceUrl, 
      extension, 
      path: filePath 
    };
  } catch (error) {
    return { 
      success: false, 
      url: resourceUrl, 
      error: error.message 
    };
  }
}

/**
 * Scrape a URL and return the HTML content after page is fully loaded
 * 
 * @param {string} url - The URL to scrape
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait for page to load in ms (default: 30000)
 * @param {boolean} options.waitForNetworkIdle - Whether to wait for network to be idle (default: true)
 * @param {function} options.browserFactory - Function to create a browser instance (for testing)
 * @param {string} options.downloadResources - Path to save downloaded resources (if specified)
 * @param {string[]} options.resourceExtensions - Extensions of resources to download (default: all)
 * @returns {Promise<Object>} HTML content and optionally downloaded resources info
 */
export async function scrapeUrl(url, options = {}) {
  const { 
    timeout = 30000,
    waitForNetworkIdle = true,
    browserFactory = createBrowser,
    downloadResources = null,
    resourceExtensions = []
  } = options;
  
  if (!url) {
    throw new Error('URL is required');
  }
  
  const browser = await browserFactory();
  const result = { html: null, resources: [] };
  
  try {
    const page = await browser.newPage();
    
    // Navigate to URL
    await page.goto(url, { 
      timeout,
      waitUntil: waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded'
    });
    
    // Get the HTML content
    result.html = await page.content();
    
    // Download resources if requested
    if (downloadResources) {
      // Enhanced resource detection approach
      const resources = await page.evaluate(() => {
        // Detect all links
        const links = Array.from(document.querySelectorAll('a'));
        const linkUrls = links.map(link => link.href).filter(Boolean);

        // Detect resources with src and href attributes
        const srcElements = Array.from(document.querySelectorAll('[src]'));
        const hrefElements = Array.from(document.querySelectorAll('[href]'));
        
        const srcs = srcElements.map(el => el.getAttribute('src'));
        const hrefs = hrefElements.map(el => el.getAttribute('href'));
        
        // Combine all resources
        return [...srcs, ...hrefs, ...linkUrls]
          .filter(Boolean)
          .map(url => {
            try {
              // Convert relative URLs to absolute
              return new URL(url, document.location.href).href;
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);
      });
      
      // Filter resources: either by specified extensions, or only resources with known extensions
      const filteredResources = resources.filter(res => {
        const ext = getExtension(res);
        if (ext === 'unknown') return false; // Skip resources without extension
        return resourceExtensions.length > 0 ? resourceExtensions.includes(ext) : true;
      });
      
      // Download each resource
      await ensureDirectoryExists(downloadResources);
      
      // Log stats before downloading
      console.log(`Found ${filteredResources.length} resources with valid extensions`);
      if (filteredResources.length === 0) {
        console.log('No resources with identifiable extensions found on the page');
      } else {
        // Group and count by extension for better visibility
        const extCounts = {};
        filteredResources.forEach(res => {
          const ext = getExtension(res);
          extCounts[ext] = (extCounts[ext] || 0) + 1;
        });
        
        console.log('Resources by extension:');
        Object.entries(extCounts).forEach(([ext, count]) => {
          console.log(`  ${ext}: ${count} files`);
        });
        
        // Download resources
        const total = filteredResources.length;
        for (let i = 0; i < filteredResources.length; i++) {
          const resourceUrl = filteredResources[i];
          const ext = getExtension(resourceUrl);
          console.log(`Downloading ${ext} file ${i+1}/${total}: ${resourceUrl}`);
          const downloadResult = await downloadResource(page, resourceUrl, downloadResources);
          result.resources.push(downloadResult);
        }
      }
    }
    
    return downloadResources ? result : result.html;
  } finally {
    await browser.close();
  }
}