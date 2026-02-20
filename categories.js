// Secret Word Imposter Game - Category Data
// Each category contains an array of words that can be used in the game

const CATEGORIES = {
  countries: {
    name: "Countries",
    icon: "🌍",
    words: [
      "United States", "China", "India", "Brazil", "Russia", "Japan", "Germany", "United Kingdom",
      "France", "Italy", "Canada", "Australia", "South Korea", "Spain", "Mexico", "Indonesia",
      "Netherlands", "Switzerland", "Saudi Arabia", "Turkey", "Argentina", "Sweden", "Poland",
      "Belgium", "Thailand", "Austria", "Norway", "United Arab Emirates", "Nigeria", "Israel",
      "South Africa", "Egypt", "Denmark", "Singapore", "Malaysia", "Philippines", "Ireland",
      "Pakistan", "Chile", "Finland", "Vietnam", "Bangladesh", "Portugal", "Czech Republic",
      "Romania", "New Zealand", "Peru", "Greece", "Iraq", "Qatar", "Algeria", "Kazakhstan",
      "Hungary", "Kuwait", "Morocco", "Ukraine", "Ecuador", "Cuba", "Dominican Republic",
      "Ethiopia", "Kenya", "Sri Lanka", "Guatemala", "Oman", "Luxembourg", "Panama", "Bulgaria",
      "Croatia", "Costa Rica", "Uruguay", "Slovenia", "Lithuania", "Tunisia", "Serbia", "Jordan",
      "Azerbaijan", "Ghana", "Iceland", "Jamaica", "Nepal", "Cambodia", "Latvia", "Estonia",
      "Bahrain", "Trinidad", "Cyprus", "Afghanistan", "Honduras", "Zimbabwe", "Senegal",
      "Mongolia", "Malta", "Mauritius", "Albania", "Armenia", "Madagascar", "Jamaica", "Fiji"
    ]
  },

  celebrities: {
    name: "Celebrities",
    icon: "⭐",
    words: [
      "Taylor Swift", "Dwayne Johnson", "Beyoncé", "Leonardo DiCaprio", "Oprah Winfrey",
      "Tom Hanks", "Lady Gaga", "Brad Pitt", "Jennifer Aniston", "Will Smith", "Rihanna",
      "Justin Bieber", "Kim Kardashian", "Ariana Grande", "Chris Hemsworth", "Scarlett Johansson",
      "Ed Sheeran", "Selena Gomez", "Ryan Reynolds", "Emma Watson", "Drake", "Billie Eilish",
      "Chris Evans", "Zendaya", "Post Malone", "Dua Lipa", "Tom Holland", "Margot Robbie",
      "Harry Styles", "Cardi B", "Keanu Reeves", "Gal Gadot", "Shakira", "Jennifer Lawrence",
      "The Weeknd", "Robert Downey Jr", "Miley Cyrus", "Jason Momoa", "Katy Perry", "Kanye West",
      "Adele", "Bruno Mars", "Chris Pratt", "Anne Hathaway", "Travis Scott", "Bad Bunny",
      "Timothée Chalamet", "Sydney Sweeney", "Pedro Pascal", "Florence Pugh", "Austin Butler",
      "Jenna Ortega", "Tom Cruise", "Johnny Depp", "Angelina Jolie", "George Clooney",
      "Morgan Freeman", "Samuel L Jackson", "Denzel Washington", "Meryl Streep"
    ]
  },

  clashRoyale: {
    name: "Clash Royale Cards",
    icon: "⚔️",
    words: [
      "Hog Rider", "Giant", "Golem", "Pekka", "Mega Knight", "Royal Giant", "Electro Giant",
      "Lava Hound", "Balloon", "Graveyard", "Miner", "Bandit", "Electro Wizard", "Ice Wizard",
      "Princess", "Inferno Dragon", "Lumberjack", "Night Witch", "Magic Archer", "Ram Rider",
      "Sparky", "The Log", "Zap", "Fireball", "Rocket", "Lightning", "Poison", "Freeze",
      "Tornado", "Arrows", "Valkyrie", "Knight", "Mini Pekka", "Musketeer", "Wizard",
      "Witch", "Executioner", "Baby Dragon", "Inferno Tower", "Tesla", "Cannon", "Mortar",
      "X-Bow", "Goblin Barrel", "Skeleton Army", "Minion Horde", "Three Musketeers",
      "Elite Barbarians", "Royal Hogs", "Battle Ram", "Dark Prince", "Prince", "Goblin Gang",
      "Guards", "Bats", "Skeletons", "Ice Spirit", "Fire Spirit", "Electro Spirit", "Heal Spirit",
      "Dart Goblin", "Goblin Cage", "Fisherman", "Mother Witch", "Archer Queen", "Golden Knight",
      "Skeleton King", "Phoenix", "Monk", "Little Prince", "Void", "Evolved Skeletons"
    ]
  },

  soccerPlayers: {
    name: "Soccer Players",
    icon: "⚽",
    words: [
      "Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappé", "Erling Haaland", "Neymar Jr",
      "Kevin De Bruyne", "Mohamed Salah", "Robert Lewandowski", "Luka Modric", "Karim Benzema",
      "Vinicius Jr", "Jude Bellingham", "Bukayo Saka", "Phil Foden", "Marcus Rashford",
      "Harry Kane", "Sadio Mané", "Virgil van Dijk", "Thibaut Courtois", "Alisson Becker",
      "Casemiro", "Pedri", "Gavi", "Jamal Musiala", "Florian Wirtz", "Rafael Leão",
      "Victor Osimhen", "Rodri", "Bruno Fernandes", "Son Heung-min", "Bernardo Silva",
      "Joshua Kimmich", "Trent Alexander-Arnold", "Declan Rice", "Martin Ødegaard",
      "Antoine Griezmann", "Ousmane Dembélé", "Julian Alvarez", "Federico Valverde",
      "Achraf Hakimi", "Theo Hernandez", "Ruben Dias", "William Saliba", "Enzo Fernandez",
      "Khvicha Kvaratskhelia", "Lamine Yamal", "Kobbie Mainoo", "Cole Palmer",
      "Zlatan Ibrahimovic", "Sergio Ramos", "Gerard Pique", "Andres Iniesta", "Xavi Hernandez"
    ]
  },

  basketballPlayers: {
    name: "Basketball Players",
    icon: "🏀",
    words: [
      "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo", "Luka Doncic",
      "Jayson Tatum", "Joel Embiid", "Nikola Jokic", "Ja Morant", "Devin Booker",
      "Anthony Edwards", "Shai Gilgeous-Alexander", "Donovan Mitchell", "Trae Young",
      "Zion Williamson", "Damian Lillard", "Anthony Davis", "Kawhi Leonard", "Paul George",
      "Kyrie Irving", "James Harden", "Russell Westbrook", "Chris Paul", "Jimmy Butler",
      "Bam Adebayo", "Jaylen Brown", "Pascal Siakam", "Domantas Sabonis", "De'Aaron Fox",
      "Tyrese Maxey", "Tyrese Haliburton", "Chet Holmgren", "Paolo Banchero", "Victor Wembanyama",
      "Kobe Bryant", "Michael Jordan", "Shaquille O'Neal", "Tim Duncan", "Dirk Nowitzki",
      "Magic Johnson", "Larry Bird", "Kareem Abdul-Jabbar", "Charles Barkley", "Allen Iverson",
      "Dwyane Wade", "Carmelo Anthony", "Vince Carter", "Tracy McGrady", "Steve Nash"
    ]
  },

  cricketPlayers: {
    name: "Cricket Players",
    icon: "🏏",
    words: [
      "Virat Kohli", "Sachin Tendulkar", "MS Dhoni", "Rohit Sharma", "Jasprit Bumrah",
      "Rishabh Pant", "Hardik Pandya", "Ravindra Jadeja", "Ravichandran Ashwin", "Shubman Gill",
      "KL Rahul", "Suryakumar Yadav", "Mohammed Shami", "Mohammed Siraj", "Shreyas Iyer",
      "Pat Cummins", "Steve Smith", "David Warner", "Mitchell Starc", "Glenn Maxwell",
      "Travis Head", "Marnus Labuschagne", "Josh Hazlewood", "Nathan Lyon", "Cameron Green",
      "Joe Root", "Ben Stokes", "James Anderson", "Stuart Broad", "Jos Buttler",
      "Jonny Bairstow", "Harry Brook", "Mark Wood", "Moeen Ali", "Jofra Archer",
      "Babar Azam", "Shaheen Afridi", "Mohammad Rizwan", "Fakhar Zaman", "Shadab Khan",
      "Kane Williamson", "Trent Boult", "Tim Southee", "Devon Conway", "Daryl Mitchell",
      "Quinton de Kock", "Kagiso Rabada", "Anrich Nortje", "Rashid Khan", "Shakib Al Hasan"
    ]
  },

  athletes: {
    name: "Athletes (General)",
    icon: "🏆",
    words: [
      "Usain Bolt", "Michael Phelps", "Simone Biles", "Roger Federer", "Serena Williams",
      "Rafael Nadal", "Novak Djokovic", "Tiger Woods", "Floyd Mayweather", "Conor McGregor",
      "Tom Brady", "Patrick Mahomes", "Aaron Rodgers", "Mike Tyson", "Muhammad Ali",
      "Lewis Hamilton", "Max Verstappen", "Naomi Osaka", "Coco Gauff", "Carlos Alcaraz",
      "Katie Ledecky", "Connor McDavid", "Sidney Crosby", "Alex Ovechkin", "Wayne Gretzky",
      "Shaun White", "Tony Hawk", "Nyjah Huston", "Caeleb Dressel", "Eliud Kipchoge",
      "Shelly-Ann Fraser-Pryce", "Sydney McLaughlin", "Noah Lyles", "Armand Duplantis",
      "Jon Jones", "Khabib Nurmagomedov", "Anderson Silva", "Georges St-Pierre", "Israel Adesanya",
      "Rory McIlroy", "Dustin Johnson", "Brooks Koepka", "Phil Mickelson", "Bryson DeChambeau",
      "Canelo Alvarez", "Tyson Fury", "Anthony Joshua", "Manny Pacquiao", "Oscar De La Hoya"
    ]
  },

  companies: {
    name: "Companies",
    icon: "🏢",
    words: [
      "Apple", "Google", "Microsoft", "Amazon", "Meta", "Tesla", "Netflix", "Disney",
      "Nvidia", "Samsung", "Sony", "Intel", "AMD", "IBM", "Oracle", "Salesforce",
      "Adobe", "Spotify", "Uber", "Lyft", "Airbnb", "PayPal", "Visa", "Mastercard",
      "Nike", "Adidas", "Coca-Cola", "Pepsi", "McDonalds", "Starbucks", "Walmart",
      "Target", "Costco", "Home Depot", "IKEA", "Zara", "H&M", "Louis Vuitton", "Gucci",
      "Ferrari", "BMW", "Mercedes", "Toyota", "Honda", "Ford", "Volkswagen", "Porsche",
      "SpaceX", "Boeing", "Lockheed Martin", "Goldman Sachs", "JPMorgan", "HSBC",
      "OpenAI", "Anthropic", "TikTok", "Twitter", "Snapchat", "LinkedIn", "Reddit",
      "YouTube", "Twitch", "Epic Games", "Riot Games", "Electronic Arts", "Activision"
    ]
  },

  movies: {
    name: "Movies",
    icon: "🎬",
    words: [
      "Titanic", "Avatar", "Avengers Endgame", "The Dark Knight", "Inception", "Interstellar",
      "The Godfather", "Pulp Fiction", "Forrest Gump", "The Shawshank Redemption", "Fight Club",
      "The Matrix", "Gladiator", "Jurassic Park", "Star Wars", "The Lion King", "Frozen",
      "Finding Nemo", "Toy Story", "Up", "WALL-E", "Coco", "Encanto", "Moana", "Shrek",
      "Harry Potter", "Lord of the Rings", "The Hobbit", "Spider-Man", "Iron Man", "Thor",
      "Black Panther", "Guardians of the Galaxy", "Doctor Strange", "Deadpool", "Joker",
      "The Batman", "Wonder Woman", "Aquaman", "Top Gun Maverick", "Dune", "Oppenheimer",
      "Barbie", "John Wick", "Fast and Furious", "Mission Impossible", "James Bond",
      "Pirates of the Caribbean", "Transformers", "Hunger Games", "Twilight", "The Notebook"
    ]
  },

  foods: {
    name: "Foods",
    icon: "🍕",
    words: [
      "Pizza", "Burger", "Sushi", "Tacos", "Pasta", "Ramen", "Pad Thai", "Curry",
      "Fried Rice", "Dumplings", "Spring Rolls", "Pho", "Bibimbap", "Shawarma", "Falafel",
      "Fish and Chips", "Croissant", "Baguette", "Paella", "Risotto", "Lasagna", "Tiramisu",
      "Cheesecake", "Ice Cream", "Pancakes", "Waffles", "French Toast", "Eggs Benedict",
      "Caesar Salad", "Greek Salad", "Steak", "Fried Chicken", "BBQ Ribs", "Hot Dog",
      "Nachos", "Quesadilla", "Burrito", "Enchiladas", "Ceviche", "Poke Bowl", "Acai Bowl",
      "Avocado Toast", "Hummus", "Tandoori Chicken", "Butter Chicken", "Biryani", "Naan",
      "Dim Sum", "Peking Duck", "Macarons", "Churros", "Baklava", "Mochi", "Crepe"
    ]
  },

  animals: {
    name: "Animals",
    icon: "🦁",
    words: [
      "Lion", "Tiger", "Elephant", "Giraffe", "Zebra", "Gorilla", "Chimpanzee", "Orangutan",
      "Panda", "Koala", "Kangaroo", "Polar Bear", "Grizzly Bear", "Wolf", "Fox", "Deer",
      "Moose", "Hippopotamus", "Rhinoceros", "Crocodile", "Alligator", "Snake", "Lizard",
      "Turtle", "Dolphin", "Whale", "Shark", "Octopus", "Jellyfish", "Penguin", "Flamingo",
      "Eagle", "Owl", "Parrot", "Peacock", "Swan", "Duck", "Chicken", "Turkey", "Pig",
      "Cow", "Horse", "Donkey", "Sheep", "Goat", "Rabbit", "Squirrel", "Raccoon", "Skunk",
      "Beaver", "Hedgehog", "Bat", "Sloth", "Armadillo", "Cheetah", "Leopard", "Jaguar"
    ]
  },

  videoGames: {
    name: "Video Games",
    icon: "🎮",
    words: [
      "Minecraft", "Fortnite", "GTA V", "Call of Duty", "FIFA", "League of Legends",
      "Valorant", "Overwatch", "Apex Legends", "PUBG", "Roblox", "Among Us", "Fall Guys",
      "Rocket League", "Elden Ring", "Dark Souls", "God of War", "The Last of Us",
      "Red Dead Redemption", "Cyberpunk 2077", "Hogwarts Legacy", "Zelda Tears of the Kingdom",
      "Super Mario Odyssey", "Pokemon Scarlet", "Animal Crossing", "Mario Kart", "Smash Bros",
      "Halo", "Gears of War", "Destiny", "World of Warcraft", "Final Fantasy", "Kingdom Hearts",
      "Resident Evil", "Silent Hill", "Assassins Creed", "Far Cry", "Watch Dogs", "The Sims",
      "Stardew Valley", "Terraria", "Hollow Knight", "Celeste", "Hades", "Cuphead",
      "Undertale", "Baldurs Gate 3", "Diablo", "Starfield", "Spider-Man 2", "Horizon"
    ]
  },

  tvShows: {
    name: "TV Shows",
    icon: "📺",
    words: [
      "Breaking Bad", "Game of Thrones", "Stranger Things", "The Office", "Friends",
      "The Mandalorian", "Wednesday", "Squid Game", "Money Heist", "Narcos", "Peaky Blinders",
      "The Crown", "Bridgerton", "The Witcher", "House of the Dragon", "The Last of Us",
      "Succession", "Ted Lasso", "Yellowstone", "The Bear", "Euphoria", "White Lotus",
      "Better Call Saul", "Ozark", "Black Mirror", "The Boys", "Invincible", "Arcane",
      "Attack on Titan", "One Piece", "Demon Slayer", "Jujutsu Kaisen", "Dragon Ball",
      "Naruto", "The Simpsons", "Family Guy", "South Park", "Rick and Morty", "Bojack Horseman",
      "Avatar The Last Airbender", "Spongebob", "Brooklyn Nine Nine", "Parks and Recreation",
      "How I Met Your Mother", "The Big Bang Theory", "Seinfeld", "The Sopranos", "The Wire"
    ]
  },

  musicalArtists: {
    name: "Musical Artists",
    icon: "🎵",
    words: [
      "Taylor Swift", "Drake", "The Weeknd", "Bad Bunny", "Ed Sheeran", "Ariana Grande",
      "Dua Lipa", "Harry Styles", "Billie Eilish", "Post Malone", "Justin Bieber", "Rihanna",
      "Beyoncé", "Adele", "Bruno Mars", "Coldplay", "Imagine Dragons", "Maroon 5", "BTS",
      "Blackpink", "Doja Cat", "SZA", "Olivia Rodrigo", "Miley Cyrus", "Shakira", "J Balvin",
      "Daddy Yankee", "Selena Gomez", "Travis Scott", "Kanye West", "Kendrick Lamar",
      "Eminem", "Jay-Z", "Nicki Minaj", "Cardi B", "Megan Thee Stallion", "Lizzo", "Demi Lovato",
      "Katy Perry", "Lady Gaga", "Pink", "Elton John", "Madonna", "Michael Jackson",
      "The Beatles", "Queen", "Led Zeppelin", "Nirvana", "Foo Fighters", "Green Day"
    ]
  },

  sportsTeams: {
    name: "Sports Teams",
    icon: "🏅",
    words: [
      "Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Liverpool",
      "Bayern Munich", "Paris Saint Germain", "Juventus", "AC Milan", "Chelsea", "Arsenal",
      "Los Angeles Lakers", "Golden State Warriors", "Boston Celtics", "Chicago Bulls",
      "Miami Heat", "Brooklyn Nets", "Dallas Mavericks", "Phoenix Suns", "Milwaukee Bucks",
      "New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "Chicago Cubs",
      "Kansas City Chiefs", "San Francisco 49ers", "Dallas Cowboys", "Green Bay Packers",
      "New England Patriots", "Tampa Bay Buccaneers", "Miami Dolphins", "Buffalo Bills",
      "New York Rangers", "Toronto Maple Leafs", "Montreal Canadiens", "Boston Bruins",
      "Mumbai Indians", "Chennai Super Kings", "Royal Challengers Bangalore", "Kolkata Knight Riders",
      "India Cricket Team", "Australia Cricket Team", "England Cricket Team", "New Zealand All Blacks"
    ]
  },

  scienceConcepts: {
    name: "Science Concepts",
    icon: "🔬",
    words: [
      "Thermodynamics", "Quantum Mechanics", "Electromagnetic Radiation", "Covalent Bond",
      "Entropy", "Dark Matter", "Black Hole", "Nuclear Fission", "Nuclear Fusion",
      "Superconductivity", "General Relativity", "Special Relativity", "Wave-Particle Duality",
      "Heisenberg Uncertainty Principle", "Schrödinger Equation", "Planck Constant",
      "Periodic Table", "Electronegativity", "Ionic Bond", "Hydrogen Bond",
      "Oxidation Reduction", "Acid Base Reaction", "Chemical Equilibrium", "Le Chatelier Principle",
      "Avogadro Number", "Molar Mass", "Stoichiometry", "Ideal Gas Law",
      "Kinetic Energy", "Potential Energy", "Conservation of Energy", "Newton Laws of Motion",
      "Centripetal Force", "Gravitational Waves", "Doppler Effect", "Refraction",
      "Diffraction", "Interference", "Polarization", "Magnetic Field",
      "Electric Field", "Ohm Law", "Faraday Law", "Coulomb Law",
      "Kirchhoff Laws", "Capacitance", "Inductance", "Semiconductor",
      "Photoelectric Effect", "Radioactive Decay", "Half Life", "Mass Spectrometry",
      "Spectroscopy", "Chromatography", "Titration", "Buffer Solution",
      "Catalyst", "Activation Energy", "Exothermic Reaction", "Endothermic Reaction",
      "Plate Tectonics", "Seismic Waves", "Continental Drift", "Ozone Layer",
      "Greenhouse Effect", "Hubble Law", "Neutron Star", "Supernova",
      "Red Shift", "Cosmic Microwave Background"
    ]
  },

  biologicalConcepts: {
    name: "Biological Concepts",
    icon: "🧬",
    words: [
      "Mitosis", "Meiosis", "Photosynthesis", "Cellular Respiration", "DNA Replication",
      "Transcription", "Translation", "CRISPR", "Natural Selection", "Gene Expression",
      "Enzyme Kinetics", "Krebs Cycle", "Glycolysis", "Electron Transport Chain",
      "ATP Synthase", "Endoplasmic Reticulum", "Golgi Apparatus", "Ribosome",
      "Mitochondria", "Chloroplast", "Cell Membrane", "Osmosis", "Active Transport",
      "Diffusion", "Homeostasis", "Neurotransmitter", "Action Potential", "Synapse",
      "Hardy Weinberg Equilibrium", "Genetic Drift", "Gene Flow", "Speciation",
      "Phylogenetics", "Taxonomy", "Endosymbiosis", "Apoptosis", "Stem Cells",
      "Antibody", "Antigen", "Immune Response", "Innate Immunity", "Adaptive Immunity",
      "Vaccination", "Pathogen", "Antibiotic Resistance", "Biofilm",
      "Nitrogen Cycle", "Carbon Cycle", "Ecological Succession", "Food Web",
      "Trophic Level", "Carrying Capacity", "Biodiversity", "Keystone Species",
      "Symbiosis", "Mutualism", "Parasitism", "Commensalism",
      "Epigenetics", "Recombinant DNA", "Polymerase Chain Reaction", "Gel Electrophoresis",
      "Western Blot", "Southern Blot", "Plasmid", "Restriction Enzyme",
      "Allele Frequency", "Phenotype", "Genotype", "Mendelian Inheritance"
    ]
  }
};

// Export for use in the game
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CATEGORIES;
}
