<script>
  import { onMount } from 'svelte';
  
  let categories = [];
  let heroData = null;
  let loading = true;
  let error = null;
  let currentView = 'home'; // 'home', 'explore', 'search', 'watchlist'
  
  let searchQuery = '';
  let searchResults = [];
  let isSearching = false;

  // Explore State
  let exploreData = [];
  let exploreLoading = false;
  let filterGenre = 'All';
  let filterYear = 'All';
  let sortOption = 'popular';
  let explorePage = 1;
  let exploreTotalPages = 1;
  
  // Personalization State
  let watchlist = [];
  let watchHistory = [];
  let recommendations = [];

  let activeVideo = null;
  let activeDetails = null;
  let similarShows = [];
  let isPlaying = false;
  
  // Video Player Options
  let selectedAudio = 'sub'; // 'sub', 'dub'
  let selectedServer = 'vidsrc'; 
  let selectedSubtitle = 'id'; // Default Indonesian

  const subtitleLanguages = [
    { code: 'id', name: '🇮🇩 Indonesia' },
    { code: 'en', name: '🇺🇸 English' },
    { code: 'ja', name: '🇯🇵 Japanese' },
    { code: 'ko', name: '🇰🇷 Korean' },
    { code: 'es', name: '🇪🇸 Spanish' },
    { code: 'fr', name: '🇫🇷 French' },
    { code: 'de', name: '🇩🇪 German' },
    { code: 'th', name: '🇹🇭 Thai' },
    { code: 'ar', name: '🇸🇦 Arabic' }
  ];

  $: videoSource = getIframeSource(activeVideo, selectedServer, selectedAudio, selectedSubtitle);

  function getIframeSource(video, server, audio, subtitle) {
    if (!video) return '';
    const imdb = video.imdb;
    const type = video.type || 'tv';
    
    if (server === 'vidlink') {
      return `https://vidlink.pro/${type}/${imdb}`;
    } else if (server === 'vidsrcto') {
      return `https://vidsrc.to/embed/${type}/${imdb}`;
    } else {
      // Vidsrc supports ds_lang parameter to set default subtitle!
      return `https://vidsrc.me/embed/${type}?imdb=${imdb}&ds_lang=${subtitle}`;
    }
  }

  const allGenres = ["All", "Action", "Adventure", "Anime", "Children", "Comedy", "Crime", "Drama", "Family", "Fantasy", "Horror", "Mystery", "Romance", "Science-Fiction", "Supernatural", "Thriller"];
  const allYears = ["All", ...Array.from({ length: 25 }, (_, i) => 2024 - i)]; 
  
  onMount(async () => {
    const savedWatchlist = localStorage.getItem('streamely_watchlist');
    if (savedWatchlist) watchlist = JSON.parse(savedWatchlist);

    const savedHistory = localStorage.getItem('streamely_history');
    if (savedHistory) watchHistory = JSON.parse(savedHistory);

    await fetchHome();
  });

  $: if (categories.length > 0) {
    generateRecommendations();
  }

  function generateRecommendations() {
    if (watchHistory.length === 0) {
      recommendations = [];
      return;
    }
    
    const genreCounts = {};
    watchHistory.forEach(show => {
      if (show.genres) {
        show.genres.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });
    
    const sortedGenres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]);
    const topGenres = sortedGenres.slice(0, 3);
    
    const watchedIds = new Set(watchHistory.map(h => h.id));
    let recommendedSet = new Map();
    
    categories.forEach(cat => {
      cat.data.forEach(show => {
        if (!watchedIds.has(show.id)) {
          let score = 0;
          show.genres.forEach(g => {
            if (topGenres.includes(g)) score++;
          });
          
          if (score > 0) {
            show.matchScore = score;
            recommendedSet.set(show.id, show);
          }
        }
      });
    });
    
    let recArray = Array.from(recommendedSet.values());
    recArray.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.rating || 0) - (a.rating || 0);
    });
    
    recommendations = recArray.slice(0, 20);
  }

  async function fetchHome() {
    try {
      const res = await fetch('/api/home');
      const data = await res.json();
      if (data.error) {
        error = data.error;
      } else {
        heroData = data.hero;
        categories = data.categories;
        error = null;
      }
    } catch (err) {
      error = "Failed to connect to backend.";
    } finally {
      loading = false;
    }
  }

  async function fetchExplore() {
    currentView = 'explore';
    exploreLoading = true;
    try {
      const res = await fetch(`/api/explore?genre=${filterGenre}&year=${filterYear}&sort=${sortOption}&page=${explorePage}`);
      const data = await res.json();
      if (data.error) {
        error = data.error;
      } else {
        exploreData = data.data;
        exploreTotalPages = data.totalPages;
        error = null;
      }
    } catch (err) {
      error = "Failed to load exploration data.";
    } finally {
      exploreLoading = false;
    }
  }

  function handleFilterChange() {
    explorePage = 1; 
    fetchExplore();
  }

  function nextPage() {
    if (explorePage < exploreTotalPages) {
      explorePage++;
      fetchExplore();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function prevPage() {
    if (explorePage > 1) {
      explorePage--;
      fetchExplore();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      currentView = 'home';
      return;
    }
    
    currentView = 'search';
    isSearching = true;
    try {
      const res = await fetch(`/api/search?q=${searchQuery}`);
      searchResults = await res.json();
    } catch (err) {
      console.error(err);
    } finally {
      isSearching = false;
    }
  }

  async function openModal(item) {
    activeVideo = item;
    activeDetails = null; // Reset to trigger loading skeleton
    isPlaying = false; // Do not auto-play immediately
    
    // Compute Similar Shows dynamically
    const allShows = [];
    categories.forEach(cat => cat.data.forEach(s => allShows.push(s)));
    
    const similar = allShows.filter(s => 
      s.id !== item.id && 
      s.genres.some(g => item.genres.includes(g))
    ).sort((a,b) => {
      const aMatch = a.genres.filter(g => item.genres.includes(g)).length;
      const bMatch = b.genres.filter(g => item.genres.includes(g)).length;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return (b.rating || 0) - (a.rating || 0);
    });
    
    // Deduplicate
    const uniqueSimilar = Array.from(new Map(similar.map(item => [item.id, item])).values());
    similarShows = uniqueSimilar.slice(0, 10);
    
    // Fetch Extra Details (Actors, Director) from Backend On-Demand
    try {
      const res = await fetch(`/api/details?id=${item.id}&imdb=${item.imdb}&type=${item.type || 'tv'}`);
      if (res.ok) {
        activeDetails = await res.json();
      } else {
        activeDetails = { cast: 'Tidak diketahui', director: 'Tidak diketahui' };
      }
    } catch (e) {
      activeDetails = { cast: 'Tidak diketahui', director: 'Tidak diketahui' };
    }
  }

  function startWatching() {
    isPlaying = true;
    // Save to History ONLY when they click Play
    watchHistory = watchHistory.filter(h => h.id !== activeVideo.id);
    watchHistory.unshift(activeVideo);
    if (watchHistory.length > 20) watchHistory.pop();
    
    localStorage.setItem('streamely_history', JSON.stringify(watchHistory));
    generateRecommendations();
  }

  function closeVideo() {
    activeVideo = null;
    activeDetails = null;
    similarShows = [];
    isPlaying = false;
  }

  function toggleWatchlist(item, e) {
    if (e) e.stopPropagation();
    
    const index = watchlist.findIndex(w => w.id === item.id);
    if (index > -1) {
      watchlist.splice(index, 1);
    } else {
      watchlist.push(item);
    }
    watchlist = [...watchlist]; 
    localStorage.setItem('streamely_watchlist', JSON.stringify(watchlist));
  }

  function isInWatchlist(id) {
    return watchlist.some(w => w.id === id);
  }

  function scrollCarousel(e, node) {
    if (e.deltaY !== 0) {
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    }
  }

  function useHorizontalScroll(node) {
    const handleScroll = (e) => scrollCarousel(e, node);
    node.addEventListener('wheel', handleScroll, { passive: false });
    return {
      destroy() {
        node.removeEventListener('wheel', handleScroll);
      }
    };
  }

  // Icons SVG variables
  const PlayIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const PlusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const CheckIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const SearchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  const StarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<main class="app-container">
  <!-- Navbar -->
  <nav class="navbar" class:scrolled={currentView !== 'home'}>
    <div class="logo-container" on:click={() => { currentView = 'home'; searchQuery = ''; }}>
      <h1>STREAM<span>ELY</span></h1>
    </div>
    
    <div class="nav-links">
      <button class:active={currentView === 'home'} on:click={() => { currentView = 'home'; searchQuery = ''; }}>Home</button>
      <button class:active={currentView === 'explore'} on:click={() => { currentView = 'explore'; searchQuery = ''; fetchExplore(); }}>Explore</button>
      <button class:active={currentView === 'watchlist'} on:click={() => { currentView = 'watchlist'; searchQuery = ''; }}>My List</button>
    </div>

    <form class="search-bar" on:submit={handleSearch}>
      <span class="search-icon">{@html SearchIcon}</span>
      <input type="text" placeholder="Movies, shows and more..." bind:value={searchQuery} />
    </form>
  </nav>

  {#if error}
    <div class="error-state">
      <p>{error}</p>
      <button class="retry-btn" on:click={fetchHome}>Try Again</button>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="shimmer-card main-shimmer"></div>
      <div class="shimmer-row">
        <div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div>
      </div>
    </div>
  {:else}
    
    <!-- HOME VIEW -->
    {#if currentView === 'home'}
      {#if heroData}
        <div class="hero" style="background-image: url('{heroData.banner}');">
          <div class="hero-overlay"></div>
          <div class="hero-content">
            <span class="badge">Highly Recommended</span>
            <h2>{heroData.name}</h2>
            <div class="meta">
              <span class="rating">{@html StarIcon} {heroData.rating}</span>
              <span class="year">{heroData.year || ''}</span>
              <span class="separator">•</span>
              <div class="genres">
                {#each heroData.genres.slice(0,3) as genre, i}
                  <span class="genre-text">{genre}{i < Math.min(2, heroData.genres.length-1) ? ', ' : ''}</span>
                {/each}
              </div>
            </div>
            <p class="summary">{@html heroData.summary}</p>
            <div class="hero-actions">
              <button class="play-btn" on:click={() => openModal(heroData)}>
                {@html PlayIcon} <span>Details & Play</span>
              </button>
              <button class="watchlist-btn hero-wl" on:click={(e) => toggleWatchlist(heroData, e)}>
                {#if isInWatchlist(heroData.id)}
                  {@html CheckIcon} <span>My List</span>
                {:else}
                  {@html PlusIcon} <span>My List</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <div class="categories-container">
        <!-- Recommended Row -->
        {#if recommendations.length > 0}
          <div class="category-row">
            <h3>Recommended For You</h3>
            <div class="carousel" use:useHorizontalScroll>
              {#each recommendations as item}
                <div class="card" on:click={() => openModal(item)}>
                  <img src={item.image} alt={item.name} loading="lazy" />
                  <div class="card-overlay">
                    <span class="card-rating">{@html StarIcon} {item.rating}</span>
                    <h4>{item.name}</h4>
                    <button class="card-wl-btn {isInWatchlist(item.id) ? 'active' : ''}" on:click={(e) => toggleWatchlist(item, e)}>
                      {@html isInWatchlist(item.id) ? CheckIcon : PlusIcon}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Watch History Row -->
        {#if watchHistory.length > 0}
          <div class="category-row">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <h3>Continue Watching</h3>
              <button class="clear-history-btn" on:click={() => { watchHistory = []; localStorage.removeItem('streamely_history'); generateRecommendations(); }}>Clear History</button>
            </div>
            <div class="carousel" use:useHorizontalScroll>
              {#each watchHistory as item}
                <div class="card" on:click={() => openModal(item)}>
                  <img src={item.image} alt={item.name} loading="lazy" />
                  <div class="card-overlay">
                    <h4>{item.name}</h4>
                    <button class="card-wl-btn {isInWatchlist(item.id) ? 'active' : ''}" on:click={(e) => toggleWatchlist(item, e)} title="Watchlist">
                      {@html isInWatchlist(item.id) ? CheckIcon : PlusIcon}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Regular Categories -->
        {#each categories as category}
          <div class="category-row">
            <h3>{category.title}</h3>
            <div class="carousel" use:useHorizontalScroll>
              {#each category.data as item}
                <div class="card" on:click={() => openModal(item)}>
                  <img src={item.image} alt={item.name} loading="lazy" />
                  <div class="card-overlay">
                    <span class="card-rating">{@html StarIcon} {item.rating}</span>
                    <h4>{item.name}</h4>
                    <button class="card-wl-btn {isInWatchlist(item.id) ? 'active' : ''}" on:click={(e) => toggleWatchlist(item, e)}>
                      {@html isInWatchlist(item.id) ? CheckIcon : PlusIcon}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    
    <!-- EXPLORE VIEW -->
    {:else if currentView === 'explore'}
      <div class="page-container">
        <h2>Explore</h2>
        <div class="filters">
          <div class="filter-group">
            <label>Genre</label>
            <select bind:value={filterGenre} on:change={handleFilterChange}>
              {#each allGenres as genre}
                <option value={genre}>{genre}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label>Release Year</label>
            <select bind:value={filterYear} on:change={handleFilterChange}>
              {#each allYears as yr}
                <option value={yr}>{yr}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label>Sort By</label>
            <select bind:value={sortOption} on:change={handleFilterChange}>
              <option value="popular">Popularity</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="az">A - Z</option>
              <option value="za">Z - A</option>
            </select>
          </div>
        </div>

        {#if exploreLoading}
          <div class="grid-layout">
            <div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div>
          </div>
        {:else if exploreData.length === 0}
          <div class="no-results">
            <p>No results matched your filters.</p>
          </div>
        {:else}
          <div class="grid-layout">
            {#each exploreData as item}
              <div class="card" on:click={() => openModal(item)}>
                <img src={item.image} alt={item.name} loading="lazy" />
                <div class="card-overlay">
                  <span class="card-rating">{@html StarIcon} {item.rating}</span>
                  <h4>{item.name}</h4>
                  <button class="card-wl-btn {isInWatchlist(item.id) ? 'active' : ''}" on:click={(e) => toggleWatchlist(item, e)}>
                    {@html isInWatchlist(item.id) ? CheckIcon : PlusIcon}
                  </button>
                </div>
              </div>
            {/each}
          </div>
          
          <div class="pagination">
            <button disabled={explorePage === 1} on:click={prevPage}>Prev</button>
            <span>Page {explorePage} of {exploreTotalPages}</span>
            <button disabled={explorePage === exploreTotalPages} on:click={nextPage}>Next</button>
          </div>
        {/if}
      </div>

    <!-- WATCHLIST VIEW -->
    {:else if currentView === 'watchlist'}
      <div class="page-container">
        <h2>My List</h2>
        
        {#if watchlist.length === 0}
          <div class="no-results">
            <h3>Your list is empty</h3>
            <p>Add shows and movies to your list to easily find them later.</p>
            <button class="retry-btn primary" on:click={() => { currentView = 'explore'; fetchExplore(); }}>Discover Content</button>
          </div>
        {:else}
          <div class="grid-layout">
            {#each watchlist as item}
              <div class="card" on:click={() => openModal(item)}>
                <img src={item.image} alt={item.name} loading="lazy" />
                <div class="card-overlay">
                  <span class="card-rating">{@html StarIcon} {item.rating || 'N/A'}</span>
                  <h4>{item.name}</h4>
                  <button class="card-wl-btn active" on:click={(e) => toggleWatchlist(item, e)}>
                    {@html CheckIcon}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- SEARCH VIEW -->
    {:else if currentView === 'search'}
      <div class="page-container">
        <h2>Results for "{searchQuery}"</h2>
        {#if isSearching}
          <div class="grid-layout">
            <div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div><div class="shimmer-card"></div>
          </div>
        {:else if searchResults.length === 0}
          <div class="no-results">
            <p>No titles matched your search.</p>
          </div>
        {:else}
          <div class="grid-layout">
            {#each searchResults as item}
              <div class="card" on:click={() => openModal(item)}>
                <img src={item.image} alt={item.name} loading="lazy" />
                <div class="card-overlay">
                  <span class="card-rating">{@html StarIcon} {item.rating || 'N/A'}</span>
                  <h4>{item.name}</h4>
                  <button class="card-wl-btn {isInWatchlist(item.id) ? 'active' : ''}" on:click={(e) => toggleWatchlist(item, e)}>
                    {@html isInWatchlist(item.id) ? CheckIcon : PlusIcon}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  <!-- VIDEO MODAL -->
  {#if activeVideo}
    <div class="modal-backdrop" on:click={closeVideo}>
      <div class="modal-content" on:click|stopPropagation>
        <button class="close-btn" on:click={closeVideo}>{@html CloseIcon}</button>
        <div class="video-wrapper">
          {#if isPlaying}
            <iframe src={videoSource} frameborder="0" allowfullscreen></iframe>
          {:else}
            <div class="modal-cover" style="background-image: url('{activeVideo.banner || activeVideo.image}')">
              <div class="modal-cover-overlay"></div>
              <button class="huge-play-btn" on:click={startWatching}>
                {@html PlayIcon}
              </button>
            </div>
          {/if}
        </div>
        <div class="modal-details">
          <div class="modal-header-row">
            <div>
              <h2>{activeVideo.name}</h2>
              <div class="meta">
                <span class="rating">{@html StarIcon} {activeVideo.rating || 'N/A'}</span>
                <span class="year">{activeVideo.year || ''}</span>
              </div>
            </div>
            <button class="watchlist-btn outlined" on:click={() => toggleWatchlist(activeVideo)}>
              {#if isInWatchlist(activeVideo.id)}
                {@html CheckIcon} <span>Remove</span>
              {:else}
                {@html PlusIcon} <span>Add to List</span>
              {/if}
            </button>
          </div>
          
          <div class="modal-split">
            <div class="modal-summary-col">
              <p class="modal-summary">{@html activeVideo.summary}</p>
            </div>
            <div class="modal-meta-col">
              {#if activeDetails}
                <p><span>Cast:</span> {activeDetails.cast}</p>
                <p><span>Creator:</span> {activeDetails.director}</p>
                {#if activeDetails.network}
                  <p><span>Network:</span> {activeDetails.network}</p>
                {/if}
              {:else}
                <div class="shimmer-text"></div>
                <div class="shimmer-text short"></div>
              {/if}
              <p><span>Genres:</span> {activeVideo.genres.join(', ')}</p>

              <!-- Video Options (Sub/Dub, Lang & Server) -->
              <div class="player-options-box">
                <div class="option-row">
                  <span class="option-label">Audio:</span>
                  <div class="toggle-pills">
                    <button class:active={selectedAudio === 'sub'} on:click={() => selectedAudio = 'sub'}>🇯🇵 Sub</button>
                    <button class:active={selectedAudio === 'dub'} on:click={() => selectedAudio = 'dub'}>🇺🇸 Dub</button>
                  </div>
                </div>
                <div class="option-row">
                  <span class="option-label">Subtitle:</span>
                  <select class="server-select" bind:value={selectedSubtitle}>
                    {#each subtitleLanguages as lang}
                      <option value={lang.code}>{lang.name}</option>
                    {/each}
                  </select>
                </div>
                <div class="option-row">
                  <span class="option-label">Server:</span>
                  <select class="server-select" bind:value={selectedServer}>
                    <option value="vidsrc">Server 1 (Default - VIP)</option>
                    <option value="vidlink">Server 2 (Fast Alternate)</option>
                    <option value="vidsrcto">Server 3 (Multi-Sub)</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          <!-- Similar Shows -->
          {#if similarShows.length > 0}
            <div class="similar-shows-section">
              <h3>More Like This</h3>
              <div class="similar-grid">
                {#each similarShows as item}
                  <div class="card similar-card" on:click={() => openModal(item)}>
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <div class="card-overlay">
                      <span class="card-rating">{@html StarIcon} {item.rating}</span>
                      <h4>{item.name}</h4>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<script context="module">
  const CloseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
</script>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Inter', sans-serif;
    background-color: #09090b; /* zinc-950 */
    color: #f8fafc;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  * { box-sizing: border-box; }

  .app-container { min-height: 100vh; }

  /* Navbar */
  .navbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 72px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4%;
    background: linear-gradient(to bottom, rgba(9,9,11,0.9) 0%, rgba(9,9,11,0) 100%);
    transition: background 0.3s ease;
    z-index: 1000;
  }
  .navbar.scrolled {
    background: rgba(9, 9, 11, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .logo-container h1 {
    font-size: 1.6rem;
    font-weight: 800;
    color: #fff;
    margin: 0;
    letter-spacing: 0.5px;
    cursor: pointer;
  }
  .logo-container span { color: #3b82f6; } /* Premium blue accent */

  .nav-links {
    display: flex;
    gap: 32px;
    margin-right: auto;
    margin-left: 48px;
  }
  .nav-links button {
    background: transparent;
    border: none;
    color: #a1a1aa; /* zinc-400 */
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
    padding: 0;
  }
  .nav-links button:hover, .nav-links button.active { color: #fff; }

  /* Search Bar */
  .search-bar {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 12px;
    transition: all 0.2s ease;
  }
  .search-bar:focus-within {
    background: rgba(0, 0, 0, 0.5);
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
  .search-icon { color: #a1a1aa; display: flex; align-items: center; margin-right: 8px; }
  .search-bar input {
    background: transparent;
    border: none;
    color: #fff;
    width: 200px;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: width 0.3s ease;
  }
  .search-bar input:focus { width: 280px; }
  .search-bar input::placeholder { color: #71717a; }

  /* Hero Section */
  .hero {
    position: relative;
    height: 85vh;
    min-height: 600px;
    background-size: cover;
    background-position: center 20%;
    display: flex;
    align-items: flex-end;
    padding: 0 4% 100px;
  }
  .hero-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(to top, #09090b 0%, rgba(9,9,11, 0.4) 60%, rgba(9,9,11,0.1) 100%),
                linear-gradient(to right, #09090b 0%, rgba(9,9,11, 0.2) 60%);
  }
  .hero-content {
    position: relative;
    z-index: 10;
    max-width: 650px;
  }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    font-size: 0.8rem;
    font-weight: 700;
    border-radius: 4px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .hero-content h2 {
    font-size: 4.5rem;
    font-weight: 800;
    line-height: 1.1;
    margin: 0 0 16px 0;
    letter-spacing: -1px;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    font-size: 1rem;
    color: #d4d4d8;
  }
  .rating { display: flex; align-items: center; gap: 4px; font-weight: 600; color: #fff; }
  .separator { color: #52525b; }
  .genres { display: flex; }
  .genre-text { color: #a1a1aa; }
  .summary {
    font-size: 1.15rem;
    line-height: 1.6;
    color: #a1a1aa;
    margin-bottom: 32px;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  /* Buttons */
  .hero-actions { display: flex; gap: 16px; }
  .play-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    color: #000;
    border: none;
    padding: 12px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .play-btn:hover { background: #e4e4e7; }
  
  .watchlist-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
    color: white;
    border: none;
    padding: 12px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .watchlist-btn:hover { background: rgba(255, 255, 255, 0.3); }
  .watchlist-btn.outlined {
    background: transparent;
    border: 1px solid #52525b;
    padding: 10px 24px;
    font-size: 0.95rem;
  }
  .watchlist-btn.outlined:hover { border-color: #fff; background: rgba(255,255,255,0.1); }

  /* Carousel */
  .categories-container {
    padding: 0 4%;
    margin-top: -80px;
    position: relative;
    z-index: 20;
    padding-bottom: 60px;
  }
  .category-row { margin-bottom: 48px; }
  .category-row h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: #e4e4e7;
  }
  .clear-history-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
  }
  .clear-history-btn:hover { color: #ef4444; }
  
  .carousel {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 4px 0 20px 0;
    scrollbar-width: none;
    scroll-behavior: smooth;
  }
  .carousel::-webkit-scrollbar { display: none; }

  /* Card */
  .card {
    flex: 0 0 auto;
    width: 220px;
    aspect-ratio: 2/3;
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: #18181b;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
  }
  .card:hover {
    transform: scale(1.05) translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    z-index: 10;
  }
  .card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.3s;
  }
  .card:hover img { opacity: 0.6; }
  
  .card-overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 24px 16px 16px;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .card:hover .card-overlay { opacity: 1; }
  
  .card-rating {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.85rem; font-weight: 600; color: #fff; margin-bottom: 4px;
  }
  .card h4 { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.2; }

  .card-wl-btn {
    position: absolute;
    top: 12px; right: 12px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 50%;
    width: 36px; height: 36px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s ease;
  }
  .card-wl-btn.active { opacity: 1; background: #3b82f6; border-color: #3b82f6; }
  .card:hover .card-wl-btn { opacity: 1; }
  .card-wl-btn:hover { background: #fff; color: #000; transform: scale(1.1); }
  .card-wl-btn.active:hover { background: #2563eb; color: #fff; }

  /* Generic Pages (Explore, Watchlist, Search) */
  .page-container {
    padding: 120px 4% 60px;
    min-height: 100vh;
  }
  .page-container h2 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 32px;
  }
  
  .filters {
    display: flex;
    gap: 24px;
    margin-bottom: 40px;
    flex-wrap: wrap;
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .filter-group label {
    font-size: 0.8rem;
    color: #a1a1aa;
    font-weight: 600;
  }
  .filter-group select {
    background: #18181b;
    color: white;
    border: 1px solid #27272a;
    padding: 10px 16px;
    border-radius: 6px;
    min-width: 160px;
    font-family: inherit;
    font-size: 0.95rem;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23A1A1AA%22%20d%3D%22M287%2069.4a13.6%2013.6%200%200%200-19.3%200L146.2%20190.9%2024.6%2069.4a13.6%2013.6%200%200%200-19.3%2019.3L136%20220.2c5.3%205.3%2014%205.3%2019.3%200L287%2088.7c5.3-5.3%205.3-14.1%200-19.3z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
  }
  .filter-group select:hover { border-color: #3f3f46; }

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }
  .grid-layout .card { width: 100%; }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 60px;
    gap: 24px;
    color: #a1a1aa;
    font-size: 0.95rem;
  }
  .pagination button {
    background: #18181b;
    color: white;
    border: 1px solid #27272a;
    padding: 10px 24px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: 0.2s;
  }
  .pagination button:hover:not(:disabled) { background: #27272a; border-color: #3f3f46; }
  .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9);
    backdrop-filter: blur(10px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .modal-content {
    background: #09090b;
    width: 90%;
    max-width: 960px;
    max-height: 90vh;
    border-radius: 12px;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
    border: 1px solid #27272a;
  }
  .modal-content::-webkit-scrollbar { width: 8px; }
  .modal-content::-webkit-scrollbar-track { background: transparent; }
  .modal-content::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
  .modal-content::-webkit-scrollbar-thumb:hover { background: #52525b; }

  .close-btn {
    position: absolute;
    top: 24px; right: 24px;
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    width: 44px; height: 44px;
    border-radius: 50%;
    display: flex; justify-content: center; align-items: center;
    cursor: pointer;
    z-index: 20;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
  }
  .close-btn:hover { background: rgba(255,255,255,0.1); }
  
  .video-wrapper {
    position: relative;
    padding-bottom: 56.25%;
    background: #000;
  }
  .video-wrapper iframe {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }

  .modal-cover {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-size: cover; background-position: center 20%;
    display: flex; justify-content: center; align-items: center;
  }
  .modal-cover-overlay {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6);
  }
  .huge-play-btn {
    position: relative; z-index: 10;
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(59, 130, 246, 0.9);
    border: none; color: #fff;
    display: flex; justify-content: center; align-items: center;
    cursor: pointer; transition: transform 0.2s, background 0.2s;
  }
  .huge-play-btn svg { width: 40px; height: 40px; margin-left: 5px; }
  .huge-play-btn:hover { transform: scale(1.1); background: #3b82f6; }

  .modal-details { padding: 32px; }
  .modal-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .modal-header-row h2 { margin: 0 0 8px 0; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; }
  
  .modal-split { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; margin-bottom: 40px; }
  .modal-summary-col { display: flex; flex-direction: column; }
  .modal-summary { color: #a1a1aa; line-height: 1.7; font-size: 1.1rem; margin: 0; }
  
  .modal-meta-col { display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem; color: #d4d4d8; }
  .modal-meta-col p { margin: 0; line-height: 1.5; }
  .modal-meta-col span { color: #71717a; font-weight: 500; margin-right: 4px; }
  
  .player-options-box {
    margin-top: 16px;
    padding: 16px;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .option-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .option-label { font-size: 0.9rem; font-weight: 600; color: #a1a1aa; }
  .toggle-pills {
    display: flex; background: #000; border-radius: 6px; padding: 4px;
  }
  .toggle-pills button {
    background: transparent; border: none; color: #71717a; padding: 6px 12px; border-radius: 4px;
    font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s;
  }
  .toggle-pills button.active { background: #3f3f46; color: #fff; }
  .toggle-pills button:hover:not(.active) { color: #d4d4d8; }
  
  .server-select {
    background: #000; color: #e4e4e7; border: 1px solid #27272a; padding: 6px 12px; border-radius: 6px;
    font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer; min-width: 150px;
  }
  
  .similar-shows-section { margin-top: 24px; border-top: 1px solid #27272a; padding-top: 24px; }
  .similar-shows-section h3 { margin: 0 0 20px 0; font-size: 1.4rem; font-weight: 700; color: #fff; }
  .similar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
  .similar-card { width: 100%; aspect-ratio: 2/3; }

  /* States */
  .no-results, .error-state {
    text-align: center;
    padding: 100px 20px;
    color: #a1a1aa;
  }
  .no-results h3 { color: #fff; font-size: 1.5rem; margin-bottom: 12px; }
  .retry-btn { margin-top: 24px; padding: 12px 24px; background: #27272a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
  .retry-btn.primary { background: #fff; color: #000; }
  .retry-btn:hover { opacity: 0.9; }

  /* Shimmer Loading */
  .loading-state { padding: 120px 4%; }
  .shimmer-card {
    background: #18181b;
    border-radius: 6px;
    aspect-ratio: 2/3;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .shimmer-card::after {
    content: "";
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%);
    animation: shimmer 1.5s infinite;
  }
  .main-shimmer { aspect-ratio: auto; height: 500px; margin-bottom: 40px; }
  .shimmer-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  
  .shimmer-text {
    height: 16px;
    width: 100%;
    background: #27272a;
    border-radius: 4px;
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;
  }
  .shimmer-text.short { width: 60%; }
  .shimmer-text::after {
    content: "";
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%);
    animation: shimmer 1.5s infinite;
  }
  
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
</style>
