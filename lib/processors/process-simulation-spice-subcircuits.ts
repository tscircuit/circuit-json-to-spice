import type { SimulationSpiceSubcircuit } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SubcircuitCallCommand } from "lib/spice-commands"
import { CircuitJsonToSpiceError } from "lib/errors"

export function parseSpiceSubckt(
  source: string,
): { modelName: string; pinNames: string[] } | null {
  const logicalLines: string[] = []

  for (const physicalLine of source.split(/\r?\n/)) {
    const trimmedLine = physicalLine.trim()

    if (/^\+/.test(trimmedLine) && logicalLines.length > 0) {
      logicalLines[logicalLines.length - 1] += ` ${trimmedLine.slice(1).trim()}`
      continue
    }

    logicalLines.push(trimmedLine)
  }

  const line = logicalLines.find((line) => /^\.subckt\s+/i.test(line))

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

    if (!parsedSubckt) {
      throw new CircuitJsonToSpiceError(
        "invalid_netlist",
        `Invalid SPICE subcircuit for ${simulationSpiceSubcircuit.source_component_id}`,
        "Expected a .SUBCKT declaration with at least one pin",
      )
    }

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
