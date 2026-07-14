export type CircuitJsonToSpiceErrorCode =
  | "missing_model"
  | "unsupported_analysis"
  | "invalid_netlist"

export class CircuitJsonToSpiceError extends Error {
  code: CircuitJsonToSpiceErrorCode
  diagnostics?: string

  constructor(
    code: CircuitJsonToSpiceErrorCode,
    message: string,
    diagnostics?: string,
  ) {
    super(message)
    this.name = "CircuitJsonToSpiceError"
    this.code = code
    this.diagnostics = diagnostics
  }
}
