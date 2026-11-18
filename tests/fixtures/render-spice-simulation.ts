import { createNgspiceSpiceEngine } from "@tscircuit/ngspice-spice-engine"
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
  const engine = await createNgspiceSpiceEngine()
  let simulationResultCircuitJson: CircuitJson
  try {
    simulationResultCircuitJson = (await engine.simulate(spice))
      .simulationResultCircuitJson
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
