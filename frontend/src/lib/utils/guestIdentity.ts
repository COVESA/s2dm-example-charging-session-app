"use client";

import { UserRole, type User } from "@/graphql/generated/graphql";

const GUEST_ID_KEY = "leafycharge_guest_id";
const GUEST_NAME_KEY = "leafycharge_guest_name";

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

export type GuestIdentity = User & {
  isGuest: true;
};

export function getOrInitGuestIdentity(): GuestIdentity {
  if (typeof window === "undefined") {
    // Return a placeholder for SSR
    return {
      id: "guest-placeholder",
      displayName: "Guest",
      email: "guest@example.com",
      roles: [UserRole.User],
      isGuest: true,
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

  return {
    id: guestId,
    displayName: guestName,
    email: `${guestName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    roles: [UserRole.User],
    isGuest: true,
  };
}

export function resetGuestIdentity(): GuestIdentity {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem(GUEST_NAME_KEY);
  }
  return getOrInitGuestIdentity();
}
