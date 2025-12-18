// Generate consistent color from string (hash-based)
function stringToColor(str) {
  // Predefined color palette for better aesthetics
  const colors = [
    { color: '#dc2626', bg: '#fef2f2' }, // red
    { color: '#ea580c', bg: '#fff7ed' }, // orange
    { color: '#d97706', bg: '#fffbeb' }, // amber
    { color: '#ca8a04', bg: '#fefce8' }, // yellow
    { color: '#65a30d', bg: '#f7fee7' }, // lime
    { color: '#16a34a', bg: '#f0fdf4' }, // green
    { color: '#059669', bg: '#ecfdf5' }, // emerald
    { color: '#0d9488', bg: '#f0fdfa' }, // teal
    { color: '#0891b2', bg: '#ecfeff' }, // cyan
    { color: '#0284c7', bg: '#f0f9ff' }, // sky
    { color: '#2563eb', bg: '#eff6ff' }, // blue
    { color: '#4f46e5', bg: '#eef2ff' }, // indigo
    { color: '#7c3aed', bg: '#f5f3ff' }, // violet
    { color: '#9333ea', bg: '#faf5ff' }, // purple
    { color: '#c026d3', bg: '#fdf4ff' }, // fuchsia
    { color: '#db2777', bg: '#fdf2f8' }, // pink
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

// Apply colors to tags
function applyTagColors() {
  document.querySelectorAll('.tag, .tag-link').forEach(el => {
    const text = el.textContent.trim().toLowerCase();
    const { color, bg } = stringToColor(text);
    el.style.color = color;
    el.style.backgroundColor = bg;
  });
}

// Search and Filter functionality
document.addEventListener('DOMContentLoaded', () => {
  // Apply tag colors on load
  applyTagColors();
  const searchInput = document.getElementById('search-input');
  const postsContainer = document.getElementById('posts-container');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  // Mobile menu toggle
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
  }

  // Search overlay functionality
  const searchToggle = document.getElementById('search-toggle');
  const searchOverlay = document.getElementById('search-overlay');
  const searchClose = document.getElementById('search-close');
  const searchOverlayInput = document.getElementById('search-overlay-input');
  const searchResults = document.getElementById('search-results');
  let postsData = null;

  // Load posts data for search
  async function loadPostsData() {
    if (postsData) return postsData;
    try {
      const response = await fetch('/posts.json');
      postsData = await response.json();
      return postsData;
    } catch (e) {
      console.error('Failed to load posts data:', e);
      return [];
    }
  }

  // Open search overlay
  if (searchToggle && searchOverlay) {
    searchToggle.addEventListener('click', async () => {
      searchOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      await loadPostsData();
      setTimeout(() => searchOverlayInput?.focus(), 100);
    });
  }

  // Close search overlay
  function closeSearch() {
    searchOverlay?.classList.remove('open');
    document.body.style.overflow = '';
    if (searchOverlayInput) searchOverlayInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
  }

  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOverlay?.classList.contains('open')) {
      closeSearch();
    }
  });

  // Close on overlay background click
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  // Live search
  let searchDebounce;
  if (searchOverlayInput && searchResults) {
    searchOverlayInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          searchResults.innerHTML = '';
          return;
        }

        const results = (postsData || []).filter(post => {
          return post.title.toLowerCase().includes(query) ||
                 post.excerpt.toLowerCase().includes(query) ||
                 post.category.toLowerCase().includes(query) ||
                 post.tags.some(t => t.toLowerCase().includes(query));
        });

        if (results.length === 0) {
          searchResults.innerHTML = '<div class="search-no-results">No posts found</div>';
        } else {
          searchResults.innerHTML = results.map(post => `
            <a href="/posts/${post.slug}.html" class="search-result-item">
              <img src="${post.thumbnail}" alt="${post.title}">
              <div class="search-result-info">
                <h4>${post.title}</h4>
                <p>${post.excerpt}</p>
              </div>
            </a>
          `).join('');
        }
      }, 150);
    });
  }

  if (!postsContainer) return;

  const postCards = postsContainer.querySelectorAll('.post-card');
  let currentCategory = 'all';
  let searchTerm = '';

  // Create no results message element
  let noResultsMsg = document.getElementById('no-results');
  if (!noResultsMsg) {
    noResultsMsg = document.createElement('div');
    noResultsMsg.id = 'no-results';
    noResultsMsg.className = 'no-results hidden';
    noResultsMsg.innerHTML = '<p>No posts found matching your criteria.</p>';
    postsContainer.parentNode.insertBefore(noResultsMsg, postsContainer.nextSibling);
  }

  // Check URL params for category and tag filter
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('cat');
  const tagParam = urlParams.get('tag');
  let currentTag = tagParam || '';

  if (catParam) {
    currentCategory = catParam;
  }

  // Filter posts based on category, tag, and search term
  function filterPosts() {
    let visibleCount = 0;

    postCards.forEach(card => {
      const category = card.dataset.category;
      const tags = (card.dataset.tags || '').toLowerCase();
      const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const excerpt = card.querySelector('p')?.textContent.toLowerCase() || '';

      const matchesCategory = currentCategory === 'all' || category === currentCategory;
      const matchesTag = currentTag === '' || tags.includes(currentTag.toLowerCase());
      const matchesSearch = searchTerm === '' ||
        title.includes(searchTerm) ||
        excerpt.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        category.includes(searchTerm);

      if (matchesCategory && matchesTag && matchesSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    // Show/hide no results message
    if (noResultsMsg) {
      noResultsMsg.classList.toggle('hidden', visibleCount > 0);
    }
  }

  // Initial filter if category or tag param exists
  if (catParam || tagParam) {
    filterPosts();
  }

  // Sidebar search input handler with debounce (if exists)
  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTerm = e.target.value.toLowerCase().trim();
        filterPosts();
      }, 200);
    });
  }
});
