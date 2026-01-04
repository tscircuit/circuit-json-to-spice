import type { SimulationOpAmp } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SubcircuitCallCommand } from "lib/spice-commands"

const OPAMP_SUBCIRCUIT_NAME = "GENERIC_OPAMP"
const OPAMP_SUBCIRCUIT_DEFINITION = `
.SUBCKT ${OPAMP_SUBCIRCUIT_NAME} non_inverting_input inverting_input positive_supply negative_supply output
* Generic Op-Amp Model
E1 internal_output 0 non_inverting_input inverting_input 100k
Rin non_inverting_input inverting_input 10Meg
Rout internal_output output 75
D1 output positive_supply opamp_diode
D2 negative_supply output opamp_diode
.model opamp_diode D
.ENDS ${OPAMP_SUBCIRCUIT_NAME}
`.trim()

export const processSimulationOpAmps = (
  netlist: SpiceNetlist,
  simulationOpAmps: SimulationOpAmp[],
  nodeMap: Map<string, string>,
) => {
  if (simulationOpAmps.length === 0) return

  if (!netlist.models.has(OPAMP_SUBCIRCUIT_NAME)) {
    netlist.models.set(OPAMP_SUBCIRCUIT_NAME, OPAMP_SUBCIRCUIT_DEFINITION)
  }

  for (const simOpAmp of simulationOpAmps) {
    if (simOpAmp.type !== "simulation_op_amp") continue

    const nonInvertingInputNode =
      nodeMap.get(simOpAmp.non_inverting_input_source_port_id) ?? "0"
    const invertingInputNode =
      nodeMap.get(simOpAmp.inverting_input_source_port_id) ?? "0"
    const outputNode = nodeMap.get(simOpAmp.output_source_port_id) ?? "0"
    const positiveSupplyNode =
      nodeMap.get(simOpAmp.positive_supply_source_port_id) ?? "0"
    const negativeSupplyNode =
      nodeMap.get(simOpAmp.negative_supply_source_port_id) ?? "0"

    const nodes = [
      nonInvertingInputNode,
      invertingInputNode,
      positiveSupplyNode,
      negativeSupplyNode,
      outputNode,
    ]

    const opAmpCmd = new SubcircuitCallCommand({
      name: simOpAmp.simulation_op_amp_id,
      nodes,
      subcircuitName: OPAMP_SUBCIRCUIT_NAME,
    })

    const spiceComponent = new SpiceComponent(
      simOpAmp.simulation_op_amp_id,
      opAmpCmd,
      nodes,
    )
    netlist.addComponent(spiceComponent)
  }
}
