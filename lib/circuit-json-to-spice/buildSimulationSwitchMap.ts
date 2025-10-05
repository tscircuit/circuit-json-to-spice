import type { AnyCircuitElement } from "circuit-json"
import type { SimulationSwitchLike } from "./types"

export function buildSimulationSwitchMap(
  circuitJson: AnyCircuitElement[],
): Map<string, SimulationSwitchLike> {
  const simulationSwitches = circuitJson
    .filter(
      (element) => (element as { type?: string }).type === "simulation_switch",
    )
    .map((element) => element as unknown as SimulationSwitchLike)

  const simulationSwitchMap = new Map<string, SimulationSwitchLike>()

  for (const simSwitch of simulationSwitches) {
    simulationSwitchMap.set(simSwitch.simulation_switch_id, simSwitch)
  }

  return simulationSwitchMap
}
