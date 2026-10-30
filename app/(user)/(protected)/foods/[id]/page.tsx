import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { FoodDetail } from "@/features/foods/components/FoodDetail";
import { getFood } from "@/features/foods/services/food-queries";
import { requireUser } from "@/services/auth-guard";

export const metadata: Metadata = { title: "Chi tiết món" };

const FoodPage = async ({ params }: PageProps<"/foods/[id]">) => {
  await requireUser();

  const { id } = await params;
  const food = await getFood(Number(id));

  if (!food) {
    notFound();
  }

  return (
    <>
      <AppHeader
        eyebrow="Thư viện thực phẩm"
        title={food.name}
        backHref={ROUTES.FOODS}
      />
      <main
        className={`${PAGE_CONTAINER} pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]`}
      >
        <FoodDetail food={food} />
      </main>
    </>
  );
};

export default FoodPage;
