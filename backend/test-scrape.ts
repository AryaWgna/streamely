import * as cheerio from 'cheerio';

async function test() {
  const res = await fetch('https://www.imdb.com/title/tt0241527/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const scriptData = $('script[type="application/ld+json"]').html();
  if (scriptData) {
    const data = JSON.parse(scriptData);
    console.log('Type:', data['@type']);
    const actors = data.actor ? data.actor.map(a => a.name) : [];
    console.log('Actors:', actors.join(', '));
    const directors = data.director ? data.director.map(d => d.name) : (data.creator ? data.creator.filter(c => c['@type'] === 'Person').map(c => c.name) : []);
    console.log('Directors/Creators:', directors.join(', '));
  } else {
    console.log("No JSON-LD");
  }
}

test();
