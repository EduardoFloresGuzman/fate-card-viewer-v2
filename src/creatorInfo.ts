/**
 * Static "about the creator" content for the home page — sourced once from the public GitHub
 * API (`gh api users/EduardoFloresGuzman`), not fetched live client-side. This is stable
 * portfolio-style content, not live data, and baking it in avoids adding a second external
 * runtime dependency (beyond the Atlas Academy API) plus the unauthenticated GitHub API's
 * 60-req/hour-per-IP limit, which a public site's visitors would otherwise share.
 */
export interface RepoHighlight {
  name: string;
  description: string;
  url: string;
  language: string;
}

export const CREATOR = {
  name: "Eduardo Flores",
  bio: "I'm passionate about software development, because any idea I may have, I can make it a reality.",
  location: "Tijuana, Baja California, México",
  company: "iTjuana",
  avatarUrl: "https://avatars.githubusercontent.com/u/9208418?v=4",
  githubUrl: "https://github.com/EduardoFloresGuzman",
};

export const FEATURED_REPOS: RepoHighlight[] = [
  {
    name: "fate-card-viewer-v2",
    description:
      "Interactive holographic trading-card viewer for Fate/Grand Order servants, powered by the Atlas Academy API — this project.",
    url: "https://github.com/EduardoFloresGuzman/fate-card-viewer-v2",
    language: "TypeScript",
  },
  {
    name: "rtl-exercises",
    description: "Best practices for testing your apps with Jest and React Testing Library.",
    url: "https://github.com/EduardoFloresGuzman/rtl-exercises",
    language: "JavaScript",
  },
  {
    name: "react-expense-tracker",
    description: "A simple expense tracker built with React.",
    url: "https://github.com/EduardoFloresGuzman/react-expense-tracker",
    language: "JavaScript",
  },
  {
    name: "react-native-todo-app",
    description: "A simple to-do list app built with React Native.",
    url: "https://github.com/EduardoFloresGuzman/react-native-todo-app",
    language: "JavaScript",
  },
];
