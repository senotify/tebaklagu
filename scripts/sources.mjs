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
    icon: 'flag',
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
    icon: 'sparkles',
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
    icon: 'mic',
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
    icon: 'globe',
    charts: [0, 132, 116],
    chartLimit: 100,
    // Same reason legendaris goes deep: an active artist's top six by Deezer rank
    // are their latest singles, so "Shape of You" and "Blank Space" never appear
    // while "Azizam" and "Opalite" do. A guessing game wants the famous ones.
    tracksPerArtist: 14,
    artists: [
      'Adele', 'Ed Sheeran', 'Bruno Mars', 'Taylor Swift', 'The Weeknd', 'Drake',
      'Billie Eilish', 'Dua Lipa', 'Sia', 'Shakira', 'Ariana Grande',
      'Sam Smith', 'Charlie Puth', 'Post Malone', 'Imagine Dragons',
      'Twenty One Pilots', 'David Guetta', 'Calvin Harris', 'The Chainsmokers',
    ],
  },
  // Songs a room full of people can name. Deliberately artists whose catalogue
  // is settled, so their top tracks are the classics rather than new singles.
  legendaris: {
    title: 'Lagu Legendaris',
    icon: 'star',
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
    icon: 'disc',
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
    icon: 'guitar',
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
  // Billboard Hot 100 chart-toppers from the '80s on, picked by hand. Deezer has
  // no Billboard chart, and a live chart would bring in this week's songs — this
  // list is meant to be the ones everyone on the planet can hum. Each entry
  // resolves to the artist's own original recording (see findSong).
  // Missing on purpose: Justin Bieber's "Love Yourself", the studio "Single
  // Ladies" and the original "Moves Like Jagger" — Deezer only has covers,
  // live takes or remixes of them.
  billboard: {
    title: 'Top Billboard',
    icon: 'trophy',
    songs: [
      // 2020s
      ['The Weeknd', 'Blinding Lights'], ['Harry Styles', 'As It Was'],
      ['Dua Lipa', 'Levitating'], ['Olivia Rodrigo', 'drivers license'],
      ['Olivia Rodrigo', 'good 4 u'], ['The Kid LAROI', 'STAY'],
      ['Glass Animals', 'Heat Waves'], ['Miley Cyrus', 'Flowers'],
      ['Harry Styles', 'Watermelon Sugar'], ['BTS', 'Dynamite'], ['BTS', 'Butter'],
      ['Bruno Mars', 'Leave the Door Open'], ['Doja Cat', 'Say So'],
      ['SZA', 'Kill Bill'], ['Taylor Swift', 'Anti-Hero'], ['Taylor Swift', 'Cruel Summer'],
      ['Sabrina Carpenter', 'Espresso'], ['Lady Gaga', 'Die With A Smile'],
      ['Benson Boone', 'Beautiful Things'], ['Teddy Swims', 'Lose Control'],
      ['Billie Eilish', 'BIRDS OF A FEATHER'], ['ROSÉ', 'APT.'],
      // 2010s
      ['Ed Sheeran', 'Shape of You'], ['Ed Sheeran', 'Perfect'], ['Ed Sheeran', 'Thinking Out Loud'],
      ['Mark Ronson', 'Uptown Funk'], ['Luis Fonsi', 'Despacito'], ['Wiz Khalifa', 'See You Again'],
      ['Lil Nas X', 'Old Town Road'], ['Post Malone', 'Circles'], ['Post Malone', 'Sunflower'],
      ['Billie Eilish', 'bad guy'], ['Lewis Capaldi', 'Someone You Loved'],
      ['Shawn Mendes', 'Señorita'], ['Maroon 5', 'Girls Like You'],
      ['Drake', "God's Plan"], ['Drake', 'One Dance'],
      ['Justin Bieber', 'Sorry'],
      ['Adele', 'Hello'], ['Adele', 'Rolling in the Deep'], ['Adele', 'Someone Like You'],
      ['Taylor Swift', 'Shake It Off'], ['Taylor Swift', 'Blank Space'],
      ['Pharrell Williams', 'Happy'], ['Katy Perry', 'Roar'], ['Katy Perry', 'Dark Horse'],
      ['Katy Perry', 'Firework'], ['Gotye', 'Somebody That I Used To Know'],
      ['Carly Rae Jepsen', 'Call Me Maybe'], ['LMFAO', 'Party Rock Anthem'],
      ['Bruno Mars', 'Just the Way You Are'], ['Bruno Mars', 'Grenade'],
      ['Bruno Mars', 'Locked Out of Heaven'], ['Bruno Mars', "That's What I Like"],
      ['Lady Gaga', 'Shallow'], ['Rihanna', 'We Found Love'], ['Rihanna', 'Diamonds'],
      ['Eminem', 'Love The Way You Lie'], ['Ke$ha', 'TiK ToK'],
      ['Macklemore & Ryan Lewis', 'Thrift Shop'], ['John Legend', 'All of Me'],
      ['Sam Smith', 'Stay With Me'], ['Meghan Trainor', 'All About That Bass'],
      ['Ariana Grande', 'thank u, next'], ['Ariana Grande', '7 rings'],
      ['The Chainsmokers', 'Closer'], ['Camila Cabello', 'Havana'],
      ['Miley Cyrus', 'Wrecking Ball'], ['Justin Timberlake', "CAN'T STOP THE FEELING!"],
      ['Tones And I', 'Dance Monkey'], ['OneRepublic', 'Counting Stars'],
      ['Imagine Dragons', 'Radioactive'], ['Imagine Dragons', 'Believer'],
      ['Sia', 'Cheap Thrills'], ['Sia', 'Chandelier'], ['Avicii', 'Wake Me Up'],
      ['PSY', 'Gangnam Style'], ['WALK THE MOON', 'Shut Up and Dance'],
      // 2000s
      ['Black Eyed Peas', 'I Gotta Feeling'], ['Lady Gaga', 'Poker Face'],
      ['Lady Gaga', 'Bad Romance'], ['Rihanna', 'Umbrella'], ['Beyoncé', 'Crazy In Love'], ['Leona Lewis', 'Bleeding Love'],
      ['Timbaland', 'Apologize'], ['Mariah Carey', 'We Belong Together'],
      ['Usher', 'Yeah!'], ['50 Cent', 'In Da Club'], ['Eminem', 'Lose Yourself'],
      ['Nelly', 'Dilemma'], ['OutKast', 'Hey Ya!'], ['Gnarls Barkley', 'Crazy'],
      ['Shakira', "Hips Don't Lie"], ['Nelly Furtado', 'Promiscuous'],
      ['Justin Timberlake', 'SexyBack'], ['Kanye West', 'Stronger'],
      ['Avril Lavigne', 'Girlfriend'], ['Britney Spears', 'Toxic'],
      ['Destiny\'s Child', 'Say My Name'], ['Christina Aguilera', 'Genie in a Bottle'],
      ['Santana', 'Smooth'], ['Daniel Powter', 'Bad Day'], ['James Blunt', "You're Beautiful"],
      ['Sean Paul', 'Temperature'], ['Flo Rida', 'Low'],
      // '80s and '90s
      ['Whitney Houston', 'I Will Always Love You'], ['Whitney Houston', 'I Wanna Dance with Somebody (Who Loves Me)'],
      ['Celine Dion', 'My Heart Will Go On'], ['Mariah Carey', 'All I Want for Christmas Is You'],
      ['Mariah Carey', 'One Sweet Day'], ['Bryan Adams', '(Everything I Do) I Do It For You'],
      ['Los Del Rio', 'Macarena'], ['Coolio', "Gangsta's Paradise"],
      ['Backstreet Boys', 'I Want It That Way'], ['Britney Spears', '...Baby One More Time'],
      ['Ricky Martin', 'Livin\' la Vida Loca'], ['Spice Girls', 'Wannabe'], ['Hanson', 'MMMBop'],
      ['Nirvana', 'Smells Like Teen Spirit'], ['Vanilla Ice', 'Ice Ice Baby'],
      ['Michael Jackson', 'Billie Jean'], ['Michael Jackson', 'Beat It'],
      ['Survivor', 'Eye of the Tiger'], ['Queen', 'Another One Bites The Dust'],
      ['Toto', 'Africa'], ['a-ha', 'Take On Me'], ['George Michael', 'Careless Whisper'],
      ['Bon Jovi', "Livin' On A Prayer"], ['Madonna', 'Like a Prayer'],
      ["Guns N' Roses", "Sweet Child O' Mine"], ['Cyndi Lauper', 'Girls Just Want to Have Fun'],
    ],
  },
  // A single-artist list: deep enough that a fan gets past the radio hits, and
  // that 30 or more survive YouTube mapping so it can open in intro mode.
  'the-weeknd': {
    title: 'The Weeknd',
    icon: 'xo',
    tracksPerArtist: 50,
    artists: ['The Weeknd'],
  },
  'ariana-grande': {
    title: 'Ariana Grande',
    icon: 'ribbon',
    tracksPerArtist: 50,
    artists: ['Ariana Grande'],
    ownTracksOnly: true,
    keepFeatures: [['The Weeknd', 'Save Your Tears']],
  },
  kpop: {
    title: 'K-Pop',
    icon: 'heart',
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
