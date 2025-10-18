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

test("simulate simple resistor divider", async () => {
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
