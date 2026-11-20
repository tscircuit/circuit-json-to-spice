import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const createRotarySwitchPorts = ({
  componentId,
  poles,
  positions,
  includeMountPin = false,
}: {
  componentId: string
  poles: number
  positions: number
  includeMountPin?: boolean
}): AnyCircuitElement[] => {
  const ports: AnyCircuitElement[] = []

  for (let pole = 1; pole <= poles; pole++) {
    for (let pos = 1; pos <= positions; pos++) {
      const pinNumber = (pole - 1) * positions + pos
      ports.push({
        type: "source_port",
        source_port_id: `${componentId}_pin${pinNumber}`,
        source_component_id: componentId,
        name: poles === 1 ? `pos${pos}` : `p${pole}_pos${pos}`,
        pin_number: pinNumber,
      } as AnyCircuitElement)
    }
  }

  for (let pole = 1; pole <= poles; pole++) {
    const pinNumber = poles * positions + pole
    ports.push({
      type: "source_port",
      source_port_id: `${componentId}_pin${pinNumber}`,
      source_component_id: componentId,
      name: poles === 1 ? "common" : `common${pole}`,
      pin_number: pinNumber,
    } as AnyCircuitElement)
  }

  if (includeMountPin) {
    ports.push({
      type: "source_port",
      source_port_id: `${componentId}_MP`,
      source_component_id: componentId,
      name: "MP",
      port_hints: ["MP"],
    } as AnyCircuitElement)
  }

  return ports
}

test("1x3 rotary switch defaults to position 1 and ignores mechanical MP port", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "SW1",
      name: "SW1",
      ftype: "simple_rotary_switch",
      poles: 1,
      positions: 3,
    } as unknown as AnyCircuitElement,
    ...createRotarySwitchPorts({
      componentId: "SW1",
      poles: 1,
      positions: 3,
      includeMountPin: true,
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .MODEL SW_SW1 SW(Ron=0.001 Roff=1e9 Vt=2.5 Vh=0.1)
    VCTRL_SW1_ON NCTRL_SW1_ON 0 DC 5
    VCTRL_SW1_OFF NCTRL_SW1_OFF 0 DC 0
    SSW1_P1_T1 N4 N1 NCTRL_SW1_ON 0 SW_SW1
    SSW1_P1_T2 N4 N2 NCTRL_SW1_OFF 0 SW_SW1
    SSW1_P1_T3 N4 N3 NCTRL_SW1_OFF 0 SW_SW1
    .END"
  `)
})

test("rotary switch closes selected_position across wired ganged poles and skips unwired decks", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "SW1",
      name: "SW1",
      ftype: "simple_rotary_switch",
      poles: 4,
      positions: 3,
    } as unknown as AnyCircuitElement,
    ...createRotarySwitchPorts({
      componentId: "SW1",
      poles: 4,
      positions: 3,
    }),
    {
      type: "source_net",
      source_net_id: "net_gnd",
      name: "GND",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    {
      type: "source_net",
      source_net_id: "net_out_a",
      name: "OUT_A",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    {
      type: "source_net",
      source_net_id: "net_out_b",
      name: "OUT_B",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    // Wire deck 1 (common = pin 13, throw 2 = pin 2) and deck 2 (common = pin 14, throw 2 = pin 5).
    // Leave decks 3 and 4 (pins 7..12, 15, 16) completely unwired (noConnect).
    {
      type: "source_trace",
      source_trace_id: "t_com1",
      connected_source_port_ids: ["SW1_pin13"],
      connected_source_net_ids: ["net_out_a"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "t_p1t2",
      connected_source_port_ids: ["SW1_pin2"],
      connected_source_net_ids: ["net_gnd"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "t_com2",
      connected_source_port_ids: ["SW1_pin14"],
      connected_source_net_ids: ["net_out_b"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "t_p2t2",
      connected_source_port_ids: ["SW1_pin5"],
      connected_source_net_ids: ["net_gnd"],
    } as AnyCircuitElement,
    {
      type: "simulation_switch",
      simulation_switch_id: "sim_sw1",
      source_component_id: "SW1",
      selected_position: 2,
    } as unknown as AnyCircuitElement,
  ]

  const spiceString = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceString).toContain("SSW1_P1_T1 N1 N3 NCTRL_SW1_OFF 0 SW_SW1")
  expect(spiceString).toContain("SSW1_P1_T2 N1 0 NCTRL_SW1_ON 0 SW_SW1")
  expect(spiceString).toContain("SSW1_P1_T3 N1 N4 NCTRL_SW1_OFF 0 SW_SW1")
  expect(spiceString).toContain("SSW1_P2_T1 N2 N5 NCTRL_SW1_OFF 0 SW_SW1")
  expect(spiceString).toContain("SSW1_P2_T2 N2 0 NCTRL_SW1_ON 0 SW_SW1")
  expect(spiceString).toContain("SSW1_P2_T3 N2 N6 NCTRL_SW1_OFF 0 SW_SW1")
  expect(spiceString).not.toContain("SSW1_P3_")
  expect(spiceString).not.toContain("SSW1_P4_")
})

test("rotary switch resolves semantic port aliases when pin_number is omitted", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "SW_ALIAS",
      name: "SW_ALIAS",
      ftype: "simple_rotary_switch",
      poles: 1,
      positions: 3,
    } as unknown as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "port_com",
      source_component_id: "SW_ALIAS",
      name: "common",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "port_t1",
      source_component_id: "SW_ALIAS",
      name: "throw1",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "port_t2",
      source_component_id: "SW_ALIAS",
      name: "throw2",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "port_t3",
      source_component_id: "SW_ALIAS",
      name: "throw3",
    } as AnyCircuitElement,
    {
      type: "simulation_switch",
      simulation_switch_id: "sim_alias",
      source_component_id: "SW_ALIAS",
      selected_position: 3,
    } as unknown as AnyCircuitElement,
  ]

  const spiceString = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceString).toContain(
    "SSW_ALIAS_P1_T1 N1 N2 NCTRL_SW_ALIAS_OFF 0 SW_SW_ALIAS",
  )
  expect(spiceString).toContain(
    "SSW_ALIAS_P1_T2 N1 N3 NCTRL_SW_ALIAS_OFF 0 SW_SW_ALIAS",
  )
  expect(spiceString).toContain(
    "SSW_ALIAS_P1_T3 N1 N4 NCTRL_SW_ALIAS_ON 0 SW_SW_ALIAS",
  )
})

test("multiple rotary switches with colliding sanitized names receive distinct SPICE identifiers", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "sub1_sw",
      name: "SW-1",
      ftype: "simple_rotary_switch",
      poles: 1,
      positions: 2,
    } as unknown as AnyCircuitElement,
    ...createRotarySwitchPorts({
      componentId: "sub1_sw",
      poles: 1,
      positions: 2,
    }),
    {
      type: "source_component",
      source_component_id: "sub2_sw",
      name: "SW_1",
      ftype: "simple_rotary_switch",
      poles: 1,
      positions: 2,
    } as unknown as AnyCircuitElement,
    ...createRotarySwitchPorts({
      componentId: "sub2_sw",
      poles: 1,
      positions: 2,
    }),
  ]

  const spiceString = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceString).toContain(".MODEL SW_SW_1 SW(")
  expect(spiceString).toContain(".MODEL SW_SW_1_sub2_sw SW(")
  expect(spiceString).toContain("SSW_1_P1_T1")
  expect(spiceString).toContain("SSW_1_sub2_sw_P1_T1")
})
