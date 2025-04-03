import { jest } from '@jest/globals';
import { scrapeUrl } from '../src/scraper.js';

describe('scrapeUrl', () => {
  // Mock HTML content to return
  const mockHtml = '<html><body><h1>Test Page</h1></body></html>';
  
  // Mock functions for page and browser
  const mockGoto = jest.fn().mockResolvedValue(undefined);
  const mockContent = jest.fn().mockResolvedValue(mockHtml);
  const mockClose = jest.fn().mockResolvedValue(undefined);
  
  // Mock browser factory function
  const mockBrowserFactory = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      newPage: () => Promise.resolve({
        goto: mockGoto,
        content: mockContent
      }),
      close: mockClose
    });
  });
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should scrape a valid URL and return HTML content', async () => {
    const url = 'https://example.com';
    const result = await scrapeUrl(url, { browserFactory: mockBrowserFactory });
    
    expect(result).toBe(mockHtml);
    expect(mockGoto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ 
        timeout: 30000,
        waitUntil: 'networkidle0'
      })
    );
    expect(mockContent).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });
  
  it('should throw an error when URL is not provided', async () => {
    await expect(scrapeUrl()).rejects.toThrow('URL is required');
    expect(mockBrowserFactory).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });
  
  it('should pass custom timeout to page.goto', async () => {
    await scrapeUrl('https://example.com', { 
      timeout: 60000,
      browserFactory: mockBrowserFactory
    });
    
    expect(mockGoto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 60000 })
    );
    expect(mockClose).toHaveBeenCalled();
  });
  
  it('should honor waitForNetworkIdle option', async () => {
    await scrapeUrl('https://example.com', { 
      waitForNetworkIdle: false,
      browserFactory: mockBrowserFactory
    });
    
    expect(mockGoto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    );
    expect(mockClose).toHaveBeenCalled();
  });
});