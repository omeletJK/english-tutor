import manifestData from "@/Character/manifest.json";

export type AvatarManifest = typeof manifestData;
export type AvatarCategoryKey = keyof AvatarManifest["categories"];

export type AvatarSelection = Partial<Record<AvatarCategoryKey, string | null>>;

export const avatarManifest: AvatarManifest = manifestData;

export const defaultAvatarSelection: AvatarSelection = {
  ...avatarManifest.defaultAvatar
};

export function imageUrl(id: string): string {
  return `${avatarManifest.imagePathPrefix}${id}.png`;
}

export function storageKey(studentId: string) {
  return `omelet-avatar:${studentId}`;
}

export function loadAvatar(studentId: string): AvatarSelection {
  if (typeof window === "undefined") {
    return defaultAvatarSelection;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(studentId));
    if (!raw) {
      return defaultAvatarSelection;
    }
    const parsed = JSON.parse(raw) as AvatarSelection;
    return { ...defaultAvatarSelection, ...parsed };
  } catch {
    return defaultAvatarSelection;
  }
}

export function saveAvatar(studentId: string, selection: AvatarSelection) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(studentId), JSON.stringify(selection));
  } catch {
    // localStorage may be unavailable; silently ignore.
  }
}

export function composedLayers(selection: AvatarSelection): string[] {
  const layers: string[] = [avatarManifest.base];
  for (const category of avatarManifest.layerOrder) {
    if (category === "base") continue;
    const id = selection[category as AvatarCategoryKey];
    if (id) {
      layers.push(id);
    }
  }
  return layers;
}
