import { useFormatter, useTranslations } from "next-intl";

// Transformă bani (întreg) în text: 135000 -> "1.350 lei"
export function usePrice() {
  const format = useFormatter();
  const t = useTranslations("Common");
  return (bani: number) =>
    t("price", {
      price: format.number(bani / 100, { maximumFractionDigits: 0 }),
    });
}
