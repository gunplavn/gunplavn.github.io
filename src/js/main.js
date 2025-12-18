// Search and Filter functionality
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const categoryFilters = document.getElementById('category-filters');
  const postsContainer = document.getElementById('posts-container');
  const featuredPost = document.querySelector('.featured-post');

  if (!postsContainer) return;

  const postCards = postsContainer.querySelectorAll('.post-card');
  const filterButtons = categoryFilters?.querySelectorAll('.category-tag') || [];
  let currentCategory = 'all';
  let searchTerm = '';

  // Check URL params for category filter
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('cat');
  if (catParam) {
    currentCategory = catParam;
    // Update active button
    filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === catParam);
    });
    // Remove active from "All" if category is set
    const allBtn = categoryFilters?.querySelector('[data-category="all"]');
    if (allBtn && catParam !== 'all') {
      allBtn.classList.remove('active');
    }
  }

  // Filter posts based on category and search term
  function filterPosts() {
    let visibleCount = 0;

    postCards.forEach(card => {
      const category = card.dataset.category;
      const tags = (card.dataset.tags || '').toLowerCase();
      const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const excerpt = card.querySelector('p')?.textContent.toLowerCase() || '';

      const matchesCategory = currentCategory === 'all' || category === currentCategory;
      const matchesSearch = searchTerm === '' ||
        title.includes(searchTerm) ||
        excerpt.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        category.includes(searchTerm);

      if (matchesCategory && matchesSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    // Hide featured post if filtering or searching
    if (featuredPost) {
      const shouldHideFeatured = currentCategory !== 'all' || searchTerm !== '';
      featuredPost.classList.toggle('hidden', shouldHideFeatured);
    }
  }

  // Initial filter if category param exists
  if (catParam) {
    filterPosts();
  }

  // Search input handler with debounce
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

  // Category filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Set current category
      currentCategory = btn.dataset.category;
      filterPosts();

      // Update URL without reload
      const url = new URL(window.location);
      if (currentCategory === 'all') {
        url.searchParams.delete('cat');
      } else {
        url.searchParams.set('cat', currentCategory);
      }
      window.history.pushState({}, '', url);
    });
  });

  // Search toggle in header
  const searchToggle = document.getElementById('search-toggle');
  if (searchToggle && searchInput) {
    searchToggle.addEventListener('click', () => {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});
