import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

const convert = (sourceIds: string[], probeIds: string[]) => {
  const elements: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    ...["supply", "load", "return"].map((name, index) => ({
      type: "source_port" as const,
      source_port_id: name,
      source_component_id: name === "supply" ? undefined : "R1",
      name,
      pin_number: index,
    })),
    {
      type: "simulation_experiment",
      simulation_experiment_id: "op",
      name: "test",
      experiment_type: "spice_dc_operating_point",
    },
    ...sourceIds.map((id) => ({
      type: "simulation_voltage_source" as const,
      simulation_voltage_source_id: id,
      is_dc_source: true as const,
      voltage: 5,
      positive_source_port_id: "supply",
      negative_source_port_id: "return",
    })),
    ...probeIds.map((id) => ({
      type: "simulation_current_probe" as const,
      simulation_current_probe_id: id,
      positive_source_port_id: "supply",
      negative_source_port_id: "load",
    })),
  ]
  return circuitJsonToSpice(elements).toSpiceString()
}

const cases = [
  {
    name: "existing voltage source",
    sources: ["sense_cp"],
    probes: ["cp"],
    expected: ["sense_cp_2"],
  },
  {
    name: "case-insensitive existing source and suffix",
    sources: ["SENSE_CP", "sense_cp_2"],
    probes: ["cp"],
    expected: ["sense_cp_3"],
  },
  {
    name: "case-insensitive probe IDs",
    sources: [],
    probes: ["cp", "CP"],
    expected: ["sense_cp", "sense_CP_2"],
  },
  {
    name: "sanitized probe IDs",
    sources: [],
    probes: ["cp-a", "cp_a"],
    expected: ["sense_cp_a", "sense_cp_a_2"],
  },
]

for (const { name, sources, probes, expected } of cases) {
  test(`current probe names do not collide with ${name}`, () => {
    const output = convert(sources, probes)
    const voltageLines = output.split("\n").filter((line) => /^V/i.test(line))
    const names = voltageLines.map((line) => line.split(/\s+/)[0].toLowerCase())
    expect(new Set(names).size).toBe(sources.length + probes.length)
    for (const source of sources) {
      expect(
        voltageLines.some(
          (line) => line.startsWith(`V${source} `) && line.endsWith("DC 5"),
        ),
      ).toBe(true)
    }
    for (const sense of expected) {
      expect(
        voltageLines.some(
          (line) => line.startsWith(`V${sense} `) && line.endsWith("DC 0"),
        ),
      ).toBe(true)
      expect(output).toContain(`I(V${sense})`)
      expect(output).toContain(`"sense_voltage_source_name":"V${sense}"`)
    }
    expect(output).toContain(
      `.PRINT OP ${expected.map((sense) => `I(V${sense})`).join(" ")}`,
    )
    expect(output).toContain(
      `.SAVE ${expected.map((sense) => `I(V${sense})`).join(" ")}`,
    )
  })
}
