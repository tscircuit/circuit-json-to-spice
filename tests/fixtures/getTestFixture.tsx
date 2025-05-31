import { RootCircuit } from "tscircuit"

export const getTestFixture = () => {
  const circuit = new RootCircuit()

  return { circuit }
}
