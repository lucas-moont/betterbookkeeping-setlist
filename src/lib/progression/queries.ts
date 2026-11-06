// Only the key root for now: workout mutations already list it in meta.invalidates, so the
// Progression Chart's queries are refreshed as soon as they exist under this root.
export const progressionKeys = {
  all: ["progression"] as const,
};
