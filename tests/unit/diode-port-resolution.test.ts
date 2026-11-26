import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const buildDiodeCircuit = ({
  ftype,
  ports,
}: {
  ftype: "simple_diode" | "simple_led"
  ports: Array<{
    source_port_id: string
    name: string
    pin_number: number
    port_hints?: string[]
  }>
}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "comp_d1",
    name: "D1",
    ftype,
  } as any,
  ...(ports.map((port) => ({
    type: "source_port",
    source_component_id: "comp_d1",
    ...port,
  })) as any),
  {
    type: "source_component",
    source_component_id: "comp_r1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  } as any,
  {
    type: "source_port",
    source_port_id: "r1_p1",
    source_component_id: "comp_r1",
    name: "pin1",
    pin_number: 1,
  } as any,
  {
    type: "source_port",
    source_port_id: "r1_p2",
    source_component_id: "comp_r1",
    name: "pin2",
    pin_number: 2,
  } as any,
  {
    type: "source_net",
    source_net_id: "net_gnd",
    name: "GND",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "trace_in",
    connected_source_port_ids: ["r1_p1", ports[0]!.source_port_id],
    connected_source_net_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "trace_out",
    connected_source_port_ids: [ports[1]!.source_port_id, "r1_p2"],
    connected_source_net_ids: ["net_gnd"],
  },
  {
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "v1",
    is_dc_source: true,
    positive_source_port_id: "r1_p1",
    negative_source_port_id: "r1_p2",
    voltage: 5,
  },
]

test("simple_diode resolves pos and neg port names instead of shorting to ground", () => {
  const spice = circuitJsonToSpice(
    buildDiodeCircuit({
      ftype: "simple_diode",
      ports: [
        { source_port_id: "d1_p1", name: "pos", pin_number: 1 },
        { source_port_id: "d1_p2", name: "neg", pin_number: 2 },
      ],
    }),
  ).toSpiceString()

  expect(spice).toContain("DD1 N1 0 D")
  expect(spice).not.toContain("DD1 0 0 D")
})

test("simple_led resolves case-insensitive port_hints and pin aliases", () => {
  const spice = circuitJsonToSpice(
    buildDiodeCircuit({
      ftype: "simple_led",
      ports: [
        {
          source_port_id: "d1_p1",
          name: "pin1",
          pin_number: 1,
          port_hints: ["ANODE"],
        },
        {
          source_port_id: "d1_p2",
          name: "pin2",
          pin_number: 2,
          port_hints: ["CATHODE"],
        },
      ],
    }),
  ).toSpiceString()

  expect(spice).toContain("DD1 N1 0 LED")
})

test("simple_diode falls back to pin-ordered ports when semantic names are absent", () => {
  const spice = circuitJsonToSpice(
    buildDiodeCircuit({
      ftype: "simple_diode",
      ports: [
        { source_port_id: "d1_p1", name: "pin1", pin_number: 1 },
        { source_port_id: "d1_p2", name: "pin2", pin_number: 2 },
      ],
    }),
  ).toSpiceString()

  expect(spice).toContain("DD1 N1 0 D")
})

test("semantic anode/cathode port names take precedence over pin order", () => {
  const spice = circuitJsonToSpice(
    buildDiodeCircuit({
      ftype: "simple_diode",
      ports: [
        { source_port_id: "d1_p1", name: "cathode", pin_number: 1 },
        { source_port_id: "d1_p2", name: "anode", pin_number: 2 },
      ],
    }),
  ).toSpiceString()

  expect(spice).toContain("DD1 0 N1 D")
})
