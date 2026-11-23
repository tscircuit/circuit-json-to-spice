import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { Circuit } from "tscircuit"

if (!WebAssembly.instantiateStreaming) {
  WebAssembly.instantiateStreaming = async (
    source: Response | PromiseLike<Response>,
    importObject?: WebAssembly.Imports,
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource> => {
    const response = await source
    return WebAssembly.instantiate(await response.arrayBuffer(), importObject)
  }
}

const sampleNearest = (times: number[], values: number[], target: number) => {
  let bestIndex = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(times[i]! - target)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = i
    }
  }
  return values[bestIndex]!
}

test("triangle and sawtooth voltage sources emit PULSE expressions across amplitude combinations", () => {
  const buildNetlist = (source: Record<string, unknown>) =>
    circuitJsonToSpice([
      {
        type: "source_net",
        source_net_id: "net_out",
        name: "OUT",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_gnd",
        name: "GND",
        member_source_group_ids: [],
      },
      {
        type: "source_port",
        source_port_id: "vin_pos",
        name: "pos",
        source_component_id: "vin_comp",
      },
      {
        type: "source_port",
        source_port_id: "vin_neg",
        name: "neg",
        source_component_id: "vin_comp",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_out",
        connected_source_port_ids: ["vin_pos"],
        connected_source_net_ids: ["net_out"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace_gnd",
        connected_source_port_ids: ["vin_neg"],
        connected_source_net_ids: ["net_gnd"],
      },
      {
        type: "simulation_voltage_source",
        simulation_voltage_source_id: "vin",
        is_dc_source: false,
        terminal1_source_port_id: "vin_pos",
        terminal2_source_port_id: "vin_neg",
        ...source,
      } as AnyCircuitElement,
    ]).toSpiceString()

  expect(
    buildNetlist({ wave_shape: "triangle", voltage: 5, frequency: 1000 }),
  ).toContain("Vvin N1 0 PULSE(0 5 0 500u 500u 1p 1m)")

  expect(
    buildNetlist({ wave_shape: "sawtooth", voltage: 5, frequency: 1000 }),
  ).toContain("Vvin N1 0 PULSE(0 5 0 999u 1u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "triangle",
      peak_to_peak_voltage: 4,
      frequency: 1000,
    }),
  ).toContain("Vvin N1 0 PULSE(0 4 0 500u 500u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "sawtooth",
      peak_to_peak_voltage: 4,
      frequency: 1000,
    }),
  ).toContain("Vvin N1 0 PULSE(0 4 0 999u 1u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "triangle",
      voltage: 5,
      peak_to_peak_voltage: 4,
      frequency: 1000,
    }),
  ).toContain("Vvin N1 0 PULSE(0 5 0 500u 500u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "sawtooth",
      voltage: 5,
      peak_to_peak_voltage: 4,
      frequency: 1000,
    }),
  ).toContain("Vvin N1 0 PULSE(0 5 0 999u 1u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "triangle",
      voltage: 3.3,
      period: 2,
      pulse_delay: 0.1,
    }),
  ).toContain("Vvin N1 0 PULSE(0 3.3 100u 1m 1m 1p 2m)")

  expect(buildNetlist({ wave_shape: "triangle", voltage: 5 })).toContain(
    "Vvin N1 0 DC 5",
  )

  expect(
    buildNetlist({ wave_shape: "sawtooth", peak_to_peak_voltage: 4 }),
  ).toContain("Vvin N1 0 DC 4")
})

test("triangle and sawtooth current sources emit PULSE expressions and preserve DC offsets", () => {
  const buildNetlist = (source: Record<string, unknown>) =>
    circuitJsonToSpice([
      {
        type: "source_net",
        source_net_id: "net_out",
        name: "OUT",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_gnd",
        name: "GND",
        member_source_group_ids: [],
      },
      {
        type: "source_port",
        source_port_id: "iload_pos",
        name: "pos",
        source_component_id: "iload_comp",
      },
      {
        type: "source_port",
        source_port_id: "iload_neg",
        name: "neg",
        source_component_id: "iload_comp",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_out",
        connected_source_port_ids: ["iload_pos"],
        connected_source_net_ids: ["net_out"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace_gnd",
        connected_source_port_ids: ["iload_neg"],
        connected_source_net_ids: ["net_gnd"],
      },
      {
        type: "simulation_current_source",
        simulation_current_source_id: "iload",
        is_dc_source: false,
        terminal1_source_port_id: "iload_pos",
        terminal2_source_port_id: "iload_neg",
        ...source,
      } as AnyCircuitElement,
    ]).toSpiceString()

  expect(
    buildNetlist({
      wave_shape: "triangle",
      peak_to_peak_current: 0.5,
      frequency: 1000,
    }),
  ).toContain("Iiload N1 0 PULSE(0 0.5 0 500u 500u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "sawtooth",
      peak_to_peak_current: 0.5,
      frequency: 1000,
    }),
  ).toContain("Iiload N1 0 PULSE(0 0.5 0 999u 1u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "triangle",
      current: 0.5,
      peak_to_peak_current: 0.5,
      frequency: 1000,
    }),
  ).toContain("Iiload N1 0 PULSE(0.5 1 0 500u 500u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "sawtooth",
      current: 0.5,
      peak_to_peak_current: 0.5,
      frequency: 1000,
    }),
  ).toContain("Iiload N1 0 PULSE(0.5 1 0 999u 1u 1p 1m)")

  expect(
    buildNetlist({
      wave_shape: "triangle",
      current: 2,
      frequency: 1000,
    }),
  ).toContain("Iiload N1 0 PULSE(0 2 0 500u 500u 1p 1m)")
})

test("TSX triangle voltage source simulates as a ramping triangle wave in both ngspice engines", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        waveShape="triangle"
        voltage="5V"
        frequency="1kHz"
      />
      <resistor name="R1" resistance="1k" />
      <trace from=".V1 > .pin1" to=".R1 > .pin1" />
      <trace from=".V1 > .pin2" to=".R1 > .pin2" />
      <voltageprobe
        name="VP"
        connectsTo=".R1 > .pin1"
        referenceTo=".R1 > .pin2"
      />
      <analogsimulation duration="2ms" timePerStep="0.005ms" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const spice = circuitJsonToSpice(circuit.getCircuitJson()).toSpiceString()
  expect(spice).toContain("PULSE(0 5 0 500u 500u 1p 1m)")

  // 1. Verify via @tscircuit/ngspice-spice-engine
  const ngProc = spawnSync(
    process.execPath,
    [join(import.meta.dir, "../fixtures/run-ngspice-simulation.ts")],
    { input: spice, encoding: "utf8", timeout: 10_000 },
  )
  expect(ngProc.status).toBe(0)
  const ngParsed = JSON.parse(ngProc.stdout.trim().split("\n").at(-1)!)
  expect(ngParsed.error).toBeUndefined()
  const ngGraph = ngParsed.simulationResultCircuitJson.find(
    (el: AnyCircuitElement) => el.type === "simulation_transient_voltage_graph",
  )
  expect(ngGraph).toBeDefined()
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 0),
  ).toBeCloseTo(0, 1)
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 0.25),
  ).toBeCloseTo(2.5, 1)
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 0.5),
  ).toBeCloseTo(5, 1)
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 0.75),
  ).toBeCloseTo(2.5, 1)
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 1.0),
  ).toBeCloseTo(0, 1)
  expect(
    sampleNearest(ngGraph.timestamps_ms, ngGraph.voltage_levels, 1.5),
  ).toBeCloseTo(5, 1)

  // 2. Verify via eecircuit-engine (WASM ngspice where PW=0 would clamp at 5V)
  const sim = new Simulation()
  await sim.start()
  const cleanSpice = spice
    .split("\n")
    .filter((l) => !l.startsWith(".PRINT") && !l.startsWith(".SAVE"))
    .join("\n")
  sim.setNetList(cleanSpice)
  const eeResult = await sim.runSim()
  const eeTimes = eeResult.data.find((d) => d.name === "time")!
    .values as number[]
  const eeVolts = eeResult.data.find((d) => d.name.startsWith("v("))!
    .values as number[]
  expect(sampleNearest(eeTimes, eeVolts, 0.00025)).toBeCloseTo(2.5, 1)
  expect(sampleNearest(eeTimes, eeVolts, 0.0005)).toBeCloseTo(5, 1)
  expect(sampleNearest(eeTimes, eeVolts, 0.00075)).toBeCloseTo(2.5, 1)
  expect(sampleNearest(eeTimes, eeVolts, 0.001)).toBeCloseTo(0, 1)
})

test("sawtooth peakToPeakVoltage source and triangle current source simulate expected ramps", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        waveShape="sawtooth"
        peakToPeakVoltage="4V"
        frequency="1kHz"
        connections={{ pin1: "net.VSAW", pin2: "net.GND" }}
      />
      <resistor
        name="R1"
        resistance="1k"
        connections={{ pin1: "net.VSAW", pin2: "net.GND" }}
      />
      <currentsource
        name="I1"
        waveShape="triangle"
        current="0.5A"
        peakToPeakCurrent="0.5A"
        frequency="1kHz"
        connections={{ pin1: "net.GND", pin2: "net.ITRI" }}
      />
      <resistor
        name="R2"
        resistance="1"
        connections={{ pin1: "net.ITRI", pin2: "net.GND" }}
      />
      <voltageprobe name="VSAW" connectsTo="net.VSAW" />
      <voltageprobe name="ITRI" connectsTo="net.ITRI" />
      <analogsimulation duration="2ms" timePerStep="0.01ms" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const spice = circuitJsonToSpice(circuit.getCircuitJson()).toSpiceString()
  expect(spice).toContain("PULSE(0 4 0 999u 1u 1p 1m)")
  expect(spice).toContain("PULSE(0.5 1 0 500u 500u 1p 1m)")

  const sim = new Simulation()
  await sim.start()
  const cleanSpice = spice
    .split("\n")
    .filter((l) => !l.startsWith(".PRINT") && !l.startsWith(".SAVE"))
    .join("\n")
  sim.setNetList(cleanSpice)
  const eeResult = await sim.runSim()
  const eeTimes = eeResult.data.find((d) => d.name === "time")!
    .values as number[]
  const vsaw = eeResult.data.find((d) => d.name.toLowerCase() === "v(vsaw)")!
    .values as number[]
  const itri = eeResult.data.find((d) => d.name.toLowerCase() === "v(itri)")!
    .values as number[]

  expect(sampleNearest(eeTimes, vsaw, 0.00025)).toBeCloseTo(1, 1)
  expect(sampleNearest(eeTimes, vsaw, 0.0005)).toBeCloseTo(2, 1)
  expect(sampleNearest(eeTimes, vsaw, 0.00075)).toBeCloseTo(3, 1)
  expect(sampleNearest(eeTimes, vsaw, 0.00095)).toBeGreaterThan(3.7)
  expect(sampleNearest(eeTimes, vsaw, 0.00105)).toBeLessThan(0.4)

  expect(sampleNearest(eeTimes, itri, 0)).toBeCloseTo(0.5, 1)
  expect(sampleNearest(eeTimes, itri, 0.00025)).toBeCloseTo(0.75, 1)
  expect(sampleNearest(eeTimes, itri, 0.0005)).toBeCloseTo(1.0, 1)
  expect(sampleNearest(eeTimes, itri, 0.00075)).toBeCloseTo(0.75, 1)
  expect(sampleNearest(eeTimes, itri, 0.001)).toBeCloseTo(0.5, 1)
})
