# circuit-json-to-spice

Convert Circuit JSON into ngspice compatible SPICE netlists

## Installation

```bash
bun add circuit-json-to-spice
```

## Usage

```typescript
import { circuitJsonToSpice, convertSpiceNetlistToString } from "circuit-json-to-spice"

// Convert Circuit JSON to SPICE netlist
const spiceNetlist = circuitJsonToSpice(circuitJson)

// Convert to SPICE string format
const spiceString = spiceNetlist.toSpiceString()
```

## Example: Converting tscircuit code to SPICE

Here's a complete example showing how to create a circuit with tscircuit and convert it to SPICE:

```typescript
import { Circuit, sel } from "tscircuit"
import { circuitJsonToSpice } from "circuit-json-to-spice"

// Create a simple RC circuit
const circuit = new Circuit()

circuit.add(
  <board>
    <resistor name="R1" resistance="1k" />
    <capacitor
      name="C1" 
      capacitance="1uF"
      connections={{
        pin1: sel.R1.pin1,
      }}
    />
  </board>
)

// Render the circuit to get Circuit JSON
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()

// Convert to SPICE
const spiceNetlist = circuitJsonToSpice(circuitJson)
const spiceString = spiceNetlist.toSpiceString()

console.log(spiceString)
```

**Output:**
```spice
Circuit JSON to SPICE Netlist
RR1 N1 N2 1K
CC1 N1 N3 1U
.END
```

## Supported Components

Currently supports the following tscircuit components:

- **Resistors** (`simple_resistor`) - Converted to SPICE R components
- **Capacitors** (`simple_capacitor`) - Converted to SPICE C components
- **Transistors** (`simple_transistor`) - Converted to SPICE Q components (BJT)

More components will be added in future releases.

## Value Formatting

The library automatically formats component values using standard SPICE notation:

- **Resistors**: `1000` → `1K`, `1000000` → `1MEG`
- **Capacitors**: `0.000001` → `1U`, `0.000000001` → `1N`, `0.000000000001` → `1P`

## Voltage-source waveforms

For AC voltage sources (`is_dc_source: false`), explicit `voltage` takes precedence over `peak_to_peak_voltage`:

- **`sinewave`**: `SIN(0 Vpeak f 0 0 phase)`, where `Vpeak` is `voltage` (or `peak_to_peak_voltage / 2` when `voltage` is omitted).
- **`square`**: `PULSE(0 Vhigh TD TR TF PW T)`, switching from `0` to `voltage ?? peak_to_peak_voltage ?? 0` (default `TR = TF = 1n`, `PW = T * duty_cycle` with default `duty_cycle = 0.5`).
- **`triangle`**: `PULSE(0 Vhigh TD TR TF PW T)`, ramping from `0` to `voltage ?? peak_to_peak_voltage ?? 0` over `TR = T / 2` and back over `TF = T / 2`, with default `PW = min(1p, T * 1e-6)` so SPICE3f5 / WASM ngspice does not treat `PW = 0` as `TSTOP`.
- **`sawtooth`**: `PULSE(0 Vhigh TD TR TF PW T)`, rising from `0` to `voltage ?? peak_to_peak_voltage ?? 0` over `TR = T - TF` and resetting over `TF = T * 1e-3`, with default `PW = min(1p, T * 1e-6)`.

`square`, `triangle`, and `sawtooth` voltage sources honor explicit `period`, `pulse_delay`, `rise_time`, `fall_time`, and `pulse_width` overrides (in milliseconds), and fall back to `DC` when neither a positive `frequency` nor `period` is provided.

## Current-source waveforms

For AC current sources, `current` is the DC offset in amperes and defaults to zero.
A square wave switches from `current` to `current + peak_to_peak_current`.
For example, `current: 0.5` with `peak_to_peak_current: 0.5` produces a 0.5–1 A
load step. A sine wave is centered on `current`, with an amplitude of half
`peak_to_peak_current`. Triangle and sawtooth current sources swing from `current`
(defaulting to `0`) to `current + peak_to_peak_current` when `peak_to_peak_current`
is provided, or from `0` to `current` when only `current` is provided, using the
same `T / 2` and `T * 1e-3` edge timings and `PW = min(1p, T * 1e-6)` default width.
Existing sources without an offset retain their behavior.

## References

- Inspired by [https://eecircuit.com/](https://eecircuit.com/)
