import type { Preset, SalesResult, DateFilter } from "./types";
import { getSalesAnymarket } from "./anymarket";
import { getSalesPluggto } from "./pluggto";
import { getSalesTray } from "./tray";
import { getSalesWake } from "./wake";

export async function getSales(
  preset: Preset,
  filter: DateFilter
): Promise<SalesResult> {
  switch (preset.tipo) {
    case "anymarket":
      return getSalesAnymarket(preset, filter);

    case "pluggto":
      return getSalesPluggto(preset, filter);

    case "tray":
      return getSalesTray(preset, filter);

    case "wake":
      return getSalesWake(preset, filter);

    default:
      throw new Error("Tipo de preset não suportado");
  }
}