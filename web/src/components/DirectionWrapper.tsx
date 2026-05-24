import React from "react";
import { useTranslation } from "react-i18next";
import { Direction } from "radix-ui";

export default function DirectionWrapper({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <Direction.Provider dir={i18n.dir() as "ltr" | "rtl"}>
      {children}
    </Direction.Provider>
  );
}
