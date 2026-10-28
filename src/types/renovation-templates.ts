export interface TimelinePhaseTemplate {
  name: string;
  description: string;
  weeks: string; // e.g. "1–3 wk", "TBD"
}

// Standard 5-phase renovation timeline used across tiers
export const DEFAULT_TIMELINE_PHASES_5: TimelinePhaseTemplate[] = [
  {
    name: "Planning & Permits",
    description: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
    weeks: "1–3 weeks",
  },
  {
    name: "Demolition",
    description: "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor",
    weeks: "1–2 weeks",
  },
  {
    name: "Core Works",
    description: "Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis",
    weeks: "6–12 weeks",
  },
  {
    name: "Finishes",
    description: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione",
    weeks: "4–6 weeks",
  },
  {
    name: "Handover",
    description: "Voluptatem sequi nesciunt neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci velit sed quia non",
    weeks: "1–2 weeks",
  },
];
