import type { AnyCircuitElement } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { CurrentSourceCommand } from "lib/spice-commands"

export const processSimulationCurrentSources = (
  netlist: SpiceNetlist,
  simulationCurrentSources: AnyCircuitElement[],
  nodeMap: Map<string, string>,
) => {
  for (const simSource of simulationCurrentSources) {
    if (simSource.type !== "simulation_current_source") continue

    if ((simSource as any).is_dc_source === false) {
      // AC/PULSE Source
      const positivePortId = (simSource as any).terminal1_source_port_id
      const negativePortId = (simSource as any).terminal2_source_port_id

      if (positivePortId && negativePortId) {
        const positiveNode = nodeMap.get(positivePortId) || "0"
        const negativeNode = nodeMap.get(negativePortId) || "0"

        let value = ""
        const wave_shape = (simSource as any).wave_shape
        if (wave_shape === "sinewave") {
          const i_offset = 0 // not provided
          const i_peak = ((simSource as any).peak_to_peak_current ?? 0) / 2
          const freq = (simSource as any).frequency ?? 0
          const delay = 0
          const damping_factor = 0
          const phase = (simSource as any).phase ?? 0
          if (freq > 0) {
            value = `SIN(${i_offset} ${i_peak} ${freq} ${delay} ${damping_factor} ${phase})`
          } else {
            value = `DC ${i_peak}`
          }
        } else if (wave_shape === "square") {
          const i_initial = 0
          const i_pulsed = (simSource as any).peak_to_peak_current ?? 0
          const freq = (simSource as any).frequency ?? 0
          const period_from_freq = freq === 0 ? Infinity : 1 / freq
          const period = (simSource as any).period ?? period_from_freq
          const duty_cycle = (simSource as any).duty_cycle ?? 0.5
          const pulse_width = period * duty_cycle
          const delay = 0
          const rise_time = "1n"
          const fall_time = "1n"
          value = `PULSE(${i_initial} ${i_pulsed} ${delay} ${rise_time} ${fall_time} ${pulse_width} ${period})`
        }

        if (value) {
          const currentSourceCmd = new CurrentSourceCommand({
            name: (simSource as any).simulation_current_source_id,
            positiveNode,
            negativeNode,
            value,
          })

          const spiceComponent = new SpiceComponent(
            (simSource as any).simulation_current_source_id,
            currentSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      // DC Source
      const positivePortId = (simSource as any).positive_source_port_id
      const negativePortId = (simSource as any).negative_source_port_id

      if (
        positivePortId &&
        negativePortId &&
        "current" in simSource &&
        (simSource as any).current !== undefined
      ) {
        const positiveNode = nodeMap.get(positivePortId) || "0"
        const negativeNode = nodeMap.get(negativePortId) || "0"

        const currentSourceCmd = new CurrentSourceCommand({
          name: (simSource as any).simulation_current_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${(simSource as any).current}`,
        })

        const spiceComponent = new SpiceComponent(
          (simSource as any).simulation_current_source_id,
          currentSourceCmd,
          [positiveNode, negativeNode],
        )
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
