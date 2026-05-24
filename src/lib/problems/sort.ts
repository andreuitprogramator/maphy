export type ProblemSortId =
  | "year_desc"
  | "year_asc"
  | "difficulty_asc"
  | "difficulty_desc"
  | "submissions_desc"
  | "submissions_asc"
  | "rating_desc"
  | "rating_asc"
  | "ratings_count_desc"
  | "title_asc"
  | "title_desc"
  | "my_submissions_desc"
  | "my_best_desc";

export const PROBLEM_SORT_OPTIONS: { id: ProblemSortId; label: string }[] = [
  { id: "year_desc", label: "An (nou→vechi)" },
  { id: "year_asc", label: "An (vechi→nou)" },
  { id: "difficulty_asc", label: "Dificultate (ușor→greu)" },
  { id: "difficulty_desc", label: "Dificultate (greu→ușor)" },
  { id: "submissions_desc", label: "Cele mai rezolvate" },
  { id: "submissions_asc", label: "Cele mai puțin rezolvate" },
  { id: "rating_desc", label: "Cel mai bine evaluat" },
  { id: "rating_asc", label: "Cel mai slab evaluat" },
  { id: "ratings_count_desc", label: "Cele mai evaluate" },
  { id: "title_asc", label: "Titlu A–Z" },
  { id: "title_desc", label: "Titlu Z–A" },
  { id: "my_submissions_desc", label: "Cele mai încercate de mine" },
  { id: "my_best_desc", label: "Cel mai bun scor al meu" },
];

const ALLOWED = new Set<ProblemSortId>(PROBLEM_SORT_OPTIONS.map((o) => o.id));

export const DEFAULT_PROBLEM_SORT: ProblemSortId = "year_desc";

export function parseProblemSort(raw: string | null | undefined): ProblemSortId {
  if (raw && ALLOWED.has(raw as ProblemSortId)) return raw as ProblemSortId;
  return DEFAULT_PROBLEM_SORT;
}

type Sortable = {
  title: string;
  year: number;
  difficulty: number;
  stats: {
    submissionCount: number;
    ratingAvg: number | null;
    ratingCount: number;
    mySubmissionCount: number;
  };
  myMaxScore: number | null;
};

function ratingSortKey(avg: number | null, desc: boolean): number {
  if (avg == null) return desc ? -1 : 999;
  return avg;
}

export function sortEnrichedProblems<T extends Sortable>(rows: T[], sort: ProblemSortId): T[] {
  const out = [...rows];
  const tie = (a: T, b: T) => a.title.localeCompare(b.title);

  out.sort((a, b) => {
    switch (sort) {
      case "year_desc":
        return b.year - a.year || tie(a, b);
      case "year_asc":
        return a.year - b.year || tie(a, b);
      case "difficulty_asc":
        return a.difficulty - b.difficulty || tie(a, b);
      case "difficulty_desc":
        return b.difficulty - a.difficulty || tie(a, b);
      case "submissions_desc":
        return b.stats.submissionCount - a.stats.submissionCount || tie(a, b);
      case "submissions_asc":
        return a.stats.submissionCount - b.stats.submissionCount || tie(a, b);
      case "rating_desc":
        return ratingSortKey(b.stats.ratingAvg, true) - ratingSortKey(a.stats.ratingAvg, true) || tie(a, b);
      case "rating_asc":
        return ratingSortKey(a.stats.ratingAvg, false) - ratingSortKey(b.stats.ratingAvg, false) || tie(a, b);
      case "ratings_count_desc":
        return b.stats.ratingCount - a.stats.ratingCount || tie(a, b);
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "title_desc":
        return b.title.localeCompare(a.title);
      case "my_submissions_desc":
        return b.stats.mySubmissionCount - a.stats.mySubmissionCount || tie(a, b);
      case "my_best_desc": {
        const ma = a.myMaxScore ?? -1;
        const mb = b.myMaxScore ?? -1;
        return mb - ma || tie(a, b);
      }
      default:
        return 0;
    }
  });

  return out;
}
