export interface Opening {
  eco: string;
  name: string;
  moves: string[];
  uci: string[];
  fen: string;
}

export interface SelectedOpening {
  type: "eco" | "custom";
  id: string;
  name: string;
  moves: string[];
  fen: string;
  uci: string[];
}

export const ECO_CATEGORIES = [
  { prefix: "A", label: "Flank Openings" },
  { prefix: "B", label: "Semi-Open Games" },
  { prefix: "C", label: "Open Games & French" },
  { prefix: "D", label: "Closed & Semi-Closed" },
  { prefix: "E", label: "Indian Defenses" },
] as const;
