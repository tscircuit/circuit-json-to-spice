import type { SimulationSpiceSubcircuit } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SubcircuitCallCommand } from "lib/spice-commands"

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

const escapeForRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Rename the top-level `.subckt` in a SPICE source, including its matching
 * `.ends <name>` line.
 */
export function renameSpiceSubckt(params: {
  subcircuitSource: string
  currentModelName: string
  newModelName: string
}): string {
  const { subcircuitSource, currentModelName, newModelName } = params
  const escapedModelName = escapeForRegExp(currentModelName)
  return subcircuitSource
    .replace(
      new RegExp(`^(\\s*\\.subckt\\s+)${escapedModelName}(?=\\s)`, "im"),
      `$1${newModelName}`,
    )
    .replace(
      new RegExp(`^(\\s*\\.ends\\s+)${escapedModelName}(?=\\s|$)`, "gim"),
      `$1${newModelName}`,
    )
}

/**
 * Register a subcircuit model in the netlist and return the model name to
 * call. Identical sources share one definition. A different source that reuses
 * an existing `.subckt` name is renamed (NAME_1, NAME_2, ...) so it does not
 * silently take the earlier definition.
 */
function registerSubcircuitModel(
  netlist: SpiceNetlist,
  params: { modelName: string; subcircuitSource: string },
): string {
  const { modelName, subcircuitSource } = params
  const existingSource = netlist.models.get(modelName)
  if (existingSource === undefined) {
    netlist.models.set(modelName, subcircuitSource)
    return modelName
  }
  if (existingSource === subcircuitSource) return modelName

  for (let suffix = 1; ; suffix++) {
    const uniqueModelName = `${modelName}_${suffix}`
    const renamedSource = renameSpiceSubckt({
      subcircuitSource,
      currentModelName: modelName,
      newModelName: uniqueModelName,
    })
    const existingRenamedSource = netlist.models.get(uniqueModelName)
    if (existingRenamedSource === undefined) {
      netlist.models.set(uniqueModelName, renamedSource)
      return uniqueModelName
    }
    if (existingRenamedSource === renamedSource) return uniqueModelName
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

    const { pinNames } = parsedSubckt
    const modelName = registerSubcircuitModel(netlist, {
      modelName: parsedSubckt.modelName,
      subcircuitSource: simulationSpiceSubcircuit.subcircuit_source,
    })

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
