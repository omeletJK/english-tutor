import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BookOpen,
  Brain,
  Brush,
  Building2,
  ChefHat,
  CloudRain,
  Coins,
  Compass,
  Cpu,
  Drama,
  Film,
  Gamepad2,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Leaf,
  Lightbulb,
  Microscope,
  Music,
  Newspaper,
  PawPrint,
  Rocket,
  Scale,
  Smartphone,
  Sparkles,
  Sun,
  Telescope,
  TreePine,
  TrendingUp,
  Users
} from "lucide-react";

/* ----------------------------------------------------------------------------
 * Domain → student-facing label + Lucide icon.
 *
 * Keys MUST match the strings used in lib/task-generator.ts `DOMAIN_POOLS`
 * and `FallbackEntry.domain`. The student UI renders a small chip with the
 * icon + label so that "다른 주제 받기" visibly samples across domains.
 * Labels are intentionally short and English-only (per design call) to keep
 * the chip compact.
 * -------------------------------------------------------------------------- */

type DomainPresentation = {
  label: string;
  Icon: LucideIcon;
};

const DOMAIN_MAP: Record<string, DomainPresentation> = {
  // Elementary band
  "school life": { label: "School life", Icon: GraduationCap },
  "family & home": { label: "Family & home", Icon: Home },
  friends: { label: "Friends", Icon: Users },
  "hobbies & games": { label: "Hobbies & games", Icon: Gamepad2 },
  "food & cooking": { label: "Food & cooking", Icon: ChefHat },
  "nature & animals": { label: "Nature & animals", Icon: PawPrint },
  "weather & seasons": { label: "Weather & seasons", Icon: Sun },
  "sports & play": { label: "Sports & play", Icon: HeartPulse },
  "art & music": { label: "Art & music", Icon: Music },
  "holidays & traditions": { label: "Holidays & traditions", Icon: Sparkles },
  "imagination & future": { label: "Imagination & future", Icon: Rocket },
  "books & stories": { label: "Books & stories", Icon: BookOpen },

  // Middle band (adds new + reuses some)
  "family & relationships": { label: "Family & relationships", Icon: Heart },
  "hobbies & creative interests": { label: "Hobbies & creative interests", Icon: Brush },
  "nature & environment": { label: "Nature & environment", Icon: TreePine },
  "science & discovery": { label: "Science & discovery", Icon: Microscope },
  "technology in daily life": { label: "Technology", Icon: Smartphone },
  "ethics & fairness": { label: "Ethics & fairness", Icon: Scale },
  "news & current events": { label: "News & current events", Icon: Newspaper },
  "arts, books & media": { label: "Arts & media", Icon: Film },
  "history & culture": { label: "History & culture", Icon: Landmark },
  "sports & health": { label: "Sports & health", Icon: HeartPulse },
  "future & big questions": { label: "Future & big questions", Icon: Telescope },
  "money & responsibility": { label: "Money & responsibility", Icon: Coins },
  "neighborhood & community": { label: "Neighborhood & community", Icon: Building2 },

  // High band
  "society & community": { label: "Society & community", Icon: Building2 },
  "philosophy & big questions": { label: "Philosophy & big questions", Icon: Lightbulb },
  "ethics & moral dilemmas": { label: "Ethics & moral dilemmas", Icon: Scale },
  "current events & news": { label: "Current events", Icon: Newspaper },
  "science & innovation": { label: "Science & innovation", Icon: Atom },
  "technology's impact on society": { label: "Technology's impact", Icon: Cpu },
  "arts, literature & media": { label: "Arts & literature", Icon: Drama },
  "economics, work & money": { label: "Economics & work", Icon: TrendingUp },
  "personal identity & belief": { label: "Identity & belief", Icon: Compass },
  "global issues & politics": { label: "Global issues", Icon: Landmark },
  "human nature & psychology": { label: "Human nature", Icon: Brain },
  "education & learning itself": { label: "Education & learning", Icon: GraduationCap },
  "environment & climate": { label: "Environment & climate", Icon: CloudRain }
};

export function domainPresentation(domain: string | null | undefined): DomainPresentation | null {
  if (!domain) return null;
  const trimmed = domain.trim().toLowerCase();
  const direct = DOMAIN_MAP[trimmed];
  if (direct) return direct;
  // Loose-match: try without "& " collapsing to "and" alternates the model
  // sometimes uses (e.g., "science and discovery").
  const normalized = trimmed.replace(/\s+and\s+/g, " & ");
  return DOMAIN_MAP[normalized] ?? { label: domain.trim(), Icon: Leaf };
}
