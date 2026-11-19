# TI power simulation reproductions

Run from the repository root with Bun, `unzip`, and internet access:

```sh
bun examples/ti-power/run.ts all
# Or select linear, buck, or power-tree.
```

The latest Desktop-generated test benches are also available:

```sh
bun examples/ti-power/run.ts desktop-linear
bun examples/ti-power/run.ts desktop-linear-startup
bun examples/ti-power/run.ts desktop-buck
bun examples/ti-power/run.ts desktop-buck-loadstep
bun examples/ti-power/run.ts desktop-buck-ripple
bun examples/ti-power/run.ts desktop-power-tree
bun examples/ti-power/run.ts lmzm-startup
```

These preserve the generated external circuit and source conditions. Native
`.control` blocks are expressed as batch analysis directives, and model libraries
use the existing hash-verified download and exporter isolation. `.SAVE` restricts
stored vectors to the requested outputs; `interp` limits storage to the output
grid for the larger switching cases. Neither changes the internal solver step
(see the [ngspice manual](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf)).

The Desktop power-tree case intentionally retains the generated `SS=1` settings,
separate analog-ground net, and current loads at startup. It reproduces an
unvalidated test bench; it is not a recommended reference design. Compare it with
the original `power-tree` case before attributing a failure to the exporter.

`lmzm-startup` isolates the upstream module with a 24 V ramp and a 24 Ω load.
It uses trapezoidal integration to expose the startup convergence failure; the
Gear version of the same bench advances extremely slowly instead. Native
ngspice 47 also reproduces this behavior with the adapter's compatibility
rewrites applied. This is an unresolved model/solver interaction, not an
established exporter defect.

The `AGND` connection in the original `power-tree` and `lmzm-startup` benches is
a simulation return for this macro-model. The [TI model](https://www.ti.com/lit/zip/snvmbf8)
does not implement the hardware's internal AGND-to-PGND connection. The
[hardware datasheet](https://www.ti.com/lit/ds/symlink/lmzm33602.pdf) says to keep
those pins separate externally; do not copy the simulation return into a PCB.

The small CI-passing visual reproduction of TI's ignored `.IC V(SS_TR )=0`
syntax is in [ngspice adapter PR #42](https://github.com/tscircuit/ngspice-spice-engine/pull/42).
Its [stacked fix](https://github.com/tscircuit/ngspice-spice-engine/pull/43)
normalizes voltage-node whitespace without changing the vendor model files.

The runner downloads the original TI libraries, verifies their SHA-256 hashes,
bundles them through this exporter, and runs the ngspice WASM adapter. Vendor
libraries and generated netlists/results remain in `.cache/ti-power`.
Each simulation runs in a separate process with a ten-minute limit. The buck and
four-stage tree can take several minutes. Set `TI_POWER_TIMEOUT_MS` to change the
process limit. A timeout is recorded as an incomplete failure, never a pass.

| Case | Test bench | Basic acceptance |
| --- | --- | --- |
| Linear | TPS7A2028, 3.1 V input, 1 µF capacitors, 1–300 mA steps with 1 µs edges | Final output within 2% of 2.8 V |
| Buck | TPS54320, 12 V input, 1.1 Ω load, 6.8 µH / 47 µF EVM power stage | Final output within 2% of 3.3 V |
| Power tree | LMZM33602 → TPS82130 → TPS82084 / TPS82085, 24 V input, simultaneous 50–100% final-rail load steps | All four rails within 2% of 12 / 5 / 1.2 / 1.8 V |

These checks establish basic regulation. They do not establish agreement with
hardware ripple, transient peaks, efficiency, or thermal measurements. The tree
uses the detailed TIDA-010011 module branch, with its analog ground connected and
each model's declared startup defaults retained. `interp` limits stored samples
to the requested output interval without increasing the internal solver step.

Sources: [TPS7A20](https://www.ti.com/product/TPS7A20),
[TPS54320EVM-513](https://www.ti.com/lit/pdf/slvu380), and
[TIDA-010011](https://www.ti.com/lit/pdf/tiduel1).

The small automated regressions are in `tests/repros/spice-library-helper-collision.test.tsx`
and the ngspice adapter's PSpice fixtures. The full benches intentionally expose
the adapter's reversed-switch and `Adc` compatibility failures as well as shared
helper-library collisions; all corresponding fixes are required for validation.

Recorded on 2026-11-18 using the local adapter and exporter PR builds: the
linear case reached 2.79995 V and the buck reached 3.33045 V at 5 ms. The complete
four-regulator tree did not finish within ten minutes. Native ngspice also
advanced extremely slowly around 0.766 ms; adding 2 mΩ to the external capacitors
did not resolve that behavior. The library-collision regressions pass, but the
full-tree transient remains unvalidated and needs further model-convergence work.

## Native comparison on 2026-11-19

The same transformed netlists were run in native ngspice 47 and the adapter's
ngspice 46+ WASM build (`@tscircuit/eecircuit-engine` 1.7.6), with adapter PR #43
applied. Both used PSpice compatibility mode. Neither netlist requests KLU. The native
input added only ASCII raw-file output. This compares the two builds; it does
not independently validate the PSpice translation against hardware.

| Bench | Native | WASM | Observation |
| --- | --- | --- | --- |
| Desktop LDO load step | 2.799952 V final | 2.799952 V final | Aligned waveform difference below 1.2e-12 V |
| Desktop buck startup, 1.1 Ω | 3.326531 V | 3.328807 V | Final 100 µs means differ by 2.28 mV; instantaneous waveform differences reach 98 mV |
| Desktop buck load step, original settings | Aborts at 5.86272 ms | Aborts at 1.65127 ms | Reproduces the incomplete transient |
| Desktop buck load step, TI solver profile | 3.326718 V | 3.327146 V | Completes 8 ms; final 100 µs means differ by 0.43 mV |
| Original power tree, `method=trap` | Aborts at 0.765744 ms | Aborts at 0.765744 ms | Same timestep-too-small failure |

Native data was linearly interpolated onto the WASM output grid. Buck means
use that common grid; single final samples are not used as a ripple metric.

For hardware comparison, the [TPS7A20 datasheet](https://www.ti.com/lit/ds/symlink/tps7a20.pdf)
page 17 provides measured load transients. An additional 0–300 mA, 1 µs-edge
run matches those nominal load conditions: both simulators predict about 46 mV
of droop, substantially less than the roughly 190 mV visible in Figure 5-55.
Agreement between simulators does not establish agreement with that measurement.

The [TPS54320 EVM guide](https://www.ti.com/lit/pdf/slvu380) provides the
startup, ripple, and load-step references in Figures 2-5, 2-7, and 2-9. Its
startup input ramp differs from the Desktop bench's 10 µs ramp. The
[TIDA-010011 guide](https://www.ti.com/lit/pdf/tiduel1) page 37 documents the
four-module chain and page 40, Table 9 gives individual module load measurements.
Those measurements are useful targets once a full tree simulation completes.

The Desktop buck load-step bench uses TI's supplied PSpice profile: a 20 ns
maximum internal step, `ABSTOL=10n`, `VNTOL=10u`, `ITL1=1500`, `ITL2=400`,
and `ITL4=400`. `RELTOL=0.001` makes the default explicit. The electrical
components and load stimulus are unchanged. Both engines complete the requested
8 ms; final-window peak-to-peak voltage is 10.88 mV native and 11.25 mV WASM.
These final-window results are at 0.75 A, whereas the EVM's 10 mV measurement
is at 3 A, so this is not a matched-condition hardware validation.

The runner checks basic DC regulation using the mean of the final 100 µs.
It reports the final sample and window peak-to-peak voltage separately, and
preserves a completed summary even when the acceptance check fails. This avoids
judging DC regulation from one switching phase while retaining the ripple.

The CI snapshot in `tests/repros/ti-buck-settled-voltage.test.ts` retains the
recorded final 100 µs from an earlier run with only the 20 ns step correction.
Its final sample is 3.37734 V, mean is 3.31880 V, and peak-to-peak variation is
179 mV. This deliberately preserves the phase-sensitive reporting regression;
it is not the result of the corrected full TI profile. CI uses recorded
simulation output; full TI simulations remain manual. The four-rail power-tree
convergence failure remains unresolved in both engines.

## Desktop 0.0.3247 buck runtime reproduction

These manual cases retain the second Desktop attempt's corrected physical pin
connections, ideal external components, 12 V DC input, model defaults, 50 ns
output interval, and 8 ms transient request with UIC:

```sh
TI_POWER_TIMEOUT_MS=60000 bun examples/ti-power/run.ts desktop-3247-buck-startup
TI_POWER_TIMEOUT_MS=60000 bun examples/ti-power/run.ts desktop-3247-buck-loadstep
```

The startup case uses 1.1 Ω. The Desktop ripple experiment had the same circuit
and analysis, so this case also reproduces that full-load run. The load-step
case preserves the original exported 0–0.75 A pulse, including its 1 ns edges;
that export does not match the prompt's intended 0.75–1.5 A load step. The ignored
current-source DC offset is covered separately by the current-offset regression.

All three corrected Desktop builds exceeded their runner's 60-second limit.
Native ngspice 47 also exceeded a 180-second process limit on the same
compatibility-rewritten startup, load-step and full-load ripple decks. The
adapter startup run also exceeded 180 seconds. A process limit is not an ngspice
convergence verdict, and no completed waveform is claimed for these cases.
They remain manual model/solver reproductions, outside the short CI test suite.

The runner saves a compatibility-rewritten deck before starting the simulation
so the same input can be tested natively:

```sh
ngspice -n -D ngbehavior=psa -b -r /tmp/desktop-3247-buck.raw \
  .cache/ti-power/desktop-3247-buck-startup.native.cir
```
