import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import type { AnyCircuitElement } from "circuit-json"
import { su } from "@tscircuit/soup-util"
import { addSourceComponentsToNetlist } from "./circuit-json-to-spice/addSourceComponentsToNetlist"
import { addSimulationVoltageSourcesToNetlist } from "./circuit-json-to-spice/addSimulationVoltageSourcesToNetlist"
import { buildNodeMap } from "./circuit-json-to-spice/buildNodeMap"
import { buildSimulationSwitchMap } from "./circuit-json-to-spice/buildSimulationSwitchMap"

export function circuitJsonToSpice(
  circuitJson: AnyCircuitElement[],
): SpiceNetlist {
  const netlist = new SpiceNetlist("* Circuit JSON to SPICE Netlist")
  const sourceComponents = su(circuitJson).source_component.list()
  const sourcePorts = su(circuitJson).source_port.list()
  const simulationSwitchMap = buildSimulationSwitchMap(circuitJson)

  const nodeMap = buildNodeMap(circuitJson, sourcePorts)

  addSourceComponentsToNetlist({
    circuitJson,
    nodeMap,
    netlist,
    simulationSwitchMap,
    sourceComponents,
  })

  addSimulationVoltageSourcesToNetlist({
    circuitJson,
    netlist,
    nodeMap,
  })

  return netlist
}
