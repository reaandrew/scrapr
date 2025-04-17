import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { createBrowser } from './scraper.js';

/**
 * Scrape Confluence space and save pages as JSON files
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.baseUrl - Base URL of Confluence instance
 * @param {string} options.spaceId - Confluence space ID to scrape
 * @param {string} options.outputDir - Output directory for JSON files
 * @param {number} options.concurrencyLimit - Number of concurrent requests
 * @param {Object} options.auth - Authentication credentials (optional)
 * @param {string} options.auth.username - Confluence username
 * @param {string} options.auth.token - API token for authentication
 * @returns {Promise<Object>} Result information
 */
export async function scrapeConfluence(options) {
  const {
    baseUrl,
    spaceId,
    outputDir = './output',
    concurrencyLimit = 5,
    auth = null,
    browserFactory = createBrowser
  } = options;
  
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }
  
  if (!spaceId) {
    throw new Error('spaceId is required');
  }
  
  // Create output directory if it doesn't exist
  await fs.promises.mkdir(outputDir, { recursive: true });
  const spacePath = path.join(outputDir, `space-${spaceId}`);
  await fs.promises.mkdir(spacePath, { recursive: true });
  
  const browser = await browserFactory();
  const result = { pageCount: 0, pages: [] };
  
  try {
    // First, get the space information and root pages
    console.log(`Getting space information and root pages for ${spaceId}...`);
    
    // Create a URL for the space API endpoint
    const spaceUrl = `${baseUrl}/rest/api/space/${spaceId}?expand=homepage`;
    
    // Create a new page and set authentication if needed
    const page = await browser.newPage();
    if (auth) {
      // Set basic auth headers
      await page.setExtraHTTPHeaders({
        'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.token}`).toString('base64')}`
      });
    }
    
    // Navigate to the space API endpoint
    const response = await page.goto(spaceUrl, {
      waitUntil: 'networkidle0'
    });
    
    // Parse the space information
    const spaceInfo = await response.json();
    
    // Save the space information
    const spaceInfoPath = path.join(spacePath, 'space-info.json');
    await fs.promises.writeFile(spaceInfoPath, JSON.stringify(spaceInfo, null, 2));
    
    // Get the homepage ID and content
    if (spaceInfo.homepage) {
      const homepageId = spaceInfo.homepage.id;
      console.log(`Found homepage ID: ${homepageId}`);
      
      // Get the homepage content
      const homepage = await getPageContent(browser, baseUrl, homepageId, auth);
      
      // Save the homepage content
      const homepagePath = path.join(spacePath, `page-${homepageId}.json`);
      await fs.promises.writeFile(homepagePath, JSON.stringify(homepage, null, 2));
      
      result.pages.push(homepage);
      result.pageCount++;
      
      // Find all child pages from the homepage
      console.log('Getting child pages...');
      await getChildPages(browser, baseUrl, homepageId, spacePath, result, auth, concurrencyLimit);
    } else {
      console.log('No homepage found, getting all pages for the space...');
      // Get all pages for the space if no homepage is defined
      await getAllPages(browser, baseUrl, spaceId, spacePath, result, auth, concurrencyLimit);
    }
    
    // Save the index of all pages
    const indexPath = path.join(spacePath, 'index.json');
    await fs.promises.writeFile(indexPath, JSON.stringify({
      spaceId,
      baseUrl,
      pageCount: result.pageCount,
      pages: result.pages.map(p => ({
        id: p.id,
        title: p.title,
        parentId: p.parentId,
        filePath: `page-${p.id}.json`
      }))
    }, null, 2));
    
    console.log(`Scraped ${result.pageCount} pages from Confluence space ${spaceId}`);
    console.log(`Results saved to: ${spacePath}`);
    
    return result;
  } finally {
    await browser.close();
  }
}

/**
 * Get page content from Confluence
 * 
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} baseUrl - Base URL of Confluence instance
 * @param {string} pageId - Confluence page ID
 * @param {Object} auth - Authentication credentials (optional)
 * @returns {Promise<Object>} Page content
 */
async function getPageContent(browser, baseUrl, pageId, auth) {
  const page = await browser.newPage();
  try {
    if (auth) {
      // Set basic auth headers
      await page.setExtraHTTPHeaders({
        'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.token}`).toString('base64')}`
      });
    }
    
    // Create a URL for the page content API endpoint
    const pageUrl = `${baseUrl}/rest/api/content/${pageId}?expand=body.storage,children.page,ancestors,version`;
    
    // Navigate to the page API endpoint
    const response = await page.goto(pageUrl, {
      waitUntil: 'networkidle0'
    });
    
    // Parse the page information
    const pageInfo = await response.json();
    
    // Extract the relevant information
    return {
      id: pageInfo.id,
      title: pageInfo.title,
      version: pageInfo.version.number,
      createdAt: pageInfo.created,
      updatedAt: pageInfo.version.when,
      parentId: pageInfo.ancestors.length > 0 ? pageInfo.ancestors[pageInfo.ancestors.length - 1].id : null,
      contentUrl: `${baseUrl}${pageInfo._links.webui}`,
      content: pageInfo.body.storage.value,
      childrenIds: pageInfo.children.page.results.map(p => p.id)
    };
  } finally {
    await page.close();
  }
}

/**
 * Recursively get all child pages
 * 
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} baseUrl - Base URL of Confluence instance
 * @param {string} parentId - Parent page ID
 * @param {string} outputDir - Output directory for JSON files
 * @param {Object} result - Result object to update
 * @param {Object} auth - Authentication credentials (optional)
 * @param {number} concurrencyLimit - Number of concurrent requests
 * @returns {Promise<void>}
 */
async function getChildPages(browser, baseUrl, parentId, outputDir, result, auth, concurrencyLimit) {
  // Get the parent page first to get child page IDs
  const parentPage = await getPageContent(browser, baseUrl, parentId, auth);
  const childIds = parentPage.childrenIds;
  
  if (childIds.length === 0) {
    console.log(`No child pages found for page ${parentId}`);
    return;
  }
  
  console.log(`Found ${childIds.length} child pages for page ${parentId}`);
  
  // Process child pages in batches for controlled parallelism
  for (let i = 0; i < childIds.length; i += concurrencyLimit) {
    const batch = childIds.slice(i, i + concurrencyLimit);
    console.log(`Processing batch ${i/concurrencyLimit + 1} of ${Math.ceil(childIds.length/concurrencyLimit)}...`);
    
    // Process batch in parallel
    const promises = batch.map(async (childId) => {
      try {
        // Get the child page content
        const childPage = await getPageContent(browser, baseUrl, childId, auth);
        
        // Save the child page content
        const childPath = path.join(outputDir, `page-${childId}.json`);
        await fs.promises.writeFile(childPath, JSON.stringify(childPage, null, 2));
        
        // Update the result
        result.pages.push(childPage);
        result.pageCount++;
        
        // Process this child's children recursively
        await getChildPages(browser, baseUrl, childId, outputDir, result, auth, concurrencyLimit);
      } catch (error) {
        console.error(`Error processing page ${childId}: ${error.message}`);
      }
    });
    
    // Wait for all promises in the batch to resolve
    await Promise.all(promises);
  }
}

/**
 * Get all pages for a space
 * 
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} baseUrl - Base URL of Confluence instance
 * @param {string} spaceId - Confluence space ID
 * @param {string} outputDir - Output directory for JSON files
 * @param {Object} result - Result object to update
 * @param {Object} auth - Authentication credentials (optional)
 * @param {number} concurrencyLimit - Number of concurrent requests
 * @returns {Promise<void>}
 */
async function getAllPages(browser, baseUrl, spaceId, outputDir, result, auth, concurrencyLimit) {
  const page = await browser.newPage();
  try {
    if (auth) {
      // Set basic auth headers
      await page.setExtraHTTPHeaders({
        'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.token}`).toString('base64')}`
      });
    }
    
    let start = 0;
    const limit = 25; // Confluence API default page size
    let hasMore = true;
    
    while (hasMore) {
      // Create a URL for the space content API endpoint
      const contentUrl = `${baseUrl}/rest/api/space/${spaceId}/content?expand=page&start=${start}&limit=${limit}`;
      
      // Navigate to the space content API endpoint
      const response = await page.goto(contentUrl, {
        waitUntil: 'networkidle0'
      });
      
      // Parse the space content information
      const contentInfo = await response.json();
      
      // Process this batch of pages
      const pageResults = contentInfo.page.results;
      console.log(`Found ${pageResults.length} pages in batch, processing...`);
      
      // Process pages in parallel with concurrency limit
      const pageBatches = [];
      for (let i = 0; i < pageResults.length; i += concurrencyLimit) {
        pageBatches.push(pageResults.slice(i, i + concurrencyLimit));
      }
      
      for (const batch of pageBatches) {
        const promises = batch.map(async (pageInfo) => {
          try {
            // Get the page content
            const pageContent = await getPageContent(browser, baseUrl, pageInfo.id, auth);
            
            // Save the page content
            const pagePath = path.join(outputDir, `page-${pageInfo.id}.json`);
            await fs.promises.writeFile(pagePath, JSON.stringify(pageContent, null, 2));
            
            // Update the result
            result.pages.push(pageContent);
            result.pageCount++;
          } catch (error) {
            console.error(`Error processing page ${pageInfo.id}: ${error.message}`);
          }
        });
        
        // Wait for all promises in the batch to resolve
        await Promise.all(promises);
      }
      
      // Check if there are more pages
      hasMore = contentInfo.page.size + contentInfo.page.start < contentInfo.page.totalSize;
      start += limit;
      
      if (hasMore) {
        console.log(`Processed ${start} of ${contentInfo.page.totalSize} pages, getting more...`);
      }
    }
  } finally {
    await page.close();
  }
}