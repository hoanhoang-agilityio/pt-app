export type Candidate = {
  key: string;
  kind: "user" | "admin";
  id: number;
  name: string;
};

export type GroupCandidatesResponseLike = {
  trainees: Candidate[];
  pts: Candidate[];
};
