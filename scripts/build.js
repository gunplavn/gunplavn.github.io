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
    const html = marked(markdown);

    // Generate excerpt from content if not provided
    const defaultExcerpt = markdown.slice(0, 150).replace(/[#*`\n]/g, '').trim() + '...';

    posts.push({
      slug,
      title: data.title || 'Untitled',
      excerpt: data.excerpt || defaultExcerpt,
      content: html,
      date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
      category: data.category || 'uncategorized',
      tags: data.tags || [],
      thumbnail: data.thumbnail || '/images/default-thumb.svg',
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

// Apply base template
function applyBase(content, title) {
  const base = readTemplate('base');
  return base
    .replace(/{{title}}/g, title)
    .replace('{{content}}', content);
}

// Generate post card HTML
function generatePostCard(post) {
  return `
    <article class="post-card" data-category="${post.category}" data-tags="${post.tags.join(',').toLowerCase()}">
      <a href="/posts/${post.slug}.html">
        <img src="${post.thumbnail}" alt="${post.title}" class="post-thumb" loading="lazy">
        <div class="post-card-content">
          <span class="category" data-cat="${post.category}">${post.category}</span>
          <h3>${post.title}</h3>
          <time>${post.date}</time>
          <p>${post.excerpt}</p>
        </div>
      </a>
    </article>
  `;
}

// Generate popular/related post HTML
function generatePopularPost(post) {
  return `
    <a href="/posts/${post.slug}.html" class="popular-post">
      <img src="${post.thumbnail}" alt="${post.title}" loading="lazy">
      <div class="popular-post-content">
        <h4>${post.title}</h4>
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
    const tagsHtml = post.tags.map(t => `<span class="tag">${t}</span>`).join('');
    const allTagsHtml = allTags.map(t => `<span class="category-tag">${t}</span>`).join('');

    let postHtml = template
      .replace(/{{title}}/g, post.title)
      .replace(/{{date}}/g, post.date)
      .replace(/{{category}}/g, post.category)
      .replace('{{tags}}', tagsHtml)
      .replace('{{content}}', post.content)
      .replace('{{slug}}', post.slug)
      .replace('{{url}}', `${SITE_URL}/posts/${post.slug}.html`)
      .replace('{{related}}', relatedHtml)
      .replace('{{allTags}}', allTagsHtml);

    const fullHtml = applyBase(postHtml, `${post.title} | Gunpla Blog`);
    fs.writeFileSync(path.join(postsDir, `${post.slug}.html`), fullHtml);
  }

  console.log(`Built ${posts.length} post pages`);
}

// Build index page
function buildIndex(posts) {
  const template = readTemplate('index');

  // All posts in list format
  const postCardsHtml = posts.map(generatePostCard).join('\n');

  // Popular posts for sidebar (show first 5)
  const popularHtml = posts.slice(0, 5).map(generatePopularPost).join('\n');

  let indexHtml = template
    .replace('{{posts}}', postCardsHtml)
    .replace('{{popular}}', popularHtml);

  const fullHtml = applyBase(indexHtml, 'Gunpla Blog - Tin Tức và Đánh Giá');
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

// Copy static assets
function copyAssets() {
  // Copy styles
  const stylesDistDir = path.join(DIST_DIR, 'styles');
  ensureDir(stylesDistDir);
  const styleFiles = fs.readdirSync(STYLES_DIR);
  for (const file of styleFiles) {
    fs.copyFileSync(
      path.join(STYLES_DIR, file),
      path.join(stylesDistDir, file)
    );
  }

  // Copy JS
  const jsDistDir = path.join(DIST_DIR, 'js');
  ensureDir(jsDistDir);
  const jsFiles = fs.readdirSync(JS_DIR);
  for (const file of jsFiles) {
    fs.copyFileSync(
      path.join(JS_DIR, file),
      path.join(jsDistDir, file)
    );
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

  console.log('Copied static assets');
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
  buildIndex(posts);
  buildSearchIndex(posts);
  copyAssets();

  console.log('\nBuild complete!');
}

build().catch(console.error);
