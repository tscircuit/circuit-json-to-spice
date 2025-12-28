import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import {
  VoltageControlledSwitchCommand,
  VoltageSourceCommand,
} from "lib/spice-commands"
import type { AnyCircuitElement, SimulationSwitch } from "circuit-json"
import {
  buildSimulationSwitchControlValue,
  sanitizeIdentifier,
} from "./helpers"

export const processSimpleSwitch = ({
  netlist,
  component,
  nodes,
  simulationSwitchMap,
}: {
  netlist: SpiceNetlist
  component: AnyCircuitElement
  nodes: string[]
  simulationSwitchMap: Map<string, SimulationSwitch>
}): SpiceComponent | null => {
  const sanitizedBase = sanitizeIdentifier(
    (component as any).name ?? (component as any).source_component_id,
    "SW",
  )
  const positiveNode = nodes[0] || "0"
  const negativeNode = nodes[1] || "0"
  const controlNode = `NCTRL_${sanitizedBase}`
  const modelName = `SW_${sanitizedBase}`

  const associatedSimulationSwitch = simulationSwitchMap.get(
    (component as any).source_component_id,
  )

  const controlValue = buildSimulationSwitchControlValue(
    associatedSimulationSwitch,
  )

  const switchCmd = new VoltageControlledSwitchCommand({
    name: sanitizedBase,
    positiveNode,
    negativeNode,
    positiveControl: controlNode,
    negativeControl: "0",
    model: modelName,
  })

  if (!netlist.models.has(modelName)) {
    netlist.models.set(
      modelName,
      `.MODEL ${modelName} SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)`,
    )
  }

  const controlSourceName = `CTRL_${sanitizedBase}`
  const controlSourceCmd = new VoltageSourceCommand({
    name: controlSourceName,
    positiveNode: controlNode,
    negativeNode: "0",
    value: controlValue,
  })

  const controlComponent = new SpiceComponent(
    controlSourceName,
    controlSourceCmd,
    [controlNode, "0"],
  )

  netlist.addComponent(controlComponent)

  return new SpiceComponent(sanitizedBase, switchCmd, [
    positiveNode,
    negativeNode,
    controlNode,
    "0",
  ])
}
