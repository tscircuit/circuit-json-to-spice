import { expect, test } from "bun:test"
import type { SimulationSwitch } from "circuit-json"
import { Simulation } from "eecircuit-engine"
import { processSimpleSwitch } from "lib/processors/simple-switch"
import { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"

const cases: Array<{
  name: string
  timing: Partial<SimulationSwitch>
  samples: Array<[number, number]>
}> = [
  {
    name: "simultaneous close and open has no closed interval",
    timing: { starts_closed: true, closes_at: 1, opens_at: 1 },
    samples: [
      [0.5, 5],
      [1.5, 0],
      [8.5, 0],
    ],
  },
  {
    name: "close once and remain closed",
    timing: { closes_at: 1 },
    samples: [
      [0.5, 0],
      [1.5, 5],
      [2.5, 5],
      [8.5, 5],
    ],
  },
  {
    name: "open once from an initially closed state",
    timing: { starts_closed: true, opens_at: 1 },
    samples: [
      [0.5, 5],
      [1.5, 0],
      [8.5, 0],
    ],
  },
  {
    name: "close then open without repeating",
    timing: { closes_at: 1, opens_at: 2 },
    samples: [
      [0.5, 0],
      [1.5, 5],
      [2.5, 0],
      [4.5, 0],
      [8.5, 0],
    ],
  },
  {
    name: "open then close in chronological order",
    timing: { starts_closed: true, opens_at: 1, closes_at: 2 },
    samples: [
      [0.5, 5],
      [1.5, 0],
      [2.5, 5],
      [8.5, 5],
    ],
  },
  {
    name: "honor an explicit close at zero",
    timing: { closes_at: 0 },
    samples: [
      [0.5, 5],
      [8.5, 5],
    ],
  },
  {
    name: "convert periodic delay and width from milliseconds",
    timing: { switching_frequency: 1000, closes_at: 1, opens_at: 1.25 },
    samples: [
      [0.5, 0],
      [1.1, 5],
      [1.4, 0],
      [2.1, 5],
    ],
  },
  {
    name: "keep an unscheduled switch initially closed",
    timing: { starts_closed: true },
    samples: [
      [0.5, 5],
      [8.5, 5],
    ],
  },
]

test("simulation switch honors scheduled events and remains in its final state", async () => {
  const sim = new Simulation()
  await sim.start()
  for (const { name, timing, samples } of cases) {
    const netlist = new SpiceNetlist(name)
    const component = processSimpleSwitch({
      netlist,
      component: {
        type: "source_component",
        source_component_id: "sw",
        ftype: "simple_switch",
        name: "SW1",
      },
      nodes: ["in", "out"],
      simulationSwitchMap: new Map([
        [
          "sw",
          {
            type: "simulation_switch",
            simulation_switch_id: "timing",
            ...timing,
          },
        ],
      ]),
    })
    if (!component) throw new Error("Missing switch")
    netlist.addComponent(component)
    const spice = netlist
      .toSpiceString()
      .replace(
        /\.END\s*$/,
        "Vinput in 0 5\nRload out 0 1000\n.tran 10u 9m\n.END",
      )
    sim.setNetList(spice)
    const result = await sim.runSim()
    const times = result.data.find((entry) => entry.name === "time")
      ?.values as number[]
    const voltages = result.data.find(
      (entry) => entry.name.toLowerCase() === "v(out)",
    )?.values as number[]
    expect(times, name).toBeDefined()
    expect(voltages, name).toBeDefined()
    for (const [milliseconds, expected] of samples) {
      const target = milliseconds / 1000
      const index = times.reduce(
        (best, time, i) =>
          Math.abs(time - target) < Math.abs(times[best] - target) ? i : best,
        0,
      )
      expect(voltages[index], `${name} at ${milliseconds} ms`).toBeCloseTo(
        expected,
        2,
      )
    }
  }
})
