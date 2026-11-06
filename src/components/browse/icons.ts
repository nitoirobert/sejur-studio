import {
  AirVent,
  BedDouble,
  Building2,
  Coffee,
  CookingPot,
  DoorOpen,
  Flame,
  House,
  LayoutGrid,
  Mountain,
  PawPrint,
  SquareParking,
  Waves,
  WavesLadder,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { Amenity, UnitType } from "@/lib/mock-units";

export const typeIcons: Record<UnitType | "all", LucideIcon> = {
  all: LayoutGrid,
  camera: BedDouble,
  apartament: Building2,
  garsoniera: DoorOpen,
  casuta: House,
};

export const amenityIcons: Record<Amenity, LucideIcon> = {
  wifi: Wifi,
  parking: SquareParking,
  breakfast: Coffee,
  kitchen: CookingPot,
  fireplace: Flame,
  pets: PawPrint,
  ac: AirVent,
  view: Mountain,
  sea: Waves,
  pool: WavesLadder,
};
