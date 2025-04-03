import { jest } from '@jest/globals';
import { scrapeUrl } from '../src/scraper.js';

// Mock puppeteer
jest.mock('puppeteer', () => {
  const contentMock = '<html><body><h1>Test Page</h1></body></html>';
  
  return {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn().mockResolvedValue(),
        content: jest.fn().mockResolvedValue(contentMock)
      }),
      close: jest.fn().mockResolvedValue()
    })
  };
});

describe('scrapeUrl', () => {
  it('should scrape a valid URL and return HTML content', async () => {
    const url = 'https://example.com';
    const result = await scrapeUrl(url);
    
    expect(result).toBe('<html><body><h1>Test Page</h1></body></html>');
  });
  
  it('should throw an error when URL is not provided', async () => {
    await expect(scrapeUrl()).rejects.toThrow('URL is required');
  });
  
  it('should pass custom timeout to page.goto', async () => {
    const puppeteer = (await import('puppeteer')).default;
    const mockBrowser = await puppeteer.launch();
    const mockPage = await mockBrowser.newPage();
    
    await scrapeUrl('https://example.com', { timeout: 60000 });
    
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 60000 })
    );
  });
  
  it('should honor waitForNetworkIdle option', async () => {
    const puppeteer = (await import('puppeteer')).default;
    const mockBrowser = await puppeteer.launch();
    const mockPage = await mockBrowser.newPage();
    
    await scrapeUrl('https://example.com', { waitForNetworkIdle: false });
    
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    );
  });
});