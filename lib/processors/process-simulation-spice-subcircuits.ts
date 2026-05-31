import type { SimulationSpiceSubcircuit } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SubcircuitCallCommand } from "lib/spice-commands"

export function parseSpiceSubckt(
  source: string,
): { modelName: string; pinNames: string[] } | null {
  const line = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^\.subckt\s+/i.test(line))

  if (!line) return null

  const tokens = line.split(/\s+/)
  const modelName = tokens[1]
  const pinNames = tokens.slice(2)

  if (!modelName || pinNames.length === 0) return null
  return { modelName, pinNames }
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
