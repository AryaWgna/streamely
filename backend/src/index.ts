import { Elysia, t } from "elysia";
import { cors } from '@elysiajs/cors';

const TVMAZE_API = "https://api.tvmaze.com";
const OMDB_API_KEY = "thewdb"; // Publicly available testing key

let showsDB: any[] = [];
let animeMovies: any[] = [];
let dbReady = false;

// 40+ Iconic Anime Movies IMDB IDs
const animeMovieIDs = [
  'tt0245429', 'tt5311514', 'tt5323662', 'tt0119698', 'tt0347149', 'tt0094625', 'tt0095327', 'tt0096283',
  'tt0156887', 'tt0113568', 'tt9095030', 'tt16428256', 'tt0169858', 'tt0097814', 'tt0092067', 'tt0808506',
  'tt2140510', 'tt0845928', 'tt11032374', 'tt14308084', 'tt0087544', 'tt0104571', 'tt2013293', 'tt0876563',
  'tt0983213', 'tt2591814', 'tt1483797', 'tt1474261', 'tt0388473', 'tt0263306', 'tt6587046', 'tt16183464',
  'tt7958640', 'tt12287010', 'tt7331818', 'tt7232248', 'tt1833843', 'tt0113824', 'tt1568921', 'tt6336356',
  'tt10362388', 'tt8306046', 'tt31018318'
];

async function populateDB() {
  console.log("🚀 Starting MASSIVE Database Extraction...");
  
  // 1. Fetch Anime Movies from OMDB dynamically
  console.log(`Fetching ${animeMovieIDs.length} Anime Movies from OMDB...`);
  for (let i = 0; i < animeMovieIDs.length; i += 10) {
    const batch = animeMovieIDs.slice(i, i + 10);
    const promises = batch.map(id => fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${id}`).then(r => r.json()).catch(() => null));
    const results = await Promise.all(promises);
    
    results.forEach(res => {
      if (res && res.Response === "True" && res.Poster && res.Poster !== 'N/A') {
        animeMovies.push({
          id: res.imdbID,
          name: res.Title,
          image: res.Poster,
          banner: res.Poster,
          genres: res.Genre?.split(', ') || ['Anime'],
          rating: parseFloat(res.imdbRating) || 0,
          summary: res.Plot || 'Deskripsi tidak tersedia.',
          imdb: res.imdbID,
          year: parseInt(res.Year) || 0,
          type: 'movie'
        });
      }
    });
    await new Promise(r => setTimeout(r, 500)); // Rate limit safety
  }
  console.log(`✅ Berhasil memuat ${animeMovies.length} Anime Movies spesial!`);

  // 2. Fetch TV Series (15,000 shows from TVmaze)
  console.log("🚀 Fetching 15,000+ TV Shows dari TVmaze...");
  let tempDB: any[] = [];
  const totalPages = 60; 
  const batchSize = 10; 

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = Array.from({ length: batchSize }, (_, k) => i + k);
    console.log(`Mengunduh halaman ${batch[0]} hingga ${batch[batch.length - 1]}...`);
    
    try {
      const promises = batch.map(page => 
        fetch(`${TVMAZE_API}/shows?page=${page}`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      
      results.flat().forEach((show: any) => {
        // STRICT FILTERING: Must have valid medium image, summary, and IMDB ID!
        if (show && show.image?.medium && show.externals?.imdb) {
          const imgUrl = show.image.medium;
          if (imgUrl.trim() !== '' && !imgUrl.includes('no-img')) {
            tempDB.push({
              id: show.id,
              name: show.name,
              image: imgUrl,
              banner: show.image?.original || imgUrl,
              genres: show.genres || [],
              rating: show.rating?.average || 0,
              summary: show.summary || 'Deskripsi tidak tersedia.',
              imdb: show.externals.imdb,
              year: show.premiered ? parseInt(show.premiered.substring(0,4)) : 0,
              type: 'tv'
            });
          }
        }
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`Error processing batch starting at page ${i}`);
    }
  }

  showsDB = tempDB;
  dbReady = true;
  console.log(`✅ EXCELLENT! Database populated successfully with ${showsDB.length} high-quality shows!`);
}
populateDB();

const app = new Elysia()
  .use(cors())
  .get("/", () => "Elysia Streaming API is running!")
  
  .get("/api/explore", ({ query }) => {
    if (!dbReady || showsDB.length === 0) return { error: "Sedang mengunduh data..." };
    
    let results = [...animeMovies, ...showsDB];
    
    // Filter by Genre
    if (query.genre && query.genre !== 'All') {
      results = results.filter(s => s.genres.includes(query.genre));
    }
    
    // Filter by Year
    if (query.year && query.year !== 'All') {
      results = results.filter(s => s.year === parseInt(query.year!));
    }
    
    // Sorting
    if (query.sort === 'az') {
      results.sort((a, b) => a.name.localeCompare(b.name));
    } else if (query.sort === 'za') {
      results.sort((a, b) => b.name.localeCompare(a.name));
    } else if (query.sort === 'newest') {
      results.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (query.sort === 'oldest') {
      results.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    } else {
      // Default: Highest Rated
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    // Pagination
    const page = parseInt(query.page || '1');
    const limit = 40;
    const startIndex = (page - 1) * limit;
    
    return {
      total: results.length,
      page,
      totalPages: Math.ceil(results.length / limit),
      data: results.slice(startIndex, startIndex + limit)
    };
  }, {
    query: t.Object({
      genre: t.Optional(t.String()),
      year: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      page: t.Optional(t.String())
    })
  })

  .get("/api/details", async ({ query }) => {
    try {
      if (query.type === 'movie') {
        const res = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${query.imdb}`);
        const data = await res.json();
        return {
          cast: data.Actors && data.Actors !== 'N/A' ? data.Actors : 'Tidak diketahui',
          director: data.Director && data.Director !== 'N/A' ? data.Director : 'Tidak diketahui'
        };
      } else {
        const res = await fetch(`${TVMAZE_API}/shows/${query.id}?embed=cast&embed=crew`);
        const data = await res.json();
        
        let cast = data._embedded?.cast?.slice(0, 5).map((c: any) => c.person.name).join(', ') || 'Tidak diketahui';
        let creator = data._embedded?.crew?.filter((c: any) => c.type === 'Creator' || c.type === 'Executive Producer')
                          .slice(0, 3).map((c: any) => c.person.name).join(', ') || 'Tidak diketahui';
        
        // OMDB Fallback Hack for missing TVmaze data
        if ((cast === 'Tidak diketahui' || creator === 'Tidak diketahui' || cast.length < 3) && query.imdb && query.imdb !== 'null') {
           try {
             const omdbRes = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${query.imdb}`);
             const omdbData = await omdbRes.json();
             
             if ((cast === 'Tidak diketahui' || cast.length < 3) && omdbData.Actors && omdbData.Actors !== 'N/A') {
                cast = omdbData.Actors;
             }
             if ((creator === 'Tidak diketahui' || creator.length < 3) && omdbData.Writer && omdbData.Writer !== 'N/A') {
                creator = omdbData.Writer; 
             } else if ((creator === 'Tidak diketahui' || creator.length < 3) && omdbData.Director && omdbData.Director !== 'N/A') {
                creator = omdbData.Director;
             }
           } catch (e) {}
        }
                          
        return {
          cast: cast.length > 2 ? cast : 'Tidak diketahui',
          director: creator.length > 2 ? creator : 'Tidak diketahui',
          network: data.network?.name || data.webChannel?.name || 'Tidak diketahui'
        };
      }
    } catch (e) {
      return { cast: 'Tidak diketahui', director: 'Tidak diketahui' };
    }
  }, {
    query: t.Object({
      id: t.String(),
      imdb: t.String(),
      type: t.String()
    })
  })

  .get("/api/home", () => {
    if (!dbReady || showsDB.length === 0) {
      return { error: "Sedang mengunduh 15.000+ data film ke dalam sistem, mohon tunggu beberapa detik lalu coba lagi... 🚀" };
    }

    const sortByRating = (arr: any[]) => [...arr].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Create massive categories (up to 1000 items each!)
    const animeSeries = sortByRating(showsDB.filter(s => s.genres.includes("Anime")));
    const cartoonSeries = sortByRating(showsDB.filter(s => 
      s.genres.includes("Children") || s.genres.includes("Family") || (s.genres.includes("Animation") && !s.genres.includes("Anime"))
    ));
    const realityShows = sortByRating(showsDB.filter(s => s.genres.includes("Reality") || s.genres.includes("DIY") || s.genres.includes("Food") || s.genres.includes("Travel")));
    const trending = sortByRating(showsDB); // Highest rated of ALL TIME
    const actionSeries = sortByRating(showsDB.filter(s => s.genres.includes("Action") || s.genres.includes("Adventure")));
    const comedySeries = sortByRating(showsDB.filter(s => s.genres.includes("Comedy")));
    const scifiHorror = sortByRating(showsDB.filter(s => s.genres.includes("Science-Fiction") || s.genres.includes("Horror")));
    const romanceDrama = sortByRating(showsDB.filter(s => s.genres.includes("Romance") || s.genres.includes("Drama")));

    return {
      hero: trending[Math.floor(Math.random() * 20)], // Random hero from top 20
      categories: [
        { title: "Trending Now", data: trending.slice(0, 1000) },
        { title: "Anime Masterpieces", data: animeMovies },
        { title: "Anime Series", data: animeSeries.slice(0, 1000) },
        { title: "Family & Animation", data: cartoonSeries.slice(0, 1000) },
        { title: "Reality & Lifestyle", data: realityShows.slice(0, 1000) },
        { title: "Action & Adventure", data: actionSeries.slice(0, 1000) },
        { title: "Sci-Fi & Horror", data: scifiHorror.slice(0, 1000) },
        { title: "Romance & Drama", data: romanceDrama.slice(0, 1000) },
        { title: "Comedy", data: comedySeries.slice(0, 1000) }
      ]
    };
  })

  .get("/api/search", async ({ query }) => {
    try {
      if (!query.q) return [];
      const response = await fetch(`${TVMAZE_API}/search/shows?q=${query.q}`);
      if (!response.ok) throw new Error("Failed to fetch from TVmaze");
      const data = await response.json();
      
      const results = data.map((item: any) => ({
        id: item.show.id,
        name: item.show.name,
        image: item.show.image?.medium || item.show.image?.original || null,
        banner: item.show.image?.original || null,
        genres: item.show.genres,
        rating: item.show.rating?.average,
        summary: item.show.summary || 'Deskripsi tidak tersedia.',
        imdb: item.show.externals?.imdb || null,
        type: 'tv'
      })).filter((s: any) => s.image && s.imdb);

      const manualMatches = animeMovies.filter(a => a.name.toLowerCase().includes(query.q!.toLowerCase()));
      return [...manualMatches, ...results];
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    query: t.Object({
      q: t.Optional(t.String())
    })
  })

  .listen(3000);

console.log(`🚀 Elysia Streaming Backend running at http://${app.server?.hostname}:${app.server?.port}`);
