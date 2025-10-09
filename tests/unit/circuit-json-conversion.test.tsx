import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { sel } from "tscircuit"

test("empty circuit JSON", () => {
  const circuitJson: AnyCircuitElement[] = []
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(0)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .END"
  `)
})

test("single resistor circuit", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <trace from="net.GND" to={sel.R1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(1)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    .END"
  `)
})

test("RC circuit with trace", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <capacitor name="C1" capacitance="1uF" />
      <trace from={sel.R1.pin2} to={sel.C1.pin1} />
      <trace from="net.GND1" to={sel.R1.pin1} />
      <trace from="net.GND2" to={sel.C1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 N1 1K
    CC1 N1 0 1U
    .END"
  `)
})

test("circuit with simulation voltage source", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <chip
        name="U1"
        footprint="soic8"
        pinLabels={{
          pin2: "GND",
          pin3: "VOUT",
        }}
        pinAttributes={{
          VOUT: { providesPower: true, providesVoltage: 5 },
          GND: { providesGround: true },
        }}
      />
      <trace from={"net.VCC"} to={sel<"VOUT">("U1").VOUT} />
      <trace from={"net.GND"} to={sel<"GND">("U1").GND} />
      <trace from={"net.VCC"} to={sel.R1.pin1} />
      <trace from={"net.GND"} to={sel.R1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})

test("simple switch uses simulation switch control", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "RLOAD",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as AnyCircuitElement,
    {
      type: "source_component",
      source_component_id: "SW1",
      name: "SW1",
      ftype: "simple_switch",
      simulation_switch_id: "switch_SW1",
    } as AnyCircuitElement,
    {
      type: "source_net",
      source_net_id: "net_gnd",
      name: "GND",
      member_source_group_ids: [],
    } as AnyCircuitElement,
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
      type: "source_port",
      source_port_id: "RLOAD_pin1",
      source_component_id: "RLOAD",
      name: "pin1",
      pin_number: 1,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "RLOAD_pin2",
      source_component_id: "RLOAD",
      name: "pin2",
      pin_number: 2,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "SW1_pin1",
      source_component_id: "SW1",
      name: "pin1",
      pin_number: 1,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "SW1_pin2",
      source_component_id: "SW1",
      name: "pin2",
      pin_number: 2,
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_vout",
      connected_source_port_ids: ["RLOAD_pin1", "SW1_pin2"],
      connected_source_net_ids: ["net_vout"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_gnd",
      connected_source_port_ids: ["RLOAD_pin2"],
      connected_source_net_ids: ["net_gnd"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_vin",
      connected_source_port_ids: ["SW1_pin1"],
      connected_source_net_ids: ["net_vin"],
    } as AnyCircuitElement,
    {
      type: "simulation_switch",
      simulation_switch_id: "switch_SW1",
      switching_frequency: 1000,
      starts_closed: false,
    } as unknown as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .MODEL SW_SW1 SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)
    RR1 N1 0 1K
    VCTRL_SW1 NCTRL_SW1 0 PULSE(0 5 0 1n 1n 0.0005 0.001)
    SSW1 N2 N1 NCTRL_SW1 0 SW_SW1
    .END"
  `)
})
