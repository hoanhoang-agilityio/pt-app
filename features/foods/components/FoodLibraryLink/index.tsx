import { ChevronRight, Salad } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { CARD } from "@/constants/styles";

// Entry point to the food library from the nutrition page.
export const FoodLibraryLink = () => (
  <Link
    href={ROUTES.FOODS}
    className={`${CARD} flex items-center gap-3 p-4 active:bg-line/50`}
  >
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
      <Salad className="size-6" aria-hidden />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-fg">Thư viện thực phẩm</span>
      <span className="block text-sm text-muted">
        Xem calo, protein, carb, fat của từng món
      </span>
    </span>
    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
  </Link>
);
