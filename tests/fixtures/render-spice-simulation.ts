import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { CircuitJson } from "circuit-json"
import {
  convertCircuitJsonToSchematicSimulationSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"

export const renderSpiceSimulation = async ({
  circuitJson,
  spice,
  name,
}: {
  circuitJson: CircuitJson
  spice: string
  name: string
}): Promise<string> => {
  const simulation_experiment_id = "snapshot_experiment"
  let simulationResultCircuitJson: CircuitJson
  try {
    // The WASM runtime shares state within a process, so each circuit gets a
    // fresh runtime regardless of Bun's test-file order.
    const execution = spawnSync(
      process.execPath,
      [join(import.meta.dir, "run-ngspice-simulation.ts")],
      { input: spice, encoding: "utf8", timeout: 10_000 },
    )
    if (execution.status !== 0) {
      throw new Error(execution.stderr.trim() || "ngspice worker failed")
    }
    const result: {
      simulationResultCircuitJson: CircuitJson
      error?: string
    } = JSON.parse(execution.stdout.trim().split("\n").at(-1)!)
    if (result.error) throw new Error(result.error)
    simulationResultCircuitJson = result.simulationResultCircuitJson
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("ngspice simulation failed")
    )
      throw error
    simulationResultCircuitJson = [
      {
        type: "simulation_unknown_experiment_error",
        simulation_unknown_experiment_error_id: "snapshot_simulation_error",
        error_type: "simulation_unknown_experiment_error",
        message: error.message,
      },
    ]
  }
  if (
    simulationResultCircuitJson.some(
      (result) => result.type === "simulation_unknown_experiment_error",
    )
  ) {
    return convertCircuitJsonToSchematicSvg(
      [...circuitJson, ...simulationResultCircuitJson],
      {
        width: 1200,
        height: 900,
        showErrorsInTextOverlay: true,
      },
    )
  }
  return convertCircuitJsonToSchematicSimulationSvg({
    circuitJson: [
      ...circuitJson,
      {
        type: "simulation_experiment",
        simulation_experiment_id,
        experiment_type: "spice_transient_analysis",
        name,
      },
      ...simulationResultCircuitJson.map((result) => ({
        ...result,
        simulation_experiment_id,
      })),
    ],
    simulation_experiment_id,
    showErrorsInTextOverlay: true,
    width: 1200,
    height: 900,
  })
}
