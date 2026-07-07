import type { ApiAdapterSpec } from './declarative.js';

/**
 * Built-in API adapters over no-key public JSON endpoints. Each is plain data:
 * a URL template, the dot path to the array, and field paths. Add more without
 * touching engine code.
 */
export const builtinApiAdapters: ApiAdapterSpec[] = [
  // ---- Developer / packages ----
  {
    name: 'npm',
    description: 'npm registry — package search',
    commands: [
      {
        name: 'search',
        description: 'Search npm packages',
        url: 'https://registry.npmjs.org/-/v1/search?text={query}&size=20',
        root: 'objects',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['name', 'version', 'description'],
        item: { name: 'package.name', version: 'package.version', description: 'package.description' },
      },
    ],
  },
  {
    name: 'pypi',
    description: 'PyPI — Python package info',
    commands: [
      {
        name: 'info',
        description: 'Package summary',
        url: 'https://pypi.org/pypi/{0}/json',
        args: [{ name: '<package>', description: 'package name' }],
        text: [
          'info.name',
          'Version:info.version',
          'Summary:info.summary',
          'Author:info.author',
          'License:info.license',
          'Home:info.home_page',
        ],
      },
    ],
  },
  {
    name: 'crates',
    description: 'crates.io — Rust package search',
    commands: [
      {
        name: 'search',
        description: 'Search crates',
        url: 'https://crates.io/api/v1/crates?q={query}&per_page=20',
        root: 'crates',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['name', 'version', 'downloads', 'description'],
        item: { name: 'name', version: 'max_stable_version', downloads: 'downloads', description: 'description' },
      },
    ],
  },
  {
    name: 'gitlab',
    description: 'GitLab — public project search',
    commands: [
      {
        name: 'search',
        description: 'Search projects by stars',
        url: 'https://gitlab.com/api/v4/projects?search={query}&order_by=star_count&sort=desc&per_page=20',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['name', 'stars', 'description'],
        item: { name: 'path_with_namespace', stars: 'star_count', description: 'description', url: 'web_url' },
      },
    ],
  },
  {
    name: 'stackoverflow',
    description: 'Stack Overflow — question search',
    commands: [
      {
        name: 'search',
        description: 'Search questions by votes',
        url: 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q={query}&site=stackoverflow',
        root: 'items',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['score', 'answers', 'title'],
        item: { score: 'score', answers: 'answer_count', title: 'title', url: 'link' },
      },
    ],
  },
  {
    name: 'devto',
    description: 'DEV Community — top articles',
    commands: [
      {
        name: 'top',
        description: 'Popular articles',
        url: 'https://dev.to/api/articles?per_page=20&top=7',
        args: [],
        columns: ['reactions', 'title', 'author'],
        item: { reactions: 'positive_reactions_count', title: 'title', author: 'user.name', url: 'url' },
      },
      {
        name: 'search',
        description: 'Articles by tag',
        url: 'https://dev.to/api/articles?tag={0}&per_page=20',
        args: [{ name: '<tag>', description: 'tag, e.g. rust' }],
        columns: ['reactions', 'title', 'author'],
        item: { reactions: 'positive_reactions_count', title: 'title', author: 'user.name', url: 'url' },
      },
    ],
  },

  // ---- Books / knowledge ----
  {
    name: 'openlibrary',
    description: 'Open Library — book search',
    commands: [
      {
        name: 'search',
        description: 'Search books',
        url: 'https://openlibrary.org/search.json?q={query}&limit=20&fields=title,author_name,first_publish_year,key',
        root: 'docs',
        args: [{ name: '<query>', description: 'title or author' }],
        columns: ['title', 'author', 'year'],
        item: { title: 'title', author: 'author_name.0', year: 'first_publish_year' },
      },
    ],
  },
  {
    name: 'gutenberg',
    description: 'Project Gutenberg — free ebooks',
    commands: [
      {
        name: 'search',
        description: 'Search public-domain books',
        url: 'https://gutendex.com/books?search={query}',
        root: 'results',
        args: [{ name: '<query>', description: 'title or author' }],
        columns: ['title', 'author', 'downloads'],
        item: { title: 'title', author: 'authors.0.name', downloads: 'download_count', id: 'id' },
      },
    ],
  },
  {
    name: 'wikidata',
    description: 'Wikidata — entity search',
    commands: [
      {
        name: 'search',
        description: 'Search entities',
        url: 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}&language=en&format=json&limit=20',
        root: 'search',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['id', 'label', 'description'],
        item: { id: 'id', label: 'label', description: 'description' },
      },
    ],
  },
  {
    name: 'dictionary',
    description: 'Dictionary — English definitions',
    commands: [
      {
        name: 'define',
        description: 'Definitions of a word',
        url: 'https://api.dictionaryapi.dev/api/v2/entries/en/{0}',
        args: [{ name: '<word>', description: 'the word' }],
        root: '0.meanings',
        columns: ['partOfSpeech', 'definition'],
        item: { partOfSpeech: 'partOfSpeech', definition: 'definitions.0.definition' },
      },
    ],
  },
  {
    name: 'urban',
    description: 'Urban Dictionary — slang definitions',
    commands: [
      {
        name: 'define',
        description: 'Top definitions',
        url: 'https://api.urbandictionary.com/v0/define?term={query}',
        root: 'list',
        args: [{ name: '<term>', description: 'the term' }],
        columns: ['word', 'up', 'definition'],
        item: { word: 'word', up: 'thumbs_up', definition: 'definition' },
      },
    ],
  },
  {
    name: 'words',
    description: 'Datamuse — find related words',
    commands: [
      {
        name: 'like',
        description: 'Words with a similar meaning',
        url: 'https://api.datamuse.com/words?ml={query}&max=25',
        args: [{ name: '<query>', description: 'meaning' }],
        columns: ['word', 'score'],
        item: { word: 'word', score: 'score' },
      },
      {
        name: 'rhymes',
        description: 'Words that rhyme',
        url: 'https://api.datamuse.com/words?rel_rhy={0}&max=25',
        args: [{ name: '<word>', description: 'the word' }],
        columns: ['word'],
        item: { word: 'word' },
      },
    ],
  },
  {
    name: 'quotes',
    description: 'ZenQuotes — inspirational quotes',
    commands: [
      {
        name: 'random',
        description: 'A batch of random quotes',
        url: 'https://zenquotes.io/api/quotes',
        args: [],
        columns: ['author', 'content'],
        item: { author: 'a', content: 'q' },
      },
    ],
  },

  // ---- Media / entertainment ----
  {
    name: 'itunes',
    description: 'iTunes — music, podcasts, apps search',
    commands: [
      {
        name: 'search',
        description: 'Search the iTunes catalog',
        url: 'https://itunes.apple.com/search?term={query}&limit=20',
        root: 'results',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['kind', 'name', 'artist'],
        item: { kind: 'kind', name: 'trackName', artist: 'artistName', collection: 'collectionName' },
      },
    ],
  },
  {
    name: 'tvmaze',
    description: 'TVmaze — TV show search',
    commands: [
      {
        name: 'search',
        description: 'Search TV shows',
        url: 'https://api.tvmaze.com/search/shows?q={query}',
        args: [{ name: '<query>', description: 'show name' }],
        columns: ['name', 'premiered', 'rating', 'network'],
        item: {
          name: 'show.name',
          premiered: 'show.premiered',
          rating: 'show.rating.average',
          network: 'show.network.name',
        },
      },
    ],
  },
  {
    name: 'anime',
    description: 'Kitsu — anime search',
    commands: [
      {
        name: 'search',
        description: 'Search anime',
        url: 'https://kitsu.io/api/edge/anime?filter%5Btext%5D={query}&page%5Blimit%5D=20',
        headers: { accept: 'application/vnd.api+json' },
        root: 'data',
        args: [{ name: '<query>', description: 'title' }],
        columns: ['title', 'rating', 'episodes', 'startDate'],
        item: {
          title: 'attributes.canonicalTitle',
          rating: 'attributes.averageRating',
          episodes: 'attributes.episodeCount',
          startDate: 'attributes.startDate',
        },
      },
    ],
  },
  {
    name: 'musicbrainz',
    description: 'MusicBrainz — artist search',
    commands: [
      {
        name: 'artist',
        description: 'Search artists',
        url: 'https://musicbrainz.org/ws/2/artist?query={query}&fmt=json&limit=20',
        root: 'artists',
        args: [{ name: '<query>', description: 'artist name' }],
        columns: ['name', 'country', 'type'],
        item: { name: 'name', country: 'country', type: 'type', disambiguation: 'disambiguation' },
      },
    ],
  },
  {
    name: 'rickandmorty',
    description: 'Rick and Morty — character lookup',
    commands: [
      {
        name: 'character',
        description: 'Search characters',
        url: 'https://rickandmortyapi.com/api/character/?name={query}',
        root: 'results',
        args: [{ name: '<name>', description: 'character name' }],
        columns: ['name', 'status', 'species', 'origin'],
        item: { name: 'name', status: 'status', species: 'species', origin: 'origin.name' },
      },
    ],
  },
  {
    name: 'pokemon',
    description: 'PokéAPI — Pokémon info',
    commands: [
      {
        name: 'info',
        description: 'Base stats for a Pokémon',
        url: 'https://pokeapi.co/api/v2/pokemon/{0}',
        args: [{ name: '<name>', description: 'name or id' }],
        text: ['Name:name', 'ID:id', 'Height:height', 'Weight:weight', 'Base XP:base_experience'],
      },
    ],
  },

  // ---- Food / places / world ----
  {
    name: 'cocktail',
    description: 'TheCocktailDB — drink recipes',
    commands: [
      {
        name: 'search',
        description: 'Search cocktails',
        url: 'https://www.thecocktaildb.com/api/json/v1/1/search.php?s={query}',
        root: 'drinks',
        args: [{ name: '<query>', description: 'drink name' }],
        columns: ['strDrink', 'strCategory', 'strAlcoholic', 'strGlass'],
        item: {
          strDrink: 'strDrink',
          strCategory: 'strCategory',
          strAlcoholic: 'strAlcoholic',
          strGlass: 'strGlass',
        },
      },
    ],
  },
  {
    name: 'meal',
    description: 'TheMealDB — recipe search',
    commands: [
      {
        name: 'search',
        description: 'Search meals',
        url: 'https://www.themealdb.com/api/json/v1/1/search.php?s={query}',
        root: 'meals',
        args: [{ name: '<query>', description: 'meal name' }],
        columns: ['strMeal', 'strCategory', 'strArea'],
        item: { strMeal: 'strMeal', strCategory: 'strCategory', strArea: 'strArea' },
      },
    ],
  },
  {
    name: 'brewery',
    description: 'Open Brewery DB — brewery search',
    commands: [
      {
        name: 'search',
        description: 'Find breweries by name',
        url: 'https://api.openbrewerydb.org/v1/breweries?by_name={query}&per_page=20',
        args: [{ name: '<query>', description: 'brewery name' }],
        columns: ['name', 'brewery_type', 'city', 'state'],
        item: { name: 'name', brewery_type: 'brewery_type', city: 'city', state: 'state_province' },
      },
    ],
  },
  {
    name: 'ip',
    description: 'IP geolocation lookup',
    commands: [
      {
        name: 'lookup',
        description: 'Locate an IP address',
        url: 'https://ipapi.co/{0}/json/',
        args: [{ name: '<ip>', description: 'IPv4/IPv6 address' }],
        text: ['IP:ip', 'City:city', 'Region:region', 'Country:country_name', 'Org:org', 'Timezone:timezone'],
      },
    ],
  },

  // ---- Finance / crypto ----
  {
    name: 'coinpaprika',
    description: 'Coinpaprika — crypto tickers',
    commands: [
      {
        name: 'top',
        description: 'Top coins by rank',
        url: 'https://api.coinpaprika.com/v1/tickers?limit=20',
        root: '',
        args: [],
        columns: ['rank', 'symbol', 'name', 'price'],
        item: { rank: 'rank', symbol: 'symbol', name: 'name', price: 'quotes.USD.price' },
      },
    ],
  },
  {
    name: 'coinlore',
    description: 'Coinlore — crypto prices',
    commands: [
      {
        name: 'top',
        description: 'Top coins',
        url: 'https://api.coinlore.net/api/tickers/?limit=20',
        root: 'data',
        args: [],
        columns: ['rank', 'symbol', 'name', 'price_usd', 'percent_change_24h'],
        item: {
          rank: 'rank',
          symbol: 'symbol',
          name: 'name',
          price_usd: 'price_usd',
          percent_change_24h: 'percent_change_24h',
        },
      },
    ],
  },
  {
    name: 'defillama',
    description: 'DefiLlama — DeFi protocol TVL',
    commands: [
      {
        name: 'top',
        description: 'Protocols by total value locked',
        url: 'https://api.llama.fi/protocols',
        args: [],
        columns: ['name', 'category', 'chain', 'tvl'],
        item: { name: 'name', category: 'category', chain: 'chain', tvl: 'tvl' },
      },
    ],
  },
  {
    name: 'fx',
    description: 'Frankfurter — currency exchange rates',
    commands: [
      {
        name: 'rate',
        description: 'Convert an amount between currencies',
        url: 'https://api.frankfurter.app/latest?amount={0}&from={1}&to={2}',
        args: [
          { name: '<amount>', description: 'amount' },
          { name: '<from>', description: 'base currency, e.g. USD' },
          { name: '<to>', description: 'target currency, e.g. EUR' },
        ],
        text: ['Amount:amount', 'Base:base', 'Date:date', 'Rates:rates'],
      },
    ],
  },

  // ---- Space / misc ----
  {
    name: 'art',
    description: 'Art Institute of Chicago — artwork search',
    commands: [
      {
        name: 'search',
        description: 'Search artworks',
        url: 'https://api.artic.edu/api/v1/artworks/search?q={query}&limit=20&fields=title,artist_display,date_display',
        root: 'data',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['title', 'artist_display', 'date_display'],
        item: { title: 'title', artist_display: 'artist_display', date_display: 'date_display' },
      },
    ],
  },
  {
    name: 'nasa',
    description: 'NASA — Astronomy Picture of the Day',
    commands: [
      {
        name: 'apod',
        description: "Today's astronomy picture and explanation",
        url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY',
        text: ['Title:title', 'Date:date', 'Media:media_type', 'URL:url', '', 'Explanation:explanation'],
      },
    ],
  },
  {
    name: 'worldtime',
    description: 'World time by timezone',
    commands: [
      {
        name: 'now',
        description: 'Current time in a timezone',
        url: 'https://timeapi.io/api/Time/current/zone?timeZone={0}',
        args: [{ name: '<timezone>', description: 'e.g. Europe/London, America/New_York' }],
        text: ['Timezone:timeZone', 'Date:date', 'Time:time', 'Day of week:dayOfWeek'],
      },
    ],
  },
  {
    name: 'trivia',
    description: 'Open Trivia DB — trivia questions',
    commands: [
      {
        name: 'random',
        description: 'Random trivia questions',
        url: 'https://opentdb.com/api.php?amount=10',
        root: 'results',
        args: [],
        columns: ['category', 'difficulty', 'question'],
        item: { category: 'category', difficulty: 'difficulty', question: 'question' },
      },
    ],
  },
  {
    name: 'joke',
    description: 'JokeAPI — a random joke',
    commands: [
      {
        name: 'random',
        description: 'Tell a joke',
        url: 'https://v2.jokeapi.dev/joke/Any?type=single&safe-mode',
        text: ['Category:category', 'Joke:joke'],
      },
    ],
  },
  {
    name: 'lyrics',
    description: 'lyrics.ovh — song lyrics',
    commands: [
      {
        name: 'get',
        description: 'Lyrics for a song',
        url: 'https://api.lyrics.ovh/v1/{0}/{1}',
        args: [
          { name: '<artist>', description: 'artist name' },
          { name: '<title>', description: 'song title' },
        ],
        text: ['lyrics'],
      },
    ],
  },
  {
    name: 'trending',
    description: 'CoinGecko — trending coins',
    commands: [
      {
        name: 'coins',
        description: 'Coins trending in the last 24h',
        url: 'https://api.coingecko.com/api/v3/search/trending',
        root: 'coins',
        args: [],
        columns: ['name', 'symbol', 'rank'],
        item: { name: 'item.name', symbol: 'item.symbol', rank: 'item.market_cap_rank' },
      },
    ],
  },
];
