export class SpiceSubcircuit {
  name: string
  pins: string[]

  constructor(name: string, pins: string[]) {
    this.name = name
    this.pins = pins
  }

  toSpiceString(): string {
    const pinString = this.pins.join(" ")
    const header = `.SUBCKT ${this.name} ${pinString}`
    const footer = `.ENDS ${this.name}`

    const body = `* Placeholder for ${this.name}. No definition found in circuit JSON.`

    return ["", header, body, footer].join("\n")
  }
}
