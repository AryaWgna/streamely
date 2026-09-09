import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";

const TVMAZE_API = "https://api.tvmaze.com";
const OMDB_API_KEY = process.env.OMDB_API_KEY ?? "thewdb";

interface Show {
  id: string | number;
  name: string;
  image: string;
  banner: string;
  genres: string[];
  rating: number;
  summary: string;
  imdb: string;
  year: number;
  type: "movie" | "tv";
}

interface Episode {
  number: number;
  name: string;
}

interface ShowDetails {
  cast: string;
  director: string;
  network?: string;
  seasons?: Record<number, Episode[]>;
}

const showsDB: Show[] = [];
const moviesDB = new Map<string, Show>();
let dbReady = false;

const ANIME_MOVIE_IDS = [
  "tt0245429", "tt5311514", "tt5323662", "tt0119698", "tt0347149", "tt0094625", "tt0095327", "tt0096283",
  "tt0156887", "tt0113568", "tt9095030", "tt16428256", "tt0169858", "tt0097814", "tt0092067", "tt0808506",
  "tt2140510", "tt0845928", "tt11032374", "tt14308084", "tt0087544", "tt0104571", "tt2013293", "tt0876563",
  "tt0983213", "tt2591814", "tt1483797", "tt1474261", "tt0388473", "tt0263306", "tt6587046", "tt16183464",
  "tt7958640", "tt12287010", "tt7331818", "tt7232248", "tt1833843", "tt0113824", "tt1568921", "tt6336356",
  "tt10362388", "tt8306046", "tt31018318",
];

function parseOmdbResponse(res: Record<string, string>, genreTag?: string): Show | null {
  if (!res || res.Response !== "True" || !res.Poster || res.Poster === "N/A") {
    return null;
  }

  const genres = res.Genre?.split(", ") || [];
  if (genreTag && !genres.includes(genreTag)) {
    genres.push(genreTag);
  }

  return {
    id: res.imdbID,
    name: res.Title,
    image: res.Poster,
    banner: res.Poster,
    genres,
    rating: parseFloat(res.imdbRating) || 0,
    summary: res.Plot || "Deskripsi tidak tersedia.",
    imdb: res.imdbID,
    year: parseInt(res.Year) || 0,
    type: "movie",
  };
}

async function fetchOmdbById(id: string): Promise<Show | null> {
  try {
    const res = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${id}`);
    return parseOmdbResponse(await res.json());
  } catch (err) {
    console.error(`OMDB fetch failed for ID "${id}":`, err);
    return null;
  }
}

async function fetchOmdbBySearch(
  queries: string[],
  pagesPerQuery: number,
  genreTag?: string,
  delayMs = 300,
): Promise<void> {
  for (const q of queries) {
    for (let page = 1; page <= pagesPerQuery; page++) {
      try {
        const res = await fetch(
          `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${q}&type=movie&page=${page}`,
        );
        const data = await res.json();
        if (!data.Search) continue;

        const details = await Promise.all(
          data.Search.map((m: { imdbID: string }) => fetchOmdbById(m.imdbID)),
        );

        for (const show of details) {
          if (!show) continue;
          if (genreTag && !show.genres.includes(genreTag)) {
            show.genres.push(genreTag);
          }
          moviesDB.set(show.imdb, show);
        }

        await new Promise((r) => setTimeout(r, delayMs));
      } catch (err) {
        console.error(`OMDB search failed for "${q}" page ${page}:`, err);
      }
    }
  }
}

async function populateDB() {
  console.log("Starting database population...");

  // Seed anime movies by known IMDB IDs
  console.log(`Fetching ${ANIME_MOVIE_IDS.length} anime movies from OMDB...`);
  for (let i = 0; i < ANIME_MOVIE_IDS.length; i += 10) {
    const batch = ANIME_MOVIE_IDS.slice(i, i + 10);
    const results = await Promise.all(batch.map(fetchOmdbById));
    for (const show of results) {
      if (show) moviesDB.set(show.imdb, show);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`Loaded ${moviesDB.size} anime movies.`);

  // Fetch TV series from TVmaze
  console.log("Fetching TV shows from TVmaze...");
  const totalPages = 60;
  const batchSize = 10;

  for (let i = 0; i < totalPages; i += batchSize) {
    const pageNumbers = Array.from({ length: batchSize }, (_, k) => i + k);
    console.log(`Downloading pages ${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}...`);

    try {
      const responses = await Promise.all(
        pageNumbers.map((page) =>
          fetch(`${TVMAZE_API}/shows?page=${page}`)
            .then((res) => (res.ok ? res.json() : []))
            .catch(() => []),
        ),
      );

      for (const show of responses.flat()) {
        const imgUrl = show?.image?.medium;
        const imdb = show?.externals?.imdb;
        if (!imgUrl || !imdb || imgUrl.trim() === "" || imgUrl.includes("no-img")) continue;

        showsDB.push({
          id: show.id,
          name: show.name,
          image: imgUrl,
          banner: show.image?.original || imgUrl,
          genres: show.genres || [],
          rating: show.rating?.average || 0,
          summary: show.summary || "Deskripsi tidak tersedia.",
          imdb,
          year: show.premiered ? parseInt(show.premiered.substring(0, 4)) : 0,
          type: "tv",
        });
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`TVmaze batch failed starting at page ${i}:`, err);
    }
  }

  // Fetch horror movies via keyword search
  console.log("Fetching horror movies from OMDB...");
  await fetchOmdbBySearch(
    ["horror", "scary", "ghost", "zombie", "demon", "vampire", "slasher", "paranormal"],
    3,
    "Horror",
  );

  // Fetch Indonesian movies via keyword search
  console.log("Fetching Indonesian movies from OMDB...");
  await fetchOmdbBySearch(
    [
      "pengabdi", "kuntilanak", "pocong", "warkop", "dilan", "laskar", "gundala",
      "srimulat", "habibie", "merantau", "raid", "jailangkung", "kkn", "tuyul", "suzzanna",
    ],
    2,
    "Indonesian",
  );

  console.log(`Database ready: ${showsDB.length} TV shows, ${moviesDB.size} movies.`);
  dbReady = true;
}

populateDB();

const ITEMS_PER_PAGE = 40;
const MAX_CATEGORY_SIZE = 50;
const UNKNOWN = "Tidak diketahui";

function sortByRating(arr: Show[]): Show[] {
  return [...arr].sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

function getAllContent(): Show[] {
  return [...Array.from(moviesDB.values()), ...showsDB];
}

const app = new Elysia()
  .use(cors())
  .get("/", () => "Elysia Streaming API is running.")

  .get("/api/explore", ({ query }) => {
    if (!dbReady || showsDB.length === 0) {
      return { error: "Data sedang dimuat, silakan coba lagi." };
    }

    let results = getAllContent();

    if (query.genre && query.genre !== "All") {
      results = results.filter((s) => s.genres.includes(query.genre!));
    }

    if (query.year && query.year !== "All") {
      const yearNum = parseInt(query.year);
      results = results.filter((s) => s.year === yearNum);
    }

    switch (query.sort) {
      case "az":
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        results.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "newest":
        results.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "oldest":
        results.sort((a, b) => (a.year || 9999) - (b.year || 9999));
        break;
      default:
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    const page = parseInt(query.page || "1");
    const startIndex = (page - 1) * ITEMS_PER_PAGE;

    return {
      total: results.length,
      page,
      totalPages: Math.ceil(results.length / ITEMS_PER_PAGE),
      data: results.slice(startIndex, startIndex + ITEMS_PER_PAGE),
    };
  }, {
    query: t.Object({
      genre: t.Optional(t.String()),
      year: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      page: t.Optional(t.String()),
    }),
  })

  .get("/api/details", async ({ query }): Promise<ShowDetails> => {
    try {
      if (query.type === "movie") {
        const res = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${query.imdb}`);
        const data = await res.json();
        return {
          cast: data.Actors && data.Actors !== "N/A" ? data.Actors : UNKNOWN,
          director: data.Director && data.Director !== "N/A" ? data.Director : UNKNOWN,
        };
      }

      const res = await fetch(
        `${TVMAZE_API}/shows/${query.id}?embed=cast&embed=crew&embed=episodes`,
      );
      const data = await res.json();

      let cast =
        data._embedded?.cast
          ?.slice(0, 5)
          .map((c: { person: { name: string } }) => c.person.name)
          .join(", ") || UNKNOWN;

      let creator =
        data._embedded?.crew
          ?.filter((c: { type: string }) => c.type === "Creator" || c.type === "Executive Producer")
          .slice(0, 3)
          .map((c: { person: { name: string } }) => c.person.name)
          .join(", ") || UNKNOWN;

      const seasonsData: Record<number, Episode[]> = {};
      if (data._embedded?.episodes) {
        for (const ep of data._embedded.episodes) {
          if (!seasonsData[ep.season]) seasonsData[ep.season] = [];
          seasonsData[ep.season].push({ number: ep.number, name: ep.name });
        }
      }

      // Supplement missing TVmaze metadata from OMDB
      const hasMissingData =
        (cast === UNKNOWN || cast.length < 3 || creator === UNKNOWN) &&
        query.imdb &&
        query.imdb !== "null";

      if (hasMissingData) {
        try {
          const omdbRes = await fetch(
            `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${query.imdb}`,
          );
          const omdb = await omdbRes.json();

          if ((cast === UNKNOWN || cast.length < 3) && omdb.Actors && omdb.Actors !== "N/A") {
            cast = omdb.Actors;
          }
          if (creator === UNKNOWN || creator.length < 3) {
            if (omdb.Writer && omdb.Writer !== "N/A") {
              creator = omdb.Writer;
            } else if (omdb.Director && omdb.Director !== "N/A") {
              creator = omdb.Director;
            }
          }
        } catch (err) {
          console.error(`OMDB fallback failed for "${query.imdb}":`, err);
        }
      }

      return {
        cast: cast.length > 2 ? cast : UNKNOWN,
        director: creator.length > 2 ? creator : UNKNOWN,
        network: data.network?.name || data.webChannel?.name || UNKNOWN,
        seasons: seasonsData,
      };
    } catch (err) {
      console.error("Details fetch failed:", err);
      return { cast: UNKNOWN, director: UNKNOWN };
    }
  }, {
    query: t.Object({
      id: t.String(),
      imdb: t.String(),
      type: t.String(),
    }),
  })

  .get("/api/home", () => {
    if (!dbReady || showsDB.length === 0) {
      return { error: "Data sedang dimuat, silakan coba lagi." };
    }

    const allData = getAllContent();
    const byGenre = (genre: string) => sortByRating(allData.filter((s) => s.genres.includes(genre)));

    const trending = sortByRating(allData);
    const heroPool = trending.slice(0, 20);

    return {
      hero: heroPool[Math.floor(Math.random() * heroPool.length)],
      categories: [
        { title: "Trending Now", data: trending.slice(0, MAX_CATEGORY_SIZE) },
        { title: "Sinema Indonesia", data: byGenre("Indonesian").slice(0, MAX_CATEGORY_SIZE) },
        { title: "Horror & Thriller", data: sortByRating(allData.filter((s) => s.genres.includes("Horror") || s.genres.includes("Thriller"))).slice(0, MAX_CATEGORY_SIZE) },
        { title: "Anime & Animation", data: byGenre("Anime").slice(0, MAX_CATEGORY_SIZE) },
        { title: "Family & Kids", data: sortByRating(allData.filter((s) => s.genres.includes("Children") || s.genres.includes("Family") || (s.genres.includes("Animation") && !s.genres.includes("Anime")))).slice(0, MAX_CATEGORY_SIZE) },
        { title: "Reality & Lifestyle", data: sortByRating(allData.filter((s) => s.genres.includes("Reality") || s.genres.includes("DIY") || s.genres.includes("Food") || s.genres.includes("Travel"))).slice(0, MAX_CATEGORY_SIZE) },
        { title: "Action & Adventure", data: sortByRating(allData.filter((s) => s.genres.includes("Action") || s.genres.includes("Adventure"))).slice(0, MAX_CATEGORY_SIZE) },
        { title: "Science Fiction", data: byGenre("Science-Fiction").slice(0, MAX_CATEGORY_SIZE) },
        { title: "Romance & Drama", data: sortByRating(allData.filter((s) => s.genres.includes("Romance") || s.genres.includes("Drama"))).slice(0, MAX_CATEGORY_SIZE) },
        { title: "Comedy", data: byGenre("Comedy").slice(0, MAX_CATEGORY_SIZE) },
      ],
    };
  })

  .get("/api/search", async ({ query }) => {
    if (!query.q) return [];

    try {
      const response = await fetch(`${TVMAZE_API}/search/shows?q=${query.q}`);
      if (!response.ok) throw new Error("TVmaze search request failed");
      const data = await response.json();

      const tvResults: Show[] = data
        .map((item: { show: Record<string, any> }) => ({
          id: item.show.id,
          name: item.show.name,
          image: item.show.image?.medium || item.show.image?.original || null,
          banner: item.show.image?.original || null,
          genres: item.show.genres,
          rating: item.show.rating?.average,
          summary: item.show.summary || "Deskripsi tidak tersedia.",
          imdb: item.show.externals?.imdb || null,
          type: "tv" as const,
        }))
        .filter((s: Show) => s.image && s.imdb);

      const searchTerm = query.q.toLowerCase();
      const movieMatches = Array.from(moviesDB.values()).filter((m) =>
        m.name.toLowerCase().includes(searchTerm),
      );

      return [...movieMatches, ...tvResults];
    } catch (err) {
      console.error("Search failed:", err);
      return { error: (err as Error).message };
    }
  }, {
    query: t.Object({
      q: t.Optional(t.String()),
    }),
  })

  .listen(3000);

console.log(`Backend running at http://${app.server?.hostname}:${app.server?.port}`);
