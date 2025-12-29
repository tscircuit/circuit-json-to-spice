import type { AnyCircuitElement, SimulationVoltageSource } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { VoltageSourceCommand } from "lib/spice-commands"

export const processSimulationVoltageSources = (
  netlist: SpiceNetlist,
  simulationVoltageSources: SimulationVoltageSource[],
  nodeMap: Map<string, string>,
) => {
  for (const simSource of simulationVoltageSources) {
    if (simSource.type !== "simulation_voltage_source") continue

    if (simSource.is_dc_source === false) {
      // AC Source
      if (
        "terminal1_source_port_id" in simSource &&
        "terminal2_source_port_id" in simSource &&
        simSource.terminal1_source_port_id &&
        simSource.terminal2_source_port_id
      ) {
        const positiveNode =
          nodeMap.get(simSource.terminal1_source_port_id) || "0"
        const negativeNode =
          nodeMap.get(simSource.terminal2_source_port_id) || "0"

        let value = ""
        const wave_shape = simSource.wave_shape
        if (wave_shape === "sinewave") {
          const v_offset = 0 // not provided in circuitJson
          const v_peak = simSource.voltage ?? 0
          const freq = simSource.frequency ?? 0
          const delay = 0 // not provided in circuitJson
          const damping_factor = 0 // not provided in circuitJson
          const phase = simSource.phase ?? 0
          if (freq > 0) {
            value = `SIN(${v_offset} ${v_peak} ${freq} ${delay} ${damping_factor} ${phase})`
          } else {
            value = `DC ${simSource.voltage ?? 0}`
          }
        } else if (wave_shape === "square") {
          const v_initial = 0
          const v_pulsed = simSource.voltage ?? 0
          const freq = simSource.frequency ?? 0
          const period_from_freq = freq === 0 ? Infinity : 1 / freq
          const period = period_from_freq
          const duty_cycle = simSource.duty_cycle ?? 0.5
          const pulse_width = period * duty_cycle
          const delay = 0
          const rise_time = "1n"
          const fall_time = "1n"
          value = `PULSE(${v_initial} ${v_pulsed} ${delay} ${rise_time} ${fall_time} ${pulse_width} ${period})`
        } else if (simSource.voltage !== undefined) {
          value = `DC ${simSource.voltage}`
        }

        if (value) {
          const voltageSourceCmd = new VoltageSourceCommand({
            name: simSource.simulation_voltage_source_id,
            positiveNode,
            negativeNode,
            value,
          })

          const spiceComponent = new SpiceComponent(
            simSource.simulation_voltage_source_id,
            voltageSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      // DC Source (is_dc_source is true or undefined)
      const positivePortId = simSource.positive_source_port_id
      const negativePortId = simSource.negative_source_port_id

      if (
        positivePortId &&
        negativePortId &&
        "voltage" in simSource &&
        simSource.voltage !== undefined
      ) {
        const positiveNode = nodeMap.get(positivePortId) || "0"
        const negativeNode = nodeMap.get(negativePortId) || "0"

        const voltageSourceCmd = new VoltageSourceCommand({
          name: simSource.simulation_voltage_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${(simSource as any).voltage}`,
        })

        const spiceComponent = new SpiceComponent(
          simSource.simulation_voltage_source_id,
          voltageSourceCmd,
          [positiveNode, negativeNode],
        )
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
