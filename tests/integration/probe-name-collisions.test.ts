import { expect, test } from "bun:test"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { getTwoDividerCircuit } from "tests/fixtures/two-divider-circuit"

test.each([
  ["VOUT", "VOUT"],
  ["VOUT", "vout"],
  ["gnd", "OUT_B"],
  ["0", "OUT_B"],
  ["OUT_A", "OUT_B"],
  ["Output A", "OUT_B"],
  ["OUT,A", "OUT_B"],
  ["V(out)", "OUT_B"],
  ["Output A", "Output_A"],
  ["Output A", "output_a"],
  ["0", "probe 0"],
  ["输出", "OUT_B"],
])(
  "divider voltages remain correct with probe names %s and %s",
  async (first, second) => {
    const netlist = circuitJsonToSpice(getTwoDividerCircuit([first, second]))
    const probeNodes: string[] = netlist.metadataComments.map((comment) => {
      const mapping: { source_node_name: string } = JSON.parse(
        comment.slice("* tscircuit_probe ".length),
      )
      return mapping.source_node_name.toLowerCase()
    })
    expect(probeNodes).toHaveLength(2)

    const simulation = new Simulation()
    await simulation.start()
    simulation.setNetList(netlist.toSpiceString())
    const result = await simulation.runSim()
    for (const [index, expectedVoltage] of [2, 3].entries()) {
      const voltage = result.data.find(
        (entry) => entry.name === `v(${probeNodes[index]})`,
      )
      expect(voltage?.values[0]).toBeCloseTo(expectedVoltage)
    }
  },
)
