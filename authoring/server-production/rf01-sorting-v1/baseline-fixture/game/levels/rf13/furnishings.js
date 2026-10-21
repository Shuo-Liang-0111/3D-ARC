export const CLINIC_FURNISHINGS = [
  { id: "handwash-cabinet", size: [0.86, 0.9, 0.7], position: [6.3, 0.45, -4.2], color: "#e3e6df", category: "fixture" },
  { id: "medicine-cabinet", size: [0.85, 1.9, 0.48], position: [6.4, 0.95, -2.35], color: "#d8e2df", category: "fixture" },
  { id: "waiting-seat-extra", size: [0.6, 0.9, 0.65], position: [-6.35, 0.45, 3.25], color: "#527d76", category: "fixture" },
  ...[-1.75, 1.75].map(center => ({
    id: `privacy-curtain-${center}`, size: [0.08, 2.06, 0.26], position: [center + 0.70, 1.43, -1.88], color: "#e3e6df", category: "fixture",
  })),
  ...[-5.25, -1.75, 1.75, 5.25].map(center => ({
    id: `sliding-door-${center}`, size: [1.16, 2.13, 0.045], position: [center + 1.31, 1.105, -0.905], color: "#c3b299", category: "fixture",
  })),
];
