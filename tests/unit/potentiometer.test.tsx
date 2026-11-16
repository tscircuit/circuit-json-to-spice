import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { RootCircuit } from "tscircuit"

const buildThreePinPotCircuit = (
  extraPotFields: Record<string, unknown> = {},
  extraElements: AnyCircuitElement[] = [],
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "RV1",
    name: "RV1",
    ftype: "simple_potentiometer",
    max_resistance: 10000,
    pin_variant: "three_pin",
    ...extraPotFields,
  } as unknown as AnyCircuitElement,
  {
    type: "source_net",
    source_net_id: "net_vin",
    name: "VIN",
    member_source_group_ids: [],
  } as AnyCircuitElement,
  {
    type: "source_net",
    source_net_id: "net_vout",
    name: "VOUT",
    member_source_group_ids: [],
  } as AnyCircuitElement,
  {
    type: "source_net",
    source_net_id: "net_gnd",
    name: "GND",
    member_source_group_ids: [],
  } as AnyCircuitElement,
  // Intentionally match core's [pin1, pin3, pin2] port creation order
  {
    type: "source_port",
    source_port_id: "RV1_pin1",
    source_component_id: "RV1",
    name: "pin1",
    pin_number: 1,
    port_hints: ["pin1", "1"],
  } as AnyCircuitElement,
  {
    type: "source_port",
    source_port_id: "RV1_pin3",
    source_component_id: "RV1",
    name: "pin3",
    pin_number: 3,
    port_hints: ["pin3", "3"],
  } as AnyCircuitElement,
  {
    type: "source_port",
    source_port_id: "RV1_pin2",
    source_component_id: "RV1",
    name: "pin2",
    pin_number: 2,
    port_hints: ["pin2", "2"],
  } as AnyCircuitElement,
  {
    type: "source_trace",
    source_trace_id: "trace_vin",
    connected_source_port_ids: ["RV1_pin1"],
    connected_source_net_ids: ["net_vin"],
  } as AnyCircuitElement,
  {
    type: "source_trace",
    source_trace_id: "trace_vout",
    connected_source_port_ids: ["RV1_pin2"],
    connected_source_net_ids: ["net_vout"],
  } as AnyCircuitElement,
  {
    type: "source_trace",
    source_trace_id: "trace_gnd",
    connected_source_port_ids: ["RV1_pin3"],
    connected_source_net_ids: ["net_gnd"],
  } as AnyCircuitElement,
  ...extraElements,
]

test("three-pin potentiometer emits a midpoint two-resistor divider by default", () => {
  const netlist = circuitJsonToSpice(buildThreePinPotCircuit())

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toBe(
    [
      "* Circuit JSON to SPICE Netlist",
      "RRV1_1 N1 N2 5K",
      "RRV1_2 N2 0 5K",
      ".END",
    ].join("\n"),
  )
})

test("three-pin potentiometer respects sim_wiper_position and clamps 0/1 endpoints", () => {
  const pos70 = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 0.7 }),
  ).toSpiceString()
  expect(pos70).toContain("RRV1_1 N1 N2 7K")
  expect(pos70).toContain("RRV1_2 N2 0 3K")

  const posZero = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 0 }),
  ).toSpiceString()
  expect(posZero).toContain("RRV1_1 N1 N2 1e-12")
  expect(posZero).toContain("RRV1_2 N2 0 10K")

  const posOne = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 1 }),
  ).toSpiceString()
  expect(posOne).toContain("RRV1_1 N1 N2 10K")
  expect(posOne).toContain("RRV1_2 N2 0 1e-12")
})

test("three-pin potentiometer supports log and antilog tapers and simulation_potentiometer overrides", () => {
  const logMid = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 0.5, taper: "log" }),
  ).toSpiceString()
  expect(logMid).toContain("RRV1_1 N1 N2 1K")
  expect(logMid).toContain("RRV1_2 N2 0 9K")

  const antilogMid = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 0.5, taper: "antilog" }),
  ).toSpiceString()
  expect(antilogMid).toContain("RRV1_1 N1 N2 9K")
  expect(antilogMid).toContain("RRV1_2 N2 0 1K")

  const simOverride = circuitJsonToSpice(
    buildThreePinPotCircuit({ sim_wiper_position: 0.5, taper: "linear" }, [
      {
        type: "simulation_potentiometer",
        source_component_id: "RV1",
        wiper_position: 0.25,
        taper: "linear",
      } as unknown as AnyCircuitElement,
    ]),
  ).toSpiceString()
  expect(simOverride).toContain("RRV1_1 N1 N2 2.5K")
  expect(simOverride).toContain("RRV1_2 N2 0 7.5K")
})

test("two-pin potentiometer emits a single variable resistor and avoids resistor name collisions", async () => {
  const circuit = new RootCircuit()
  circuit.add(
    <board width="20mm" height="20mm" routingDisabled>
      <potentiometer name="RV2" maxResistance="10k" pinVariant="two_pin" />
      <resistor name="RV1_1" resistance="1k" />
      <potentiometer name="RV1" maxResistance="10k" pinVariant="three_pin" />
      <trace from=".RV2 > .pin1" to="net.VIN" />
      <trace from=".RV2 > .pin2" to="net.GND" />
      <trace from=".RV1 > .pin1" to="net.VIN" />
      <trace from=".RV1 > .pin2" to="net.VOUT" />
      <trace from=".RV1 > .pin3" to="net.GND" />
      <trace from=".RV1_1 > .pin1" to="net.VOUT" />
      <trace from=".RV1_1 > .pin2" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const spice = circuitJsonToSpice(circuit.getCircuitJson()).toSpiceString()
  expect(spice).toContain("RRV2 ")
  expect(spice).toContain(" 5K")
  expect(spice).toContain("RRV1_1 ")
  expect(spice).toContain("RRV1_1_2 ")
  expect(spice).toContain("RRV1_2 ")
})
