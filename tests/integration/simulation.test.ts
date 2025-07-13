import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import { spawnSync } from "node:child_process"

// Helper to run node script with given netlist
function runNodeSimulation(spice: string) {
  const script = `import { Simulation } from 'eecircuit-engine';\n(async () => {\n  const sim = new Simulation();\n  await sim.start();\n  sim.setNetList(\`${spice.replace(/`/g, "\\`")}\`);\n  const res = await sim.runSim();\n  console.log(JSON.stringify(res));\n})();`
  const result = spawnSync("node", ["-e", script], { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(result.stderr)
  }
  return JSON.parse(result.stdout.trim())
}

test("simulate simple resistor divider", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as any,
    {
      type: "source_component",
      source_component_id: "R2",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 1000,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      source_component_id: "R1",
      name: "pin1",
      pin_number: 1,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      source_component_id: "R1",
      name: "pin2",
      pin_number: 2,
    } as any,
    {
      type: "source_port",
      source_port_id: "R2_pin1",
      source_component_id: "R2",
      name: "pin1",
      pin_number: 1,
    } as any,
    {
      type: "source_port",
      source_port_id: "R2_pin2",
      source_component_id: "R2",
      name: "pin2",
      pin_number: 2,
    } as any,
    {
      type: "source_trace",
      source_trace_id: "t1",
      connected_source_port_ids: ["R1_pin2", "R2_pin1"],
      connected_source_net_ids: [],
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const lines = netlist.toSpiceString().split("\n")
  lines.pop() // remove .END
  lines.push("V1 N2 0 5")
  lines.push(".op")
  lines.push(".END")
  const spice = lines.join("\n")

  const result = runNodeSimulation(spice)
  expect(result.numVariables).toBeGreaterThan(0)
  expect(result.variableNames).toContain("v(n1)")
})
