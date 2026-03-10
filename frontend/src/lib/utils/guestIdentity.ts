"use client";

import { UserRole, type User } from "@/graphql/generated/graphql";

const GUEST_ID_KEY = "leafycharge_guest_id";
const GUEST_NAME_KEY = "leafycharge_guest_name";
const GUEST_ROLE_KEY = "leafycharge_guest_role";
const GUEST_VEHICLES_KEY = "leafycharge_guest_vehicles";
const DEFAULT_GUEST_VEHICLES = ["BMW i3", "Volkswagen ID.4"] as const;
const DEMO_GUEST_VEHICLE_IDS: Record<string, string> = {
  "BMW i3": "64f111111111111111111111",
  "Volkswagen ID.4": "64f222222222222222222222"
};

const ADJECTIVES = [
  "Swift",
  "Electric",
  "Green",
  "Rapid",
  "Bright",
  "Solar",
  "Clean",
  "Smart",
  "Eco",
  "Turbo",
  "Silent",
  "Dynamic",
  "Future",
  "Active",
  "Volt",
];

const ANIMALS = [
  "Fox",
  "Falcon",
  "Tiger",
  "Eagle",
  "Panda",
  "Lion",
  "Hawk",
  "Wolf",
  "Bear",
  "Otter",
  "Rabbit",
  "Lynx",
  "Owl",
  "Koala",
  "Badger",
];

// Simple ObjectId generator (24 hex chars)
function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return (timestamp + random).padEnd(24, "0");
}

function generateGuestName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

function getStoredGuestRole(): UserRole {
  if (typeof window === "undefined") {
    return UserRole.User;
  }

  const storedRole = localStorage.getItem(GUEST_ROLE_KEY);
  return storedRole === UserRole.Admin ? UserRole.Admin : UserRole.User;
}

function normalizeGuestVehicles(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_GUEST_VEHICLES];
  }

  const vehicles = raw
    .filter((vehicle): vehicle is string => typeof vehicle === "string")
    .map((vehicle) => vehicle.trim())
    .filter(Boolean);

  return vehicles.length > 0 ? vehicles : [...DEFAULT_GUEST_VEHICLES];
}

function getGuestVehicleId(vehicleName: string): string {
  const knownVehicleId = DEMO_GUEST_VEHICLE_IDS[vehicleName];
  if (knownVehicleId) {
    return knownVehicleId;
  }

  let hash = 0;
  for (const char of vehicleName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const hex = hash.toString(16).padStart(8, "0");
  return `${hex}${hex}${hex}`.slice(0, 24);
}

function splitVehicleLabel(vehicleName: string): { make: string; model: string } {
  const [make = vehicleName, ...modelParts] = vehicleName.split(" ");
  return {
    make,
    model: modelParts.join(" ") || vehicleName
  };
}

export type GuestIdentity = User & {
  isGuest: true;
  vehicles: string[];
};

export type GuestVehicle = {
  id: string;
  name: string;
  make: string;
  model: string;
};

export function getStoredGuestVehicleNames(): string[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_GUEST_VEHICLES];
  }

  const storedVehicles = localStorage.getItem(GUEST_VEHICLES_KEY);
  if (!storedVehicles) {
    const vehicles = [...DEFAULT_GUEST_VEHICLES];
    localStorage.setItem(GUEST_VEHICLES_KEY, JSON.stringify(vehicles));
    return vehicles;
  }

  try {
    const vehicles = normalizeGuestVehicles(JSON.parse(storedVehicles));
    localStorage.setItem(GUEST_VEHICLES_KEY, JSON.stringify(vehicles));
    return vehicles;
  } catch {
    const vehicles = [...DEFAULT_GUEST_VEHICLES];
    localStorage.setItem(GUEST_VEHICLES_KEY, JSON.stringify(vehicles));
    return vehicles;
  }
}

export function getStoredGuestVehicles(): GuestVehicle[] {
  return getStoredGuestVehicleNames().map((vehicleName) => {
    const { make, model } = splitVehicleLabel(vehicleName);
    return {
      id: getGuestVehicleId(vehicleName),
      name: vehicleName,
      make,
      model
    };
  });
}

export function getOrInitGuestIdentity(): GuestIdentity {
  if (typeof window === "undefined") {
    // Return a placeholder for SSR
    return {
      id: "guest-placeholder",
      displayName: "Guest",
      email: "guest@example.com",
      roles: [UserRole.User],
      isGuest: true,
      vehicles: [...DEFAULT_GUEST_VEHICLES]
    };
  }

  let guestId = localStorage.getItem(GUEST_ID_KEY);
  let guestName = localStorage.getItem(GUEST_NAME_KEY);

  if (!guestId) {
    guestId = generateObjectId();
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  if (!guestName) {
    guestName = generateGuestName();
    localStorage.setItem(GUEST_NAME_KEY, guestName);
  }

  const role = getStoredGuestRole();
  const vehicles = getStoredGuestVehicleNames();
  localStorage.setItem(GUEST_ROLE_KEY, role);

  return {
    id: guestId,
    displayName: guestName,
    email: `${guestName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    roles: [role],
    isGuest: true,
    vehicles
  };
}

export function setGuestRole(role: UserRole): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(GUEST_ROLE_KEY, role);
}

export function resetGuestIdentity(): GuestIdentity {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem(GUEST_NAME_KEY);
    localStorage.removeItem(GUEST_ROLE_KEY);
    localStorage.removeItem(GUEST_VEHICLES_KEY);
  }
  return getOrInitGuestIdentity();
}
