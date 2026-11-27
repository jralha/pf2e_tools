import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Dices, Flame, Radar, Target, type LucideIcon } from "lucide-react";

export type ToolCategory =
  | "Combat & Grid"
  | "Character"
  | "GM Utilities"
  | "Dice & Math";

export interface ToolDefinition {
  id: string;
  name: string;
  shortDescription: string;
  category: ToolCategory;
  path: string;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
  tags?: string[];
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: "aoe",
    name: "AoE Calculator",
    shortDescription:
      "Visualize 5-foot grid Emanations, Bursts, and Cones with enemy token placement, max elevation overlay, and PF2e alternating-diagonal distance.",
    category: "Combat & Grid",
    path: "/tools/aoe",
    icon: Radar,
    component: lazy(() => import("./aoe/AoETool")),
    tags: ["Emanation", "Burst", "Cone"],
  },
  {
    id: "airburst",
    name: "Airburst Calculator",
    shortDescription:
      "Detonate a burst in mid-air to calculate its shrunken ground-level footprint, with side-view cross-section and top-down ground plots.",
    category: "Combat & Grid",
    path: "/tools/airburst",
    icon: Target,
    component: lazy(() => import("./airburst/AirburstTool")),
    tags: ["3D", "Burst", "Elevation"],
  },
  {
    id: "dragon-breath",
    name: "Dragon Breath Calculator",
    shortDescription:
      "Aim a flying dragon's breath cone straight down to find the effective ground burst footprint, with side-view and top-down plots.",
    category: "Combat & Grid",
    path: "/tools/dragon-breath",
    icon: Flame,
    component: lazy(() => import("./dragon-breath/DragonBreathTool")),
    tags: ["3D", "Cone", "Flying"],
  },
  {
    id: "damage",
    name: "Damage Calculator",
    shortDescription:
      "Exact dice histograms and PF2e expected damage for Attacks and Basic Saves, with raw % input, Deadly/Fatal crits, and weakness/resistance.",
    category: "Dice & Math",
    path: "/tools/damage",
    icon: Dices,
    component: lazy(() => import("./damage/DamageTool")),
    tags: ["DPR", "Histogram", "Crits"],
  },
  // TODO: Create a dedicated Line Calculator tool (supporting PF2e arbitrary-angle / grid line rules).
];
