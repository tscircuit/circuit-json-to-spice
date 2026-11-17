import type { SimulationSpiceSubcircuit } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SubcircuitCallCommand } from "lib/spice-commands"
import { parseSpiceNetlist } from "spicets"

export function parseSpiceSubckt(
  source: string,
): { modelName: string; pinNames: string[] } | null {
  const subckt = parseSpiceNetlist(source).subckts[0]
  if (!subckt || subckt.pins.length === 0) return null
  return {
    modelName: subckt.name,
    pinNames: subckt.pins.map((pin) => pin.name),
  }
}

export function processSimulationSpiceSubcircuits(
  netlist: SpiceNetlist,
  simulationSpiceSubcircuits: SimulationSpiceSubcircuit[],
  nodeMap: Map<string, string>,
) {
  if (simulationSpiceSubcircuits.length === 0) return

  for (const simulationSpiceSubcircuit of simulationSpiceSubcircuits) {
    const parsedSubckt = parseSpiceSubckt(
      simulationSpiceSubcircuit.subcircuit_source,
    )

    if (!parsedSubckt) continue

    const { modelName, pinNames } = parsedSubckt

    if (!netlist.models.has(modelName)) {
      netlist.models.set(modelName, simulationSpiceSubcircuit.subcircuit_source)
    }

    const nodes = pinNames.map((spicePinName) => {
      const sourcePortId =
        simulationSpiceSubcircuit.spice_pin_to_source_port_map[spicePinName]
      return nodeMap.get(sourcePortId) ?? "0"
    })

    const subcircuitCallCommand = new SubcircuitCallCommand({
      name: simulationSpiceSubcircuit.simulation_spice_subcircuit_id,
      nodes,
      subcircuitName: modelName,
    })

    netlist.addComponent(
      new SpiceComponent(
        simulationSpiceSubcircuit.simulation_spice_subcircuit_id,
        subcircuitCallCommand,
        nodes,
      ),
    )
  }
}
