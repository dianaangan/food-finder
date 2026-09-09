export type Language = "en" | "nl" | "de" | "fr";
export type Nutrient =
  | "energy"
  | "fat"
  | "saturatedFat"
  | "carbohydrates"
  | "sugars"
  | "fiber"
  | "protein"
  | "salt";
export interface Product {
  id: string;
  name: string | null;
  brand: string | null;
  image: string | null;
  nutrition?: Record<Nutrient, number | null>;
}
export interface SearchResult {
  page: number;
  hasNext: boolean;
  products: Product[];
  premium: boolean;
  warning: string | null;
}
export interface Subscription {
  active: boolean;
  status: string;
  billingAvailable: boolean;
}
export interface RecentSearch {
  term: string;
  language: Language;
}
