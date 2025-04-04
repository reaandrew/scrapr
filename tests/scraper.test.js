import { jest } from '@jest/globals';
import { scrapeUrl, getExtension } from '../src/scraper.js';

// We don't want to test the filesystem operations directly
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('scrapeUrl', () => {
  // Mock HTML content to return
  const mockHtml = '<html><body><h1>Test Page</h1><img src="image.jpg" /><link href="style.css" /></body></html>';
  
  // Mock response for resource downloads
  const mockResponseBuffer = jest.fn().mockResolvedValue(Buffer.from('mock content'));
  const mockResponse = {
    buffer: mockResponseBuffer
  };
  
  // Mock evaluate function for page
  const mockEvaluate = jest.fn().mockResolvedValue([
    'https://example.com/image.jpg',
    'https://example.com/style.css',
    'https://example.com/script.js'
  ]);
  
  // Mock functions for page and browser
  const mockGoto = jest.fn().mockResolvedValue(mockResponse);
  const mockContent = jest.fn().mockResolvedValue(mockHtml);
  const mockClose = jest.fn().mockResolvedValue(undefined);
  
  // Mock browser factory function
  const mockBrowserFactory = jest.fn().mockImplementation(() => {
    // Create a mock page object
    const mockPage = {
      goto: mockGoto,
      content: mockContent,
      evaluate: mockEvaluate,
      close: mockClose
    };
    
    return Promise.resolve({
      newPage: () => Promise.resolve(mockPage),
      close: mockClose
    });
  });
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('Basic functionality', () => {
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
  
  describe('Resource downloading', () => {
    it('should return an object with HTML and resources array when downloadResources is set', async () => {
      const url = 'https://example.com';
      const result = await scrapeUrl(url, { 
        browserFactory: mockBrowserFactory,
        downloadResources: './downloads'
      });
      
      // Should return object with html and resources
      expect(result).toHaveProperty('html', mockHtml);
      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);
      
      // Should have accessed page.evaluate to find resources
      expect(mockEvaluate).toHaveBeenCalled();
    });
    
    it('should filter resources by extension when resourceExtensions is set', async () => {
      // Mock evaluate to return resources with identifiable extensions
      mockEvaluate.mockResolvedValueOnce([
        'https://example.com/image.jpg',
        'https://example.com/icon.png',
        'https://example.com/style.css'
      ]);
      
      const url = 'https://example.com';
      const result = await scrapeUrl(url, { 
        browserFactory: mockBrowserFactory,
        downloadResources: './downloads',
        resourceExtensions: ['jpg', 'png']
      });
      
      // These resources should be filtered to just jpg and png
      const extensions = result.resources
        .filter(r => r.success)
        .map(r => r.extension);
      
      // We only expect jpg and png resources
      expect(extensions).toContain('jpg');
      expect(extensions).toContain('png');
      expect(extensions).not.toContain('css');
      
      // Should have accessed page.evaluate to find resources
      expect(mockEvaluate).toHaveBeenCalled();
    });
  });
});

describe('getExtension', () => {
  it('should extract extension from URL', () => {
    expect(getExtension('https://example.com/image.jpg')).toBe('jpg');
    expect(getExtension('https://example.com/script.js')).toBe('js');
    expect(getExtension('https://example.com/style.css')).toBe('css');
  });
  
  it('should return lowercase extension', () => {
    expect(getExtension('https://example.com/image.JPG')).toBe('jpg');
    expect(getExtension('https://example.com/script.JS')).toBe('js');
  });
  
  it('should return "unknown" for URLs without extension', () => {
    expect(getExtension('https://example.com/')).toBe('unknown');
    expect(getExtension('https://example.com/path/to/page')).toBe('unknown');
  });
  
  it('should handle invalid URLs', () => {
    expect(getExtension('not-a-url')).toBe('unknown');
  });
});