// Curated seed data for the product catalog. Pure data, no DB access — kept
// separate from generate.ts's builder logic so the catalog shape (brands,
// category tree, product templates) is easy to scan and adjust on its own.

export type VariantKind = "storage" | "config" | "color";

export type ProductTemplate = {
  name: string;
  brand: string; // must match a name in BRAND_NAMES
  basePrice: number; // INR — base variant's mrp; other variants step up from here
};

// A single recursive shape for the whole tree: a node can hold its own
// products directly (kind + products), have children, or both — e.g.
// "Tablets" holds non-Apple tablets directly while also parenting "iPads".
// Category depth stays at 1 level in the actual seeded data (matching
// FR-CAT-014's real hierarchy limit), even though this type itself doesn't
// enforce that.
export type CategoryNode = {
  name: string;
  kind?: VariantKind;
  products?: ProductTemplate[];
  children?: CategoryNode[];
};

// Deduplicated — every brand referenced by any product template below
// appears here exactly once, regardless of how many categories it sells in
// (e.g. Apple sells in iPhones/Macs/iPads/Headphones/Earbuds).
export const BRAND_NAMES: string[] = [
  "Apple",
  "Samsung",
  "Google",
  "OnePlus",
  "Xiaomi",
  "Nothing",
  "Dell",
  "HP",
  "Lenovo",
  "ASUS",
  "Acer",
  "Microsoft",
  "Sony",
  "Bose",
  "Sennheiser",
  "JBL",
  "Beats",
  "Marshall",
  "Skullcandy",
  "SteelSeries",
  "HyperX",
  "Logitech",
  "Razer",
  "Corsair",
  "boAt",
  "Amazon",
  "Huawei",
  "Turtle Beach",
];

export const CATEGORY_TREE: CategoryNode[] = [
  {
    name: "Phones",
    children: [
      {
        name: "iPhones",
        kind: "storage",
        products: [
          { name: "iPhone SE (3rd Gen)", brand: "Apple", basePrice: 43900 },
          { name: "iPhone 13", brand: "Apple", basePrice: 49900 },
          { name: "iPhone 13 mini", brand: "Apple", basePrice: 46900 },
          { name: "iPhone 14", brand: "Apple", basePrice: 59900 },
          { name: "iPhone 14 Plus", brand: "Apple", basePrice: 69900 },
          { name: "iPhone 14 Pro", brand: "Apple", basePrice: 89900 },
          { name: "iPhone 15", brand: "Apple", basePrice: 79900 },
          { name: "iPhone 15 Plus", brand: "Apple", basePrice: 89900 },
          { name: "iPhone 15 Pro", brand: "Apple", basePrice: 129900 },
          { name: "iPhone 15 Pro Max", brand: "Apple", basePrice: 159900 },
          { name: "iPhone 16 Pro", brand: "Apple", basePrice: 139900 },
        ],
      },
      {
        name: "Android Phones",
        kind: "storage",
        products: [
          { name: "Samsung Galaxy S24 Ultra", brand: "Samsung", basePrice: 129999 },
          { name: "Samsung Galaxy S24+", brand: "Samsung", basePrice: 99999 },
          { name: "Samsung Galaxy S24", brand: "Samsung", basePrice: 79999 },
          { name: "Samsung Galaxy S23 FE", brand: "Samsung", basePrice: 59999 },
          { name: "Samsung Galaxy A55", brand: "Samsung", basePrice: 39999 },
          { name: "Google Pixel 8 Pro", brand: "Google", basePrice: 106999 },
          { name: "Google Pixel 8", brand: "Google", basePrice: 75999 },
          { name: "Google Pixel 7a", brand: "Google", basePrice: 43999 },
          { name: "OnePlus 12", brand: "OnePlus", basePrice: 64999 },
          { name: "Xiaomi 14", brand: "Xiaomi", basePrice: 69999 },
          { name: "Nothing Phone 2", brand: "Nothing", basePrice: 44999 },
        ],
      },
    ],
  },
  {
    name: "Laptops",
    kind: "config",
    products: [
      { name: "Dell XPS 13", brand: "Dell", basePrice: 99990 },
      { name: "Dell XPS 15", brand: "Dell", basePrice: 149990 },
      { name: "Dell Inspiron 15", brand: "Dell", basePrice: 54990 },
      { name: "HP Spectre x360 14", brand: "HP", basePrice: 134990 },
      { name: "HP Pavilion 15", brand: "HP", basePrice: 59990 },
      { name: "Lenovo ThinkPad X1 Carbon", brand: "Lenovo", basePrice: 154990 },
      { name: "Lenovo Legion 5", brand: "Lenovo", basePrice: 89990 },
      { name: "ASUS ROG Zephyrus G14", brand: "ASUS", basePrice: 144990 },
      { name: "ASUS VivoBook 15", brand: "ASUS", basePrice: 49990 },
      { name: "Acer Swift 3", brand: "Acer", basePrice: 54990 },
      { name: "Microsoft Surface Laptop 5", brand: "Microsoft", basePrice: 99990 },
    ],
  },
  {
    name: "Macs",
    kind: "config",
    products: [
      { name: "MacBook Air 13-inch (M2)", brand: "Apple", basePrice: 99900 },
      { name: "MacBook Air 13-inch (M3)", brand: "Apple", basePrice: 114900 },
      { name: "MacBook Air 15-inch (M3)", brand: "Apple", basePrice: 134900 },
      { name: "MacBook Pro 14-inch (M3)", brand: "Apple", basePrice: 169900 },
      { name: "MacBook Pro 14-inch (M3 Pro)", brand: "Apple", basePrice: 199900 },
      { name: "MacBook Pro 16-inch (M3 Pro)", brand: "Apple", basePrice: 249900 },
      { name: "iMac 24-inch (M3)", brand: "Apple", basePrice: 134900 },
      { name: "Mac mini (M2)", brand: "Apple", basePrice: 59900 },
      { name: "Mac mini (M2 Pro)", brand: "Apple", basePrice: 129900 },
      { name: "Mac Studio (M2 Max)", brand: "Apple", basePrice: 199900 },
      { name: "Mac Pro (M2 Ultra)", brand: "Apple", basePrice: 699900 },
    ],
  },
  {
    name: "Tablets",
    kind: "storage",
    products: [
      { name: "Samsung Galaxy Tab S9 Ultra", brand: "Samsung", basePrice: 108999 },
      { name: "Samsung Galaxy Tab S9+", brand: "Samsung", basePrice: 89999 },
      { name: "Samsung Galaxy Tab S9", brand: "Samsung", basePrice: 65999 },
      { name: "Samsung Galaxy Tab A9+", brand: "Samsung", basePrice: 19999 },
      { name: "Lenovo Tab P11 Pro", brand: "Lenovo", basePrice: 34999 },
      { name: "Lenovo Tab P12", brand: "Lenovo", basePrice: 27999 },
      { name: "Xiaomi Pad 6", brand: "Xiaomi", basePrice: 26999 },
      { name: "Amazon Fire HD 10", brand: "Amazon", basePrice: 14999 },
      { name: "Amazon Fire HD 8", brand: "Amazon", basePrice: 9999 },
      { name: "Microsoft Surface Pro 9", brand: "Microsoft", basePrice: 99999 },
      { name: "Huawei MatePad 11", brand: "Huawei", basePrice: 32999 },
    ],
    children: [
      {
        name: "iPads",
        kind: "storage",
        products: [
          { name: "iPad (9th Generation)", brand: "Apple", basePrice: 29900 },
          { name: "iPad (10th Generation)", brand: "Apple", basePrice: 34900 },
          { name: "iPad mini (6th Generation)", brand: "Apple", basePrice: 49900 },
          { name: "iPad Air 11-inch (M2)", brand: "Apple", basePrice: 59900 },
          { name: "iPad Air 13-inch (M2)", brand: "Apple", basePrice: 79900 },
          { name: "iPad Pro 11-inch (M4)", brand: "Apple", basePrice: 99900 },
          { name: "iPad Pro 13-inch (M4)", brand: "Apple", basePrice: 129900 },
          { name: "iPad Pro 11-inch (M2)", brand: "Apple", basePrice: 89900 },
          { name: "iPad Pro 12.9-inch (M2)", brand: "Apple", basePrice: 112900 },
          { name: "iPad Air (5th Generation)", brand: "Apple", basePrice: 54900 },
          { name: "iPad mini (5th Generation)", brand: "Apple", basePrice: 39900 },
        ],
      },
    ],
  },
  {
    name: "Audio",
    children: [
      {
        name: "Headphones",
        kind: "color",
        products: [
          { name: "Sony WH-1000XM5", brand: "Sony", basePrice: 29990 },
          { name: "Sony WH-CH720N", brand: "Sony", basePrice: 8990 },
          { name: "Bose QuietComfort Ultra", brand: "Bose", basePrice: 34900 },
          { name: "Bose QuietComfort 45", brand: "Bose", basePrice: 24900 },
          { name: "Sennheiser Momentum 4", brand: "Sennheiser", basePrice: 29990 },
          { name: "JBL Tune 760NC", brand: "JBL", basePrice: 4999 },
          { name: "Apple AirPods Max", brand: "Apple", basePrice: 59900 },
          { name: "Beats Studio Pro", brand: "Beats", basePrice: 34900 },
          { name: "Marshall Major IV", brand: "Marshall", basePrice: 10999 },
          { name: "Skullcandy Crusher Evo", brand: "Skullcandy", basePrice: 12999 },
          { name: "Sony WH-1000XM4", brand: "Sony", basePrice: 24990 },
        ],
      },
      {
        name: "Earbuds",
        kind: "color",
        products: [
          { name: "Apple AirPods Pro (2nd Gen)", brand: "Apple", basePrice: 24900 },
          { name: "Apple AirPods (3rd Gen)", brand: "Apple", basePrice: 19900 },
          { name: "Samsung Galaxy Buds2 Pro", brand: "Samsung", basePrice: 17999 },
          { name: "Samsung Galaxy Buds FE", brand: "Samsung", basePrice: 6999 },
          { name: "Sony WF-1000XM5", brand: "Sony", basePrice: 24990 },
          { name: "Bose QuietComfort Earbuds II", brand: "Bose", basePrice: 25900 },
          { name: "JBL Tune 130NC", brand: "JBL", basePrice: 3999 },
          { name: "boAt Airdopes 141", brand: "boAt", basePrice: 1499 },
          { name: "OnePlus Buds Pro 2", brand: "OnePlus", basePrice: 11999 },
          { name: "Google Pixel Buds Pro", brand: "Google", basePrice: 19999 },
          { name: "Beats Fit Pro", brand: "Beats", basePrice: 19900 },
        ],
      },
      {
        name: "Headsets",
        kind: "color",
        products: [
          { name: "SteelSeries Arctis Nova Pro", brand: "SteelSeries", basePrice: 34999 },
          { name: "SteelSeries Arctis 7+", brand: "SteelSeries", basePrice: 17999 },
          { name: "HyperX Cloud II", brand: "HyperX", basePrice: 6999 },
          { name: "HyperX Cloud Alpha", brand: "HyperX", basePrice: 7999 },
          { name: "Logitech G Pro X", brand: "Logitech", basePrice: 10999 },
          { name: "Logitech G435", brand: "Logitech", basePrice: 4999 },
          { name: "Razer BlackShark V2", brand: "Razer", basePrice: 8999 },
          { name: "Corsair HS80 RGB", brand: "Corsair", basePrice: 13999 },
          { name: "JBL Quantum 100", brand: "JBL", basePrice: 2999 },
          { name: "Sony Inzone H9", brand: "Sony", basePrice: 24990 },
          { name: "Turtle Beach Recon 200", brand: "Turtle Beach", basePrice: 6999 },
        ],
      },
    ],
  },
];
