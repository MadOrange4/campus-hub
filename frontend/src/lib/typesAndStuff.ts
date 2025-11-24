import type { User } from "firebase/auth";
import { FieldValue, serverTimestamp, type DocumentData } from "firebase/firestore";

export type EventItem = {
  //from file app.tsx
  //file App.tsx
  id: string;
  title: string;
  start: string;
  end?: string;
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string;
  locationLatLng?: { lat: number; lng: number }; // <-- add this
};

/*export interface EventItem { //file Calendar.tsx
  id: string;
  title: string;
  start: string; // ISO string
  end?: string; // ISO string
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string; // Added optional desc
  locationLatLng?: { lat: number; lng: number }; // Added optional locationLatLng
}*/

export function toObj(u: User) {
  //file login
  const base = {
    uid: u.uid,
    email: (u.email ?? "").toLowerCase(),
    name: u.displayName ?? "",
    photoURL: u.photoURL ?? "",
    nameLower: (u.displayName ?? "").toLowerCase(),
    emailLower: (u.email ?? "").toLowerCase(),
    visibility: "campus",
    notificationPrefs: {
      eventReminders: true,
      emailUpdates: false,
      push: true,
    },
    domainOk: (u.email ?? "").toLowerCase().endsWith("@umass.edu"),
    updatedAt: serverTimestamp(),
  };
  return base;
}

export function userObjDefaults(base: UserObj, role: Role) {
  //from file login
  const bald = {
    ...base,
    primaryRole: role,
    roles: [role],
    bio: "",
    pronouns: null,
    phone: null,
    year: null,
    major: null,
    isStaffVerified: false,
    createdAt: serverTimestamp(),
    // nice-to-have counters (optional)
    friendsCount: 0,
    pendingCount: 0,
    preferences: [""],
  };
  return bald;
}

export function userObjUpdateProfile(
  displayName: string,
  bio: string,
  year: string | null,
  major: string,
  pronounsToStore: string | null,
  e164: string | null,
  visibility: string,
  profile: UserProfile | null,
  eventReminders: boolean,
  preferences: Preference_Types[]
) {
  /*TODO: maybe somehow combine these 3 functions...
    Type mismatch between the two base objs.*/
  return {
    name: displayName,
    bio,
    major: major || null,
    year: year ?? null,
    pronouns: pronounsToStore,
    phone: e164, // store normalized value
    visibility,
    notificationPrefs: {
      ...(profile?.notificationPrefs ?? {}),
      eventReminders: eventReminders,
    },
    preferences: preferences,
  };
}

export function userObjLoadProfile(profileUid:string,d: DocumentData){
    return {
              uid: profileUid,
              email: d.email,
              name: d.name,
              photoURL: d.photoURL,
              primaryRole: d.primaryRole,
              roles: d.roles || [],
              year: d.year ?? null,
              major: d.major ?? null,
              bio: d.bio ?? "",
              visibility: d.visibility || "campus",
              isStaffVerified: !!d.isStaffVerified,
              notificationPrefs: d.notificationPrefs,
              domainOk: d.domainOk,
              //edited for type mismatch
              friendsCount: Number(d.friendsCount || 0),
              pendingCount: Number(d.pendingCount || 0),
              createdAt:d.createdAt,
              updatedAt:d.updatedAt,
              preferences: d.preferences || [""],
            }
}

export type UserObj = {
  //TODO: ideally we only want to work with one of UserObj or UserProfile...
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  nameLower: string;
  emailLower: string;
  visibility: string;
  notificationPrefs: {
    eventReminders: boolean;
    emailUpdates: boolean;
    push: boolean;
  };
  domainOk: boolean;
  updatedAt: FieldValue;
};

export type Role =
  | "student"
  | "staff"
  | "admin"
  | "professor"
  | "ta"
  | "club_officer";
export type Year = "freshman" | "sophomore" | "junior" | "senior";
export type Visibility = "public" | "campus" | "private";
export type Preference_Types =
  | "defaultPreference"
  | "preference1"
  | "preference2"
  | "";

export type UserProfile = {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  primaryRole?: Role;
  roles: Role[];
  year?: Year | null;
  major?: string | null;
  bio?: string;
  pronouns?: string | null; // stored as the actual selection or custom text
  phone?: string | null; // stored as E.164 (+1413xxxxxxx)
  visibility: Visibility;
  notificationPrefs: {
    eventReminders: boolean;
    emailUpdates: boolean;
    push: boolean;
    [k: string]: boolean;
  };
  domainOk: boolean;
  isStaffVerified: boolean;
  //shoved these two in from PublicUser type
  friendsCount?: number;
  pendingCount?: number;
  //end
  createdAt?: string;
  updatedAt?: string;
  preferences: Preference_Types[];
};

/* ---------------- Constants ---------------- */
export const YEAR_OPTIONS: Year[] = [
  "freshman",
  "sophomore",
  "junior",
  "senior",
];
export const VIS_OPTIONS: Visibility[] = ["public", "campus", "private"];
export const PRONOUN_OPTIONS = [
  "he/him",
  "she/her",
  "they/them",
  "he/they",
  "she/they",
  "prefer not to say",
  "self-describe" as const,
];
export const INTEREST_OPTIONS = [
  "sports",
  "music",
  "gaming",
  "coding",
  "fitness",
  "travel",
  "volunteering",
  "art",
  "entrepreneurship",
  "research",
  "greek-life",
] as const;
//from file UserProfile
/*type Role = "student"|"staff"|"admin"|"professor"|"ta"|"club_officer";
type Visibility = "public"|"campus"|"private";
type Year = "freshman"|"sophomore"|"junior"|"senior"|"grad"|"alumni"|"staff"|"faculty"|"other";
type Preference_Types = "defaultPreference"|"preference1"|"preference2"|""*/

/*export type PublicUser = {
  uid: string;
  email?: string;
  name?: string;
  photoURL?: string;
  primaryRole?: Role;
  roles?: Role[];
  year?: Year | null;
  major?: string | null;
  bio?: string | null;
  visibility?: Visibility;
  isStaffVerified?: boolean;
  friendsCount?: number;
  pendingCount?: number;
  //TODO something may be wrong...
  preferences: Preference_Types[];
};*/

export type EventMini = {
  id: string;
  title: string;
  start?: string;        // ISO
  location?: string;
  bannerUrl?: string;
};