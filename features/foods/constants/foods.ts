import {
  Apple,
  Bean,
  Beef,
  Droplet,
  Egg,
  Fish,
  Leaf,
  type LucideIcon,
  Soup,
  Utensils,
  Wheat,
} from "lucide-react";

import type { FoodGroup, FoodState } from "@/features/foods/types/food";

export interface FoodGroupInfo {
  label: string;
  icon: LucideIcon;
  // Tailwind classes for the icon tile: tinted background plus icon colour.
  tile: string;
}

export const FOOD_GROUPS: Record<FoodGroup, FoodGroupInfo> = {
  meat: { label: "Thịt", icon: Beef, tile: "bg-rose-500/15 text-rose-600" },
  seafood: {
    label: "Cá & hải sản",
    icon: Fish,
    tile: "bg-sky-500/15 text-sky-600",
  },
  egg_dairy: {
    label: "Trứng & sữa",
    icon: Egg,
    tile: "bg-amber-500/15 text-amber-600",
  },
  starch: {
    label: "Tinh bột",
    icon: Wheat,
    tile: "bg-yellow-500/15 text-yellow-700",
  },
  vegetable: {
    label: "Rau",
    icon: Leaf,
    tile: "bg-green-500/15 text-green-700",
  },
  fruit: {
    label: "Trái cây",
    icon: Apple,
    tile: "bg-orange-500/15 text-orange-600",
  },
  legume_nut: {
    label: "Đậu & hạt",
    icon: Bean,
    tile: "bg-lime-600/15 text-lime-700",
  },
  fat_oil: {
    label: "Dầu & chất béo",
    icon: Droplet,
    tile: "bg-cyan-500/15 text-cyan-700",
  },
  dish: {
    label: "Món chế biến",
    icon: Soup,
    tile: "bg-red-500/15 text-red-600",
  },
  other: {
    label: "Khác",
    icon: Utensils,
    tile: "bg-zinc-500/15 text-zinc-600",
  },
};

// Order of the group chips and of the group select.
export const FOOD_GROUP_ORDER: FoodGroup[] = [
  "meat",
  "seafood",
  "egg_dairy",
  "starch",
  "vegetable",
  "fruit",
  "legume_nut",
  "fat_oil",
  "dish",
  "other",
];

export const FOOD_STATE_LABELS: Record<FoodState, string> = {
  raw: "Sống",
  cooked: "Chín",
};

export const FOOD_LIMITS = {
  NAME_MAX: 80,
  SOURCE_MAX: 120,
  SERVING_LABEL_MAX: 30,
  // Per 100 g of food, a macro can't weigh more than the food itself.
  MAX_GRAMS_PER_100G: 100,
  MAX_KCAL_PER_100G: 900,
  MAX_SERVING_GRAMS: 5000,
  MAX_AMOUNT_GRAMS: 10000,
  // Entered kcal may differ from the 4/4/9 figure by at most this share.
  KCAL_GAP_LIMIT: 0.1,
} as const;

export const FOOD_MESSAGES = {
  INVALID_INPUT: "Vui lòng kiểm tra lại thông tin",
  CREATED: "Đã thêm món",
  UPDATED: "Đã lưu thay đổi",
  DELETED: "Đã xóa món",
  NAME_TAKEN: "Đã có món trùng tên. Thêm trạng thái (sống/chín) để phân biệt.",
  NOT_FOUND: "Món này không còn tồn tại",
  DELETE_CONFIRM: "Xóa món này?",
  CONFIRM_LABEL: "Tôi đã kiểm tra số liệu",
} as const;
