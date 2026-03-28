// Static data - hero slides and location data only
// Products and promo codes now come from Supabase

import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

export const heroSlides = [
  {
    id: 1,
    image: hero1,
    title: "Nouvelle Collection",
    subtitle: "Automne / Hiver 2024",
  },
  {
    id: 2,
    image: hero2,
    title: "Style Urbain",
    subtitle: "Made in DRC, Worn Worldwide",
  },
  {
    id: 3,
    image: hero3,
    title: "Édition Limitée",
    subtitle: "Découvrez l'exclusivité VSM",
  },
];

// Kinshasa communes with delivery zones
export const kinshasaCommunes: { name: string; zone: "proche" | "moyenne" | "eloignee"; deliveryFee: number }[] = [
  { name: "Ngiri-Ngiri", zone: "proche", deliveryFee: 8000 },
  { name: "Kalamu", zone: "proche", deliveryFee: 8000 },
  { name: "Kasa-Vubu", zone: "proche", deliveryFee: 8000 },
  { name: "Bumbu", zone: "proche", deliveryFee: 8500 },
  { name: "Makala", zone: "proche", deliveryFee: 9000 },
  { name: "Selembao", zone: "moyenne", deliveryFee: 10000 },
  { name: "Bandalungwa", zone: "moyenne", deliveryFee: 10000 },
  { name: "Lingwala", zone: "moyenne", deliveryFee: 10500 },
  { name: "Kinshasa (commune)", zone: "moyenne", deliveryFee: 10500 },
  { name: "Barumbu", zone: "moyenne", deliveryFee: 11000 },
  { name: "Gombe", zone: "moyenne", deliveryFee: 11000 },
  { name: "Kintambo", zone: "moyenne", deliveryFee: 11500 },
  { name: "Lemba", zone: "moyenne", deliveryFee: 12000 },
  { name: "Limete", zone: "moyenne", deliveryFee: 12000 },
  { name: "Ngaba", zone: "moyenne", deliveryFee: 12000 },
  { name: "Matete", zone: "moyenne", deliveryFee: 12500 },
  { name: "Ngaliema", zone: "eloignee", deliveryFee: 13000 },
  { name: "Mont-Ngafula", zone: "eloignee", deliveryFee: 14000 },
  { name: "Kisenso", zone: "eloignee", deliveryFee: 14000 },
  { name: "N'djili", zone: "eloignee", deliveryFee: 14500 },
  { name: "Masina", zone: "eloignee", deliveryFee: 14500 },
  { name: "Kimbanseke", zone: "eloignee", deliveryFee: 15000 },
  { name: "N'sele", zone: "eloignee", deliveryFee: 15000 },
  { name: "Maluku", zone: "eloignee", deliveryFee: 15000 },
];

export const provinces = [
  "Kinshasa", "Kongo-Central", "Kwango", "Kwilu", "Mai-Ndombe",
  "Équateur", "Mongala", "Nord-Ubangi", "Sud-Ubangi", "Tshuapa",
  "Kasaï", "Kasaï-Central", "Kasaï-Oriental", "Lomami", "Sankuru",
  "Haut-Katanga", "Haut-Lomami", "Lualaba", "Tanganyika",
  "Maniema", "Nord-Kivu", "Sud-Kivu", "Bas-Uele", "Haut-Uele", "Ituri", "Tshopo",
];
