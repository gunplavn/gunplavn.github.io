import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import matter from 'gray-matter';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Configure marked to allow HTML in markdown
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Paths
const POSTS_DIR = path.join(rootDir, 'src/posts');
const TEMPLATES_DIR = path.join(rootDir, 'src/templates');
const STYLES_DIR = path.join(rootDir, 'src/styles');
const JS_DIR = path.join(rootDir, 'src/js');
const PUBLIC_DIR = path.join(rootDir, 'public');
const DIST_DIR = path.join(rootDir, 'dist');

// Site config
const SITE_URL = process.env.SITE_URL || 'https://gunplavn.github.io';
const SITE_NAME = 'GunplaVN';
const SITE_DESCRIPTION = 'Blog về Gunpla, model kit và kỹ thuật lắp ráp mô hình';
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-default.jpg`;
const FB_APP_ID = process.env.FB_APP_ID || ''; // Set your Facebook App ID here or via env

// Calculate reading time (average 200 words per minute)
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const textOnly = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  const wordCount = textOnly.split(' ').filter(word => word.length > 0).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return minutes < 1 ? 1 : minutes;
}

// Minify CSS
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}:;,>+~])\s*/g, '$1') // Remove spaces around special chars
    .replace(/;}/g, '}') // Remove last semicolon in blocks
    .replace(/^\s+|\s+$/g, ''); // Trim
}

// Minify JS (basic)
function minifyJS(js) {
  return js
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}:;,=()[\]<>!&|?+\-*\/])\s*/g, '$1') // Remove spaces around operators
    .replace(/^\s+|\s+$/g, ''); // Trim
}

// Escape HTML for attribute values
function escapeHtml(text) {
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text).replace(/[&<>"']/g, char => htmlEntities[char]);
}

// Ensure dist directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Read template file
function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
}


// Parse all posts
async function getPosts() {
  const files = await glob('**/*.md', { cwd: POSTS_DIR });
  const posts = [];

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);

    const slug = file.replace('.md', '');

    // Remove leading h1 title if it matches frontmatter title (to avoid duplication)
    let processedMarkdown = markdown.trim();
    const titleMatch = processedMarkdown.match(/^#\s+(.+?)[\r\n]/);
    if (titleMatch && data.title && titleMatch[1].trim() === data.title.trim()) {
      processedMarkdown = processedMarkdown.replace(/^#\s+.+?[\r\n]+/, '');
    }

    const html = marked(processedMarkdown);

    // Generate excerpt from content if not provided
    const defaultExcerpt = markdown.slice(0, 150).replace(/[#*`\n]/g, '').trim() + '...';

    const readingTime = calculateReadingTime(markdown);

    posts.push({
      slug,
      title: data.title || 'Untitled',
      excerpt: data.excerpt || defaultExcerpt,
      content: html,
      date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
      category: data.category || 'uncategorized',
      tags: data.tags || [],
      thumbnail: data.thumbnail || '/images/default-thumb.svg',
      readingTime,
    });
  }

  // Sort by date, newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

// Get all unique tags from posts
function getAllTags(posts) {
  const tagSet = new Set();
  posts.forEach(p => p.tags.forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

// Apply base template with SEO metadata
function applyBase(content, options) {
  const {
    title,
    description = SITE_DESCRIPTION,
    canonicalUrl = SITE_URL,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
  } = options;

  const base = readTemplate('base');
  return base
    .replace(/{{title}}/g, escapeHtml(title))
    .replace(/{{description}}/g, escapeHtml(description))
    .replace(/{{canonicalUrl}}/g, canonicalUrl)
    .replace(/{{ogType}}/g, ogType)
    .replace(/{{ogImage}}/g, ogImage)
    .replace(/{{fbAppId}}/g, FB_APP_ID)
    .replace('{{content}}', content);
}

// Generate post card HTML
function generatePostCard(post) {
  return `
    <article class="post-card" data-category="${escapeHtml(post.category)}" data-tags="${escapeHtml(post.tags.join(',').toLowerCase())}">
      <a href="/posts/${post.slug}.html">
        <div class="post-thumb-wrapper">
          <img src="${post.thumbnail}" alt="${escapeHtml(post.title)}" class="post-thumb" loading="lazy">
          <span class="category" data-cat="${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
        </div>
        <div class="post-card-content">
          <h3>${escapeHtml(post.title)}</h3>
          <div class="post-card-meta">
            <time>${post.date}</time>
            <span class="reading-time">${post.readingTime} min read</span>
          </div>
          <p>${escapeHtml(post.excerpt)}</p>
        </div>
      </a>
    </article>
  `;
}

// Generate popular/related post HTML
function generatePopularPost(post) {
  return `
    <a href="/posts/${post.slug}.html" class="popular-post">
      <img src="${post.thumbnail}" alt="${escapeHtml(post.title)}" loading="lazy">
      <div class="popular-post-content">
        <h4>${escapeHtml(post.title)}</h4>
        <time>${post.date}</time>
      </div>
    </a>
  `;
}

// Build individual post pages
function buildPosts(posts, allTags) {
  const template = readTemplate('post');
  const postsDir = path.join(DIST_DIR, 'posts');
  ensureDir(postsDir);

  for (const post of posts) {
    // Get related posts (same category, excluding current)
    const related = posts
      .filter(p => p.slug !== post.slug && p.category === post.category)
      .slice(0, 3);

    // If not enough related by category, add recent posts
    if (related.length < 3) {
      const more = posts
        .filter(p => p.slug !== post.slug && !related.includes(p))
        .slice(0, 3 - related.length);
      related.push(...more);
    }

    const relatedHtml = related.map(generatePopularPost).join('\n');
    const tagsHtml = post.tags.map(t => `<a href="/?tag=${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');
    const allTagsHtml = allTags.map(t => `<a href="/?tag=${encodeURIComponent(t)}" class="tag-link">${escapeHtml(t)}</a>`).join('');
    const postUrl = `${SITE_URL}/posts/${post.slug}.html`;
    const ogImage = post.thumbnail.startsWith('http') ? post.thumbnail : `${SITE_URL}${post.thumbnail}`;

    let postHtml = template
      .replace(/{{title}}/g, escapeHtml(post.title))
      .replace(/{{date}}/g, post.date)
      .replace(/{{readingTime}}/g, `${post.readingTime} min read`)
      .replace(/{{category}}/g, escapeHtml(post.category))
      .replace(/{{fbAppId}}/g, FB_APP_ID)
      .replace('{{tags}}', tagsHtml)
      .replace('{{content}}', post.content)
      .replace('{{slug}}', post.slug)
      .replace('{{url}}', postUrl)
      .replace('{{related}}', relatedHtml)
      .replace('{{allTags}}', allTagsHtml);

    const fullHtml = applyBase(postHtml, {
      title: `${post.title} | GunplaVN`,
      description: post.excerpt,
      canonicalUrl: postUrl,
      ogType: 'article',
      ogImage,
    });
    fs.writeFileSync(path.join(postsDir, `${post.slug}.html`), fullHtml);
  }

  console.log(`Built ${posts.length} post pages`);
}

// Generate clickable tag HTML
function generateTagLink(tag) {
  return `<a href="/?tag=${encodeURIComponent(tag)}" class="tag-link">${escapeHtml(tag)}</a>`;
}

// Build index page
function buildIndex(posts, allTags) {
  const template = readTemplate('index');

  // All posts in list format
  const postCardsHtml = posts.map(generatePostCard).join('\n');

  // Popular posts for sidebar (show first 5)
  const popularHtml = posts.slice(0, 5).map(generatePopularPost).join('\n');

  // All tags as clickable links
  const allTagsHtml = allTags.map(generateTagLink).join('');

  let indexHtml = template
    .replace('{{posts}}', postCardsHtml)
    .replace('{{popular}}', popularHtml)
    .replace('{{allTags}}', allTagsHtml);

  const fullHtml = applyBase(indexHtml, {
    title: 'GunplaVN - Tin Tức và Đánh Giá',
    description: SITE_DESCRIPTION,
    canonicalUrl: SITE_URL,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), fullHtml);

  console.log('Built index page');
}

// Generate posts.json for search
function buildSearchIndex(posts) {
  const searchData = posts.map(({ slug, title, date, category, tags, excerpt, thumbnail }) => ({
    slug,
    title,
    date,
    category,
    tags,
    excerpt,
    thumbnail,
  }));

  fs.writeFileSync(
    path.join(DIST_DIR, 'posts.json'),
    JSON.stringify(searchData, null, 2)
  );

  console.log('Built search index');
}

// Copy and minify static assets
function copyAssets() {
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--minify');

  // Copy and minify styles
  const stylesDistDir = path.join(DIST_DIR, 'styles');
  ensureDir(stylesDistDir);
  const styleFiles = fs.readdirSync(STYLES_DIR);
  for (const file of styleFiles) {
    let content = fs.readFileSync(path.join(STYLES_DIR, file), 'utf-8');
    if (isProduction && file.endsWith('.css')) {
      content = minifyCSS(content);
    }
    fs.writeFileSync(path.join(stylesDistDir, file), content);
  }

  // Copy and minify JS
  const jsDistDir = path.join(DIST_DIR, 'js');
  ensureDir(jsDistDir);
  const jsFiles = fs.readdirSync(JS_DIR);
  for (const file of jsFiles) {
    let content = fs.readFileSync(path.join(JS_DIR, file), 'utf-8');
    if (isProduction && file.endsWith('.js')) {
      content = minifyJS(content);
    }
    fs.writeFileSync(path.join(jsDistDir, file), content);
  }

  // Copy public folder (images, etc.)
  const imagesDistDir = path.join(DIST_DIR, 'images');
  ensureDir(imagesDistDir);
  if (fs.existsSync(path.join(PUBLIC_DIR, 'images'))) {
    const imageFiles = fs.readdirSync(path.join(PUBLIC_DIR, 'images'));
    for (const file of imageFiles) {
      fs.copyFileSync(
        path.join(PUBLIC_DIR, 'images', file),
        path.join(imagesDistDir, file)
      );
    }
  }

  console.log(`Copied static assets${isProduction ? ' (minified)' : ''}`);
}

// Generate sitemap.xml
function buildSitemap(posts) {
  const today = new Date().toISOString().split('T')[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const post of posts) {
    sitemap += `
  <url>
    <loc>${SITE_URL}/posts/${post.slug}.html</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  sitemap += '\n</urlset>';

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('Built sitemap.xml');
}

// Generate robots.txt
function buildRobotsTxt() {
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
  console.log('Built robots.txt');
}

// Main build function
async function build() {
  console.log('Building blog...\n');

  // Clean dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);

  // Get all posts
  const posts = await getPosts();
  const allTags = getAllTags(posts);

  // Build everything
  buildPosts(posts, allTags);
  buildIndex(posts, allTags);
  buildSearchIndex(posts);
  buildSitemap(posts);
  buildRobotsTxt();
  copyAssets();

  console.log('\nBuild complete!');
}

build().catch(console.error);
