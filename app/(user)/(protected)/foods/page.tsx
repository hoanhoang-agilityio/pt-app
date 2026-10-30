import type { Metadata } from "next";

import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { FoodList } from "@/features/foods/components/FoodList";
import { listFoods } from "@/features/foods/services/food-queries";
import { requireUser } from "@/services/auth-guard";

export const metadata: Metadata = { title: "Thực phẩm" };

const FoodsPage = async () => {
  await requireUser();

  const foods = await listFoods();

  return (
    <>
      <AppHeader
        eyebrow="Dinh dưỡng"
        title="Thư viện thực phẩm"
        backHref={ROUTES.NUTRITION}
      />
      <main
        className={`${PAGE_CONTAINER} space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]`}
      >
        <FoodList
          foods={foods}
          basePath={ROUTES.FOODS}
          emptyHint="PT chưa thêm món nào vào thư viện."
        />
      </main>
    </>
  );
};

export default FoodsPage;
