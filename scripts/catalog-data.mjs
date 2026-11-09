// Demo catalogue: 20 units in 10 properties (5 units each in Mangalia area, Constanța, Brașov, Timișoara).
// Prices are in LEI here; the seed script converts to bani. `q` = Wikimedia Commons search terms per photo group.
// Amenity keys must come from src/lib/mock-units.ts (AMENITIES).

export const OWNER = { email: "demo.catalog@example.com", full_name: "Demo Catalog" };
export const ORG = { name: "Sejur Demo Turism SRL", slug: "sejur-demo" };

export const properties = [
  // ---------------- Mangalia area ----------------
  {
    slug: "vila-lacul-saturn", name: "Vila Lacul Saturn", city: "Saturn, Constanța", lat: 43.8002, lng: 28.5987,
    address: "Aleea Lacului 12", cityQ: "Saturn Mangalia seaside",
    description: "Vilă familială la 150 m de plajă, cu terasă umbrită și grătar în curte.",
    amenities: ["wifi", "parking", "sea", "ac"], checkin: "14:00", checkout: "11:00",
    units: [
      { name: "Apartament Terasa Lacului", type: "apartament", guests: 4, bedrooms: 2, beds: 3, baths: 1, m2: 52, price: 380, weekend: 450, min: 2,
        desc: "Cazare pentru 4 persoane la 150 m de plajă, cu terasă privată unde puteți lua micul dejun. Bucătărie utilată, aer condiționat și parcare în curte; ideal pentru o vacanță în familie.",
        amenities: ["wifi", "parking", "kitchen", "ac", "sea"], q: ["apartment bedroom interior", "apartment kitchen living room"] },
      { name: "Garsonieră Răsărit pe Lac", type: "garsoniera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 28, price: 240, weekend: 290, min: 2,
        desc: "Cazare pentru doi, la câțiva pași de plajă și de lacul Saturn. Pat matrimonial, chicinetă și aer condiționat, perfectă pentru o escapadă la mare.",
        amenities: ["wifi", "ac", "sea"], q: ["studio apartment interior", "small bedroom hotel"] },
    ],
  },
  {
    slug: "pensiunea-vama-veche", name: "Pensiunea Stuf", city: "Vama Veche, Constanța", lat: 43.7518, lng: 28.5742,
    address: "Strada Plajei 24", cityQ: "Vama Veche beach",
    description: "Pensiune în stil boem, la 100 m de plaja din Vama Veche, cu curte amenajată.",
    amenities: ["wifi", "sea", "pets"], checkin: "15:00", checkout: "11:00",
    units: [
      { name: "Căsuța cu Verandă", type: "casuta", guests: 3, bedrooms: 1, beds: 2, baths: 1, m2: 34, price: 340, weekend: 430, min: 2,
        desc: "Vacanță la 100 m de plajă, într-o căsuță cu verandă și curte proprie. Dormitor cu ieșire în grădină, living cu bucătărie utilată; animalele de companie sunt binevenite.",
        amenities: ["wifi", "ac", "pets", "sea", "kitchen"], q: ["holiday cottage bedroom", "seaside cottage terrace"] },
      { name: "Camera Stuf", type: "camera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 18, price: 210, weekend: 260, min: 2,
        desc: "Cazare simplă și curată pentru doi, la 100 m de plaja din Vama Veche. Baie proprie, aer condiționat și acces la curtea comună pentru serile de vară.",
        amenities: ["wifi", "ac"], q: ["double room hotel interior", "guest room bed"] },
    ],
  },
  {
    slug: "casa-venus-mare", name: "Casa Venus", city: "Mangalia, Constanța", lat: 43.8148, lng: 28.5836,
    address: "Strada Teilor 5", cityQ: "Mangalia city",
    description: "Casă în orașul Mangalia, aproape de port și de lacul Mangalia Nord.",
    amenities: ["wifi", "parking", "ac"], checkin: "14:00", checkout: "11:00",
    units: [
      { name: "Apartament cu Vedere la Port", type: "apartament", guests: 4, bedrooms: 2, beds: 2, baths: 1, m2: 55, price: 320, weekend: 380, min: 2,
        desc: "Cazare pentru 4 persoane, cu balcon spre portul turistic Mangalia. Două dormitoare, bucătărie și parcare; la 10 minute de plajă.",
        amenities: ["wifi", "parking", "ac", "kitchen", "view"], q: ["apartment living room", "apartment balcony view"] },
    ],
  },
  // ---------------- Constanța ----------------
  {
    slug: "residence-tomis", name: "Residence Tomis", city: "Constanța, Constanța", lat: 44.1665, lng: 28.6572,
    address: "Bulevardul Regina Elisabeta 21", cityQ: "Constanta Casino Cazino",
    description: "Clădire renovată în peninsula orașului vechi, la 3 minute de Cazinou și Portul Tomis.",
    amenities: ["wifi", "ac", "sea", "view"], checkin: "15:00", checkout: "11:00",
    units: [
      { name: "Garsonieră Peninsula", type: "garsoniera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 32, price: 290, weekend: 340, min: 1,
        desc: "Sejur în inima orașului vechi, la 3 minute de Cazinou. Spațiu luminos pentru doi, cu tavane înalte și aer condiționat.",
        amenities: ["wifi", "ac", "view"], q: ["studio apartment interior", "loft apartment bedroom"] },
      { name: "Apartament cu Vedere spre Faleză", type: "apartament", guests: 4, bedrooms: 2, beds: 3, baths: 1, m2: 60, price: 420, weekend: 500, min: 2,
        desc: "Cazare pentru 4 persoane la 200 m de faleză, cu priveliște parțială spre mare. Două dormitoare și bucătărie, bun pentru o vacanță în familie.",
        amenities: ["wifi", "ac", "sea", "view", "kitchen"], q: ["apartment bedroom interior", "apartment kitchen"] },
      { name: "Camera Portului", type: "camera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 19, price: 200, weekend: 240, min: 1,
        desc: "Cazare pentru doi la 5 minute pe jos de Portul Tomis. Cameră dublă cu baie proprie și aer condiționat, bună pentru o escapadă de weekend.",
        amenities: ["wifi", "ac"], q: ["double room hotel interior", "hotel room bed"] },
    ],
  },
  {
    slug: "vila-mamaia-nord", name: "Vila Mamaia Nord", city: "Mamaia, Constanța", lat: 44.2549, lng: 28.6168,
    address: "Aleea Dumbrava 8", cityQ: "Mamaia beach",
    description: "Vilă cu piscină exterioară în Mamaia Nord, la 5 minute pe jos de plajă.",
    amenities: ["wifi", "parking", "pool", "ac", "sea"], checkin: "15:00", checkout: "11:00",
    units: [
      { name: "Apartament Oaza cu Piscină", type: "apartament", guests: 4, bedrooms: 2, beds: 2, baths: 2, m2: 64, price: 520, weekend: 650, min: 3,
        desc: "Vacanță în Mamaia Nord, cu acces la piscină și parcare incluse. Două dormitoare și două băi pentru 4 persoane, la 5 minute de plajă.",
        amenities: ["wifi", "parking", "pool", "ac", "kitchen"], q: ["villa swimming pool resort", "apartment living room"] },
      { name: "Camera Dublă Mamaia", type: "camera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 20, price: 280, weekend: 360, min: 2,
        desc: "Cazare cu mic dejun inclus, pentru doi, la 5 minute de plajă. Cameră dublă cu balcon și acces la piscina vilei.",
        amenities: ["wifi", "ac", "breakfast", "pool"], q: ["double room balcony hotel", "hotel room bed"] },
    ],
  },
  // ---------------- Brașov ----------------
  {
    slug: "casa-sfatului-view", name: "Casa Sub Tâmpa", city: "Brașov, Brașov", lat: 45.6401, lng: 25.5962,
    address: "Strada Piatra Mare 3", cityQ: "Brasov Tampa Council Square",
    description: "Casă veche renovată la poalele Tâmpei, la 10 minute pe jos de Piața Sfatului.",
    amenities: ["wifi", "view", "fireplace"], checkin: "15:00", checkout: "11:00",
    units: [
      { name: "Apartament la Poalele Tâmpei", type: "apartament", guests: 4, bedrooms: 2, beds: 3, baths: 1, m2: 62, price: 420, weekend: 480, min: 2,
        desc: "Cazare pentru 4 persoane, cu grinzi aparente și vedere spre Tâmpa, la 10 minute pe jos de Piața Sfatului. Bucătărie utilată și șemineu.",
        amenities: ["wifi", "kitchen", "view", "fireplace"], q: ["apartment interior wooden beams", "apartment living room"] },
      { name: "Garsonieră în Orașul Vechi", type: "garsoniera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 30, price: 260, weekend: 310, min: 1,
        desc: "Sejur în centrul istoric al Brașovului, la două străzi de Piața Sfatului. Spațiu cald pentru doi, cu vedere spre oraș.",
        amenities: ["wifi", "view"], q: ["studio apartment interior", "bedroom apartment"] },
    ],
  },
  {
    slug: "cabana-poiana-brasov", name: "Cabana Poiana", city: "Poiana Brașov, Brașov", lat: 45.5949, lng: 25.5547,
    address: "Strada Poiana Soarelui 41", cityQ: "Poiana Brasov ski resort",
    description: "Cabane din lemn la 300 m de pârtia Stadion, cu șemineu și saună în comun.",
    amenities: ["wifi", "parking", "fireplace", "view"], checkin: "16:00", checkout: "11:00",
    units: [
      { name: "Cabana Brad la Poiana Brașov", type: "casuta", guests: 6, bedrooms: 3, beds: 4, baths: 2, m2: 85, price: 780, weekend: 950, min: 2,
        desc: "Vacanță la munte pentru până la 6 persoane: trei dormitoare, șemineu și terasă spre pădure, la 300 m de pârtie. Animalele de companie sunt acceptate.",
        amenities: ["wifi", "parking", "fireplace", "kitchen", "view", "pets"], q: ["log cabin interior", "wooden chalet bedroom"] },
      { name: "Camera Dublă Ski", type: "camera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 22, price: 340, weekend: 420, min: 1,
        desc: "Cazare pentru doi într-o cameră din lemn, cu balcon spre pârtie și mic dejun inclus, la câțiva pași de schi.",
        amenities: ["wifi", "breakfast", "view"], q: ["chalet room wooden bed", "ski resort hotel room"] },
    ],
  },
  {
    slug: "pensiunea-rasnov", name: "Pensiunea Cetatea", city: "Râșnov, Brașov", lat: 45.5889, lng: 25.4627,
    address: "Strada Republicii 70", cityQ: "Rasnov fortress",
    description: "Pensiune cu priveliște spre Cetatea Râșnov, la 15 minute cu mașina de Brașov.",
    amenities: ["wifi", "parking", "breakfast", "view"], checkin: "14:00", checkout: "11:00",
    units: [
      { name: "Apartament cu Priveliște spre Cetatea Râșnov", type: "apartament", guests: 4, bedrooms: 2, beds: 2, baths: 1, m2: 50, price: 360, weekend: 420, min: 2,
        desc: "Cazare pentru 4 persoane la mansardă, cu vedere spre Cetatea Râșnov și Postăvarul. Bucătărie utilată și parcare; la 15 minute de Brașov.",
        amenities: ["wifi", "parking", "kitchen", "view"], q: ["attic apartment bedroom", "apartment kitchen living"] },
    ],
  },
  // ---------------- Timișoara ----------------
  {
    slug: "casa-iosefin", name: "Casa Iosefin", city: "Timișoara, Timiș", lat: 45.7476, lng: 21.2106,
    address: "Strada Sfântul Gheorghe 9", cityQ: "Timisoara Iosefin",
    description: "Casă interbelică renovată în cartierul Iosefin, la 5 minute de Piața Traian.",
    amenities: ["wifi", "ac", "parking"], checkin: "14:00", checkout: "11:00",
    units: [
      { name: "Apartament Iosefin", type: "apartament", guests: 4, bedrooms: 2, beds: 3, baths: 1, m2: 58, price: 340, weekend: 380, min: 1,
        desc: "Cazare pentru 4 persoane într-o casă interbelică din Timișoara, la 5 minute de Piața Traian. Parchet, tavane înalte și bucătărie utilată.",
        amenities: ["wifi", "ac", "kitchen", "parking"], q: ["apartment interior parquet", "apartment living room modern"] },
      { name: "Garsonieră pe Malul Begăi", type: "garsoniera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 30, price: 220, weekend: 250, min: 1,
        desc: "Sejur pentru doi lângă canalul Bega, la 10 minute pe jos de Piața Victoriei. Aer condiționat și chicinetă.",
        amenities: ["wifi", "ac"], q: ["studio apartment interior", "small apartment bed"] },
    ],
  },
  {
    slug: "pensiunea-fabric", name: "Pensiunea Fabric", city: "Timișoara, Timiș", lat: 45.7605, lng: 21.2402,
    address: "Strada Mărășești 18", cityQ: "Timisoara Fabric Piata Victoriei",
    description: "Pensiune discretă în Fabric, cu parcare în curte și mic dejun inclus.",
    amenities: ["wifi", "parking", "breakfast", "ac"], checkin: "14:00", checkout: "11:00",
    units: [
      { name: "Camera Dublă Fabric", type: "camera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 20, price: 230, weekend: 270, min: 1,
        desc: "Cazare cu mic dejun inclus, pentru doi, într-o pensiune liniștită din Fabric. Baie proprie și parcare în curte.",
        amenities: ["wifi", "ac", "breakfast", "parking"], q: ["double room hotel interior", "hotel bedroom"] },
      { name: "Apartament Piața Victoriei", type: "apartament", guests: 3, bedrooms: 1, beds: 2, baths: 1, m2: 45, price: 310, weekend: 360, min: 1,
        desc: "Cazare pentru 3 persoane, la 8 minute pe jos de Piața Victoriei. Living separat, bucătărie și parcare.",
        amenities: ["wifi", "ac", "kitchen", "parking"], q: ["apartment living room sofa", "one bedroom apartment"] },
    ],
  },
  {
    slug: "loft-complex-studentesc", name: "Loft Studio 77", city: "Timișoara, Timiș", lat: 45.7472, lng: 21.2263,
    address: "Bulevardul Vasile Pârvan 14", cityQ: "Timisoara Opera Square",
    description: "Loft modern în apropiere de Universitate și Parcul Rozelor.",
    amenities: ["wifi", "ac"], checkin: "15:00", checkout: "11:00",
    units: [
      { name: "Loft Studio 77", type: "garsoniera", guests: 2, bedrooms: 1, beds: 1, baths: 1, m2: 35, price: 270, weekend: 310, min: 1,
        desc: "Sejur pentru doi într-un loft modern lângă Universitate și Parcul Rozelor, cu bucătărie completă și spațiu de lucru; bun pentru weekend sau călătorii de business.",
        amenities: ["wifi", "ac", "kitchen"], q: ["loft apartment interior", "modern studio apartment"] },
    ],
  },
];
