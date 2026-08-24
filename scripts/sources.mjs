// Catalog definition. Each playlist draws from artist top-tracks and/or Deezer
// editorial charts; the build script merges, dedupes and filters them.
//
// Artist names here are resolved to Deezer ids once by `npm run resolve:artists`
// (result committed to scripts/artist-ids.json) so builds stay deterministic.

// Artists whose official catalog is absent from Deezer, deliberately left out
// of the lists below:
//   Peterpan / NOAH, Vierra — searching returns only cover uploads.
//   D'MASIV — its artist page exists (id 2004741) but holds no playable tracks,
//     and the fuzzy search offers the French rapper Damso in its place.

// Where artist search picks the wrong act despite the top-track check.
// "Vierra" for instance matches the Brazilian singer Bezerra Da Silva.
export const ARTIST_OVERRIDES = {
  '(G)I-DLE': 15065941,
}

export const PLAYLISTS = {
  'indo-pop': {
    title: 'Pop Indonesia',
    emoji: '🇮🇩',
    tracksPerArtist: 8,
    artists: [
      'Sheila On 7', 'Dewa 19', 'Padi', 'Slank', 'Ungu',
      'GIGI', 'Letto', 'Ada Band', 'Nidji', 'Kerispatih', 'Naif',
      'Chrisye', 'Koes Plus', 'Iwan Fals', 'Wali', 'Armada',
      'Rossa', 'Afgan', 'Judika', 'Agnez Mo', 'Kangen Band', 'ST12',
    ],
  },
  'indo-kekinian': {
    title: 'Indo Kekinian',
    emoji: '✨',
    tracksPerArtist: 8,
    artists: [
      'Tulus', 'Raisa', 'Isyana Sarasvati', 'Hindia', 'Pamungkas', 'Fourtwnty',
      'Nadin Amizah', 'Kunto Aji', 'Ardhito Pramono', 'Mahalini', 'Lyodra',
      'Tiara Andini', 'Bernadya', 'Sal Priadi', 'Yura Yunita', 'Feby Putri',
      'Juicy Luicy', 'Payung Teduh', 'Barasuara', '.Feast', 'Rizky Febian',
      'Ziva Magnolya', 'NIKI', 'Rich Brian', 'Weird Genius', 'Tiara Andini',
    ],
  },
  dangdut: {
    title: 'Dangdut',
    emoji: '🎤',
    tracksPerArtist: 10,
    artists: [
      'Rhoma Irama', 'Didi Kempot', 'Via Vallen', 'Nella Kharisma',
      'Denny Caknan', 'Happy Asmara', 'Inul Daratista', 'Rita Sugiarto',
      'Elvy Sukaesih', 'Ayu Ting Ting', 'Zaskia Gotik', 'Duo Anggrek',
    ],
  },
  // Charts plus today's biggest names. Deezer's `rank` tracks current streaming
  // popularity, so an active artist's top tracks are their latest singles —
  // which belongs here rather than under the legendary list.
  'global-hits': {
    title: 'Global Hits',
    emoji: '🌍',
    charts: [0, 132, 116],
    chartLimit: 100,
    tracksPerArtist: 6,
    artists: [
      'Adele', 'Ed Sheeran', 'Bruno Mars', 'Taylor Swift', 'The Weeknd',
      'Billie Eilish', 'Dua Lipa', 'Sia', 'Shakira', 'Ariana Grande',
      'Sam Smith', 'Charlie Puth', 'Post Malone', 'Imagine Dragons',
      'Twenty One Pilots', 'David Guetta', 'Calvin Harris', 'The Chainsmokers',
    ],
  },
  // Songs a room full of people can name. Deliberately artists whose catalogue
  // is settled, so their top tracks are the classics rather than new singles.
  legendaris: {
    title: 'Lagu Legendaris',
    emoji: '🌟',
    // Deeper than the other lists: a legendary artist's best-known song is often
    // not their most-streamed one, so ABBA's top 8 misses "Dancing Queen".
    tracksPerArtist: 14,
    artists: [
      'Michael Jackson', 'ABBA', 'Elton John', 'Whitney Houston', 'Stevie Wonder',
      'Madonna', 'Elvis Presley', 'Frank Sinatra', 'John Lennon', 'Bob Marley',
      'Bee Gees', 'Eagles', 'Fleetwood Mac', 'Aerosmith', 'U2', 'The Police',
      'Phil Collins', 'George Michael', 'Wham!', 'a-ha', 'Toto', 'Journey',
      'Survivor', 'Bryan Adams', 'Celine Dion', 'Mariah Carey', 'Spice Girls',
      'Westlife', 'Robbie Williams', 'Michael Bublé', 'Daft Punk', 'Avicii',
    ],
  },
  'western-2000s': {
    title: 'Barat 2000-an',
    emoji: '📀',
    tracksPerArtist: 8,
    artists: [
      'Britney Spears', 'Backstreet Boys', 'Linkin Park', 'Avril Lavigne',
      'Eminem', 'Rihanna', 'Beyoncé', 'Maroon 5', 'Coldplay', 'Katy Perry',
      'Lady Gaga', 'The Black Eyed Peas', 'Justin Timberlake', 'Kelly Clarkson',
      'Nelly', 'Usher', 'Alicia Keys', 'OneRepublic', 'Nickelback', 'Simple Plan',
    ],
  },
  rock: {
    title: 'Rock',
    emoji: '🎸',
    tracksPerArtist: 8,
    charts: [152],
    chartLimit: 50,
    artists: [
      'Queen', 'Nirvana', 'Guns N\' Roses', 'Green Day', 'Oasis', 'Muse',
      'Red Hot Chili Peppers', 'blink-182', 'Arctic Monkeys', 'Paramore',
      'My Chemical Romance', 'Foo Fighters', 'Radiohead', 'The Killers',
      'Bon Jovi', 'Metallica', 'AC/DC', 'The Beatles',
    ],
  },
  kpop: {
    title: 'K-Pop',
    emoji: '💜',
    tracksPerArtist: 8,
    artists: [
      'BTS', 'BLACKPINK', 'TWICE', 'EXO', 'Red Velvet', 'SEVENTEEN',
      'NewJeans', 'IVE', 'aespa', 'Stray Kids', 'BIGBANG', 'TOMORROW X TOGETHER',
      'LE SSERAFIM', '(G)I-DLE', 'Girls\' Generation', 'ITZY',
    ],
  },
}

// The daily challenge draws from a broad mix so it stays fair for everyone.
export const DAILY_POOL = [
  'indo-pop',
  'indo-kekinian',
  'global-hits',
  'western-2000s',
  'legendaris',
]

export const ALL_ARTISTS = [
  ...new Set(Object.values(PLAYLISTS).flatMap((p) => p.artists ?? [])),
]
