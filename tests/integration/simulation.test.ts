import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import { Simulation } from "eecircuit-engine"

if (!WebAssembly.instantiateStreaming) {
  WebAssembly.instantiateStreaming = async (
    source: Response | PromiseLike<Response>,
    importObject?: WebAssembly.Imports,
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource> => {
    const response = await source
    return WebAssembly.instantiate(await response.arrayBuffer(), importObject)
  }
}

test("simulate resistor divider containing a zero-ohm resistor", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 0,
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
  expect(spice).toContain("1e-12")

  const sim = new Simulation()
  await sim.start()
  sim.setNetList(spice)
  const result = await sim.runSim()
  expect(result.numVariables).toBeGreaterThan(0)
  expect(result.variableNames).toContain("v(n1)")
})

const roundNumber = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

test("simulation switch drives square wave", async () => {
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
      source_component_id: "SW1",
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

  const lines = netlist.toSpiceString().split("\n")
  lines.pop()

  const switchLine = lines.find((line) => line.startsWith("SSW1"))
  if (!switchLine) throw new Error("Switch line not found in netlist")

  const switchTokens = switchLine.trim().split(/\s+/)
  const vinNode = switchTokens[1]
  const voutNode = switchTokens[2]

  lines.push(`V1 ${vinNode} 0 5`)
  lines.push(".tran 5e-5 4e-3")
  lines.push(".END")

  const spice = lines.join("\n")

  const sim = new Simulation()
  await sim.start()
  sim.setNetList(spice)
  const result = await sim.runSim()

  const timeData = result.data.find((entry) => entry.name === "time")
  if (!timeData) throw new Error("Time data not found")

  const targetName = `v(${voutNode.toLowerCase()})`
  const voltageData = result.data.find(
    (entry) => entry.name.toLowerCase() === targetName,
  )

  if (!voltageData) {
    throw new Error(`Voltage data for ${targetName} not found`)
  }

  const targetTimes = [0, 0.0008, 0.0016, 0.0024, 0.0032, 0.004]
  const timeValues = timeData.values as number[]
  const voltageValues = voltageData.values as number[]

  const waveformSample = targetTimes.map((target) => {
    let closestIndex = 0
    let closestDiff = Number.POSITIVE_INFINITY

    for (let index = 0; index < timeValues.length; index++) {
      const diff = Math.abs(timeValues[index] - target)
      if (diff < closestDiff) {
        closestDiff = diff
        closestIndex = index
      } else if (timeValues[index] > target) {
        break
      }
    }

    return {
      time: roundNumber(timeValues[closestIndex], 6),
      voltage: roundNumber(voltageValues[closestIndex], 3),
    }
  })

  expect(waveformSample).toMatchInlineSnapshot(`
    [
      {
        "time": 0,
        "voltage": 0,
      },
      {
        "time": 0.000775,
        "voltage": 0,
      },
      {
        "time": 0.001575,
        "voltage": 0,
      },
      {
        "time": 0.002375,
        "voltage": 5,
      },
      {
        "time": 0.003175,
        "voltage": 5,
      },
      {
        "time": 0.004,
        "voltage": 0,
      },
    ]
  `)
})

test("simulate 4x3 rotary switch across swept positions with unused noConnect decks", async () => {
  const buildCircuitAtPosition = (
    selectedPosition: number,
  ): AnyCircuitElement[] => {
    const ports: AnyCircuitElement[] = []
    for (let pole = 1; pole <= 4; pole++) {
      for (let pos = 1; pos <= 3; pos++) {
        const pinNumber = (pole - 1) * 3 + pos
        ports.push({
          type: "source_port",
          source_port_id: `SW1_pin${pinNumber}`,
          source_component_id: "SW1",
          name: `p${pole}_pos${pos}`,
          pin_number: pinNumber,
        } as AnyCircuitElement)
      }
    }
    for (let pole = 1; pole <= 4; pole++) {
      const pinNumber = 12 + pole
      ports.push({
        type: "source_port",
        source_port_id: `SW1_pin${pinNumber}`,
        source_component_id: "SW1",
        name: `common${pole}`,
        pin_number: pinNumber,
      } as AnyCircuitElement)
    }

    // Deck 1 selects between 1k, 3k, and 9k pull-downs against a 3k pull-up to 12V:
    // V(OUT_A) = 12 * R_sel / (3k + R_sel) -> 3V, 6V, 9V.
    // Deck 2 selects between 9k, 3k, and 1k pull-downs against a 3k pull-up to 12V:
    // V(OUT_B) = 9V, 6V, 3V.
    // Decks 3 and 4 remain unwired (noConnect).
    return [
      {
        type: "source_component",
        source_component_id: "SW1",
        name: "SW1",
        ftype: "simple_rotary_switch",
        poles: 4,
        positions: 3,
      } as unknown as AnyCircuitElement,
      ...ports,
      ...[
        { id: "RA_TOP", resistance: 3000 },
        { id: "RA1", resistance: 1000 },
        { id: "RA2", resistance: 3000 },
        { id: "RA3", resistance: 9000 },
        { id: "RB_TOP", resistance: 3000 },
        { id: "RB1", resistance: 9000 },
        { id: "RB2", resistance: 3000 },
        { id: "RB3", resistance: 1000 },
      ].flatMap(({ id, resistance }) => [
        {
          type: "source_component",
          source_component_id: id,
          name: id,
          ftype: "simple_resistor",
          resistance,
        } as AnyCircuitElement,
        {
          type: "source_port",
          source_port_id: `${id}_p1`,
          source_component_id: id,
          name: "pin1",
          pin_number: 1,
        } as AnyCircuitElement,
        {
          type: "source_port",
          source_port_id: `${id}_p2`,
          source_component_id: id,
          name: "pin2",
          pin_number: 2,
        } as AnyCircuitElement,
      ]),
      {
        type: "source_net",
        source_net_id: "net_vcc",
        name: "VCC",
        member_source_group_ids: [],
      } as AnyCircuitElement,
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
      {
        type: "source_trace",
        source_trace_id: "t_vcc",
        connected_source_port_ids: ["RA_TOP_p1", "RB_TOP_p1"],
        connected_source_net_ids: ["net_vcc"],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_gnd",
        connected_source_port_ids: [
          "RA1_p2",
          "RA2_p2",
          "RA3_p2",
          "RB1_p2",
          "RB2_p2",
          "RB3_p2",
        ],
        connected_source_net_ids: ["net_gnd"],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_out_a",
        connected_source_port_ids: ["RA_TOP_p2", "SW1_pin13"],
        connected_source_net_ids: ["net_out_a"],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_out_b",
        connected_source_port_ids: ["RB_TOP_p2", "SW1_pin14"],
        connected_source_net_ids: ["net_out_b"],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_a1",
        connected_source_port_ids: ["SW1_pin1", "RA1_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_a2",
        connected_source_port_ids: ["SW1_pin2", "RA2_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_a3",
        connected_source_port_ids: ["SW1_pin3", "RA3_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_b1",
        connected_source_port_ids: ["SW1_pin4", "RB1_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_b2",
        connected_source_port_ids: ["SW1_pin5", "RB2_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "source_trace",
        source_trace_id: "t_b3",
        connected_source_port_ids: ["SW1_pin6", "RB3_p1"],
        connected_source_net_ids: [],
      } as AnyCircuitElement,
      {
        type: "simulation_voltage_source",
        simulation_voltage_source_id: "vcc_src",
        is_dc_source: true,
        positive_source_net_id: "net_vcc",
        negative_source_net_id: "net_gnd",
        voltage: 12,
      } as AnyCircuitElement,
      {
        type: "simulation_voltage_probe",
        simulation_voltage_probe_id: "probe_out_a",
        signal_input_source_net_id: "net_out_a",
        name: "OUT_A",
      } as AnyCircuitElement,
      {
        type: "simulation_voltage_probe",
        simulation_voltage_probe_id: "probe_out_b",
        signal_input_source_net_id: "net_out_b",
        name: "OUT_B",
      } as AnyCircuitElement,
      {
        type: "simulation_switch",
        simulation_switch_id: "sim_sw1",
        source_component_id: "SW1",
        selected_position: selectedPosition,
      } as unknown as AnyCircuitElement,
      {
        type: "simulation_experiment",
        simulation_experiment_id: "exp_op",
        name: "Rotary Sweep",
        experiment_type: "spice_dc_operating_point",
      } as AnyCircuitElement,
    ]
  }

  const measuredByPosition: Array<{
    position: number
    outA: number
    outB: number
  }> = []

  for (const position of [1, 2, 3]) {
    const spice = circuitJsonToSpice(
      buildCircuitAtPosition(position),
    ).toSpiceString()
    const sim = new Simulation()
    await sim.start()
    sim.setNetList(spice)
    const result = await sim.runSim()

    const outAEntry = result.data.find(
      (entry) => entry.name.toLowerCase() === "v(out_a)",
    )
    const outBEntry = result.data.find(
      (entry) => entry.name.toLowerCase() === "v(out_b)",
    )
    expect(outAEntry).toBeDefined()
    expect(outBEntry).toBeDefined()

    measuredByPosition.push({
      position,
      outA: roundNumber((outAEntry!.values as number[])[0], 3),
      outB: roundNumber((outBEntry!.values as number[])[0], 3),
    })
  }

  expect(measuredByPosition).toEqual([
    { position: 1, outA: 3, outB: 9 },
    { position: 2, outA: 6, outB: 6 },
    { position: 3, outA: 9, outB: 3 },
  ])
})
