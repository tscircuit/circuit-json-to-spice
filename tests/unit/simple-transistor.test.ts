import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { AnyCircuitElement, CircuitJson } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const runNgspice = (spice: string) => {
  const execution = spawnSync(
    process.execPath,
    [join(import.meta.dir, "../fixtures/run-ngspice-simulation.ts")],
    { input: spice, encoding: "utf8", timeout: 10_000 },
  )
  expect(execution.status).toBe(0)
  return JSON.parse(execution.stdout.trim().split("\n").at(-1)!) as {
    simulationResultCircuitJson?: CircuitJson
    error?: string
  }
}

const buildTransistorSwitchCircuit = ({
  transistorType,
  portNames = ["collector", "base", "emitter"],
  gateDrive = "DC 5",
}: {
  transistorType: "npn" | "pnp" | "bjt" | "jfet" | "mosfet" | "igbt"
  portNames?: [string, string, string]
  gateDrive?: "DC 0" | "DC 5"
}): AnyCircuitElement[] => {
  const [term1Name, term2Name, term3Name] = portNames
  const gateVoltage = gateDrive === "DC 0" ? 0 : 5
  return [
    {
      type: "source_component",
      source_component_id: "src_vcc",
      name: "V1",
      ftype: "simple_voltage_source",
      voltage: 5,
    },
    {
      type: "source_port",
      source_port_id: "vcc_pos",
      name: "pos",
      source_component_id: "src_vcc",
    },
    {
      type: "source_port",
      source_port_id: "vcc_neg",
      name: "neg",
      source_component_id: "src_vcc",
    },
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "sim_vcc",
      is_dc_source: true,
      positive_source_port_id: "vcc_pos",
      negative_source_port_id: "vcc_neg",
      voltage: 5,
    },
    {
      type: "source_component",
      source_component_id: "src_vg",
      name: "V2",
      ftype: "simple_voltage_source",
      voltage: gateVoltage,
    },
    {
      type: "source_port",
      source_port_id: "vg_pos",
      name: "pos",
      source_component_id: "src_vg",
    },
    {
      type: "source_port",
      source_port_id: "vg_neg",
      name: "neg",
      source_component_id: "src_vg",
    },
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "sim_vg",
      is_dc_source: true,
      positive_source_port_id: "vg_pos",
      negative_source_port_id: "vg_neg",
      voltage: gateVoltage,
    },
    {
      type: "source_component",
      source_component_id: "src_rload",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_port",
      source_port_id: "rload_1",
      name: "pin1",
      source_component_id: "src_rload",
    },
    {
      type: "source_port",
      source_port_id: "rload_2",
      name: "pin2",
      source_component_id: "src_rload",
    },
    {
      type: "source_component",
      source_component_id: "src_rctrl",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 10_000,
    },
    {
      type: "source_port",
      source_port_id: "rctrl_1",
      name: "pin1",
      source_component_id: "src_rctrl",
    },
    {
      type: "source_port",
      source_port_id: "rctrl_2",
      name: "pin2",
      source_component_id: "src_rctrl",
    },
    {
      type: "source_component",
      source_component_id: "src_q1",
      name: "Q1",
      ftype: "simple_transistor",
      transistor_type: transistorType as "npn",
    },
    {
      type: "source_port",
      source_port_id: "q_term1",
      name: term1Name,
      port_hints: [term1Name],
      source_component_id: "src_q1",
    },
    {
      type: "source_port",
      source_port_id: "q_term2",
      name: term2Name,
      port_hints: [term2Name],
      source_component_id: "src_q1",
    },
    {
      type: "source_port",
      source_port_id: "q_term3",
      name: term3Name,
      port_hints: [term3Name],
      source_component_id: "src_q1",
    },
    {
      type: "source_net",
      source_net_id: "net_vcc",
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "net_gnd",
      name: "GND",
      is_ground: true,
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "tr_vcc",
      connected_source_port_ids: ["vcc_pos", "rload_1"],
      connected_source_net_ids: ["net_vcc"],
    },
    {
      type: "source_trace",
      source_trace_id: "tr_out",
      connected_source_port_ids: ["rload_2", "q_term1"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "tr_ctrl_in",
      connected_source_port_ids: ["vg_pos", "rctrl_1"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "tr_ctrl_gate",
      connected_source_port_ids: ["rctrl_2", "q_term2"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "tr_gnd",
      connected_source_port_ids: ["vcc_neg", "vg_neg", "q_term3"],
      connected_source_net_ids: ["net_gnd"],
    },
    {
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: "probe_out",
      name: "VP_OUT",
      signal_input_source_port_id: "q_term1",
    },
    {
      type: "simulation_experiment",
      simulation_experiment_id: "sim_exp_1",
      name: "Transistor switch",
      experiment_type: "spice_transient_analysis",
      time_per_step: 0.05,
      end_time_ms: 1,
    },
  ]
}

test(
  "simulates bjt, jfet, mosfet, and igbt transistor_type variants without SPICE model errors",
  () => {
    for (const transistorType of ["bjt", "jfet", "mosfet", "igbt"] as const) {
      const spice = circuitJsonToSpice(
        buildTransistorSwitchCircuit({ transistorType }),
      ).toSpiceString()

      expect(spice).not.toContain(`.MODEL ${transistorType.toUpperCase()} `)

      const simResult = runNgspice(spice)
      expect(simResult.error).toBeUndefined()
      expect(simResult.simulationResultCircuitJson?.length).toBeGreaterThan(0)
    }
  },
  { timeout: 30_000 },
)

test(
  "supports drain/gate/source and gate port names on jfet, mosfet, and igbt transistors",
  () => {
    const jfetSpice = circuitJsonToSpice(
      buildTransistorSwitchCircuit({
        transistorType: "jfet",
        portNames: ["drain", "gate", "source"],
        gateDrive: "DC 0",
      }),
    ).toSpiceString()
    expect(jfetSpice).toContain(".MODEL NJF NJF")
    expect(jfetSpice).toContain("JQ1 ")
    expect(runNgspice(jfetSpice).error).toBeUndefined()

    const mosfetSpice = circuitJsonToSpice(
      buildTransistorSwitchCircuit({
        transistorType: "mosfet",
        portNames: ["drain", "gate", "source"],
      }),
    ).toSpiceString()
    expect(mosfetSpice).toContain(".MODEL NMOS NMOS")
    expect(mosfetSpice).toContain("MQ1 ")
    expect(runNgspice(mosfetSpice).error).toBeUndefined()

    const igbtSpice = circuitJsonToSpice(
      buildTransistorSwitchCircuit({
        transistorType: "igbt",
        portNames: ["collector", "gate", "emitter"],
      }),
    ).toSpiceString()
    expect(igbtSpice).toContain(".SUBCKT GENERIC_IGBT")
    expect(igbtSpice).toContain("XQ1 ")
    const igbtOnSim = runNgspice(igbtSpice)
    expect(igbtOnSim.error).toBeUndefined()
    const graph = igbtOnSim.simulationResultCircuitJson?.find(
      (e: any) => e.type === "simulation_transient_voltage_graph",
    ) as { voltage_levels?: number[] } | undefined
    expect(graph?.voltage_levels?.at(-1)).toBeLessThan(1.5)
  },
  { timeout: 30_000 },
)

test("throws clear error when required transistor ports are missing", () => {
  const brokenCircuit: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "src_q1",
      name: "Q1",
      ftype: "simple_transistor",
      transistor_type: "jfet" as "npn",
    },
    {
      type: "source_port",
      source_port_id: "q_drain",
      name: "drain",
      source_component_id: "src_q1",
    },
  ]

  expect(() => circuitJsonToSpice(brokenCircuit)).toThrow(
    /Transistor Q1 is missing required ports/,
  )
})
