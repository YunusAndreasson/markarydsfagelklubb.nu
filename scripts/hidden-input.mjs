// Read a secret from the terminal: no echo, one `*` per character, backspace
// and Ctrl-U work, Ctrl-C aborts. Anything typed before the prompt appears is
// thrown away, so keys pressed while the script was still busy can't end up
// at the front of the secret.

const DRAIN_MS = 150

export async function askHidden(label, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY) throw new Error("Run this in a terminal: it reads secrets from the keyboard.")

  // Raw mode swallows SIGINT, so Ctrl-C has to restore the terminal itself.
  const abort = () => {
    input.setRawMode(false)
    output.write("\n")
    process.exit(130)
  }

  input.setRawMode(true)
  input.setEncoding("utf8")
  input.resume()

  // Raw mode makes any half-typed line in the terminal buffer readable at once.
  // Swallow it before showing the prompt, but still honour Ctrl-C.
  await new Promise((resolve) => {
    const drop = (chunk) => {
      if (chunk.includes("\u0003")) abort()
    }
    input.on("data", drop)
    setTimeout(() => {
      input.off("data", drop)
      resolve()
    }, DRAIN_MS)
  })

  output.write(label)

  return new Promise((resolve) => {
    let value = ""

    const finish = () => {
      input.off("data", onData)
      input.setRawMode(false)
      input.pause()
      output.write("\n")
      resolve(value)
    }

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish()
        if (ch === "\u0003") abort()
        if (ch === "\u007f" || ch === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1)
            output.write("\b \b")
          }
        } else if (ch === "\u0015") {
          output.write("\b \b".repeat(value.length))
          value = ""
        } else if (ch >= " ") {
          value += ch
          output.write("*")
        }
      }
    }

    input.on("data", onData)
  })
}
