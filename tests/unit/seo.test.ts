import { describe, it, expect, vi, beforeEach } from 'vitest';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';

describe('SEO configuration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('robots.txt', () => {
    it('should generate valid robots configuration', () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.justjournalit.site');
      
      const config = robots();
      

      expect(config.rules.userAgent).toBe('*');
      expect(config.rules.allow).toBe('/');
      

      expect(config.rules.disallow).toEqual(['/api/']);


      expect(config.sitemap).toBe('https://www.justjournalit.site/sitemap.xml');
    });
  });

  describe('sitemap.xml', () => {
    it('should include expected public pages', () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.justjournalit.site');
      
      const map = sitemap();
      const urls = map.map(entry => entry.url);
      

      expect(urls).toContain('https://www.justjournalit.site');
      expect(urls).toContain('https://www.justjournalit.site/docs');
      expect(urls).toContain('https://www.justjournalit.site/privacy');
      expect(urls).toContain('https://www.justjournalit.site/terms');
      

      expect(urls).not.toContain('https://www.justjournalit.site/dashboard');
      expect(urls).not.toContain('https://www.justjournalit.site/api');
      expect(urls).not.toContain('https://www.justjournalit.site/donate');
      expect(urls).not.toContain('https://www.justjournalit.site/login');
      expect(urls).not.toContain('https://www.justjournalit.site/feedback');
    });

    it('normalizes URLs without trailing slashes', () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.justjournalit.site/');
      
      const map = sitemap();
      const urls = map.map(entry => entry.url);
      

      expect(urls).toContain('https://www.justjournalit.site');
      expect(urls).not.toContain('https://www.justjournalit.site//docs');
    });
  });
});
