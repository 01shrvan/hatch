import { spawn } from "node:child_process";

type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onLine?: (line: string, stream: "stdout" | "stderr") => Promise<void> | void;
};

export function runCommand(command: string, args: string[], options: RunOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
    });

    const handle = (chunk: Buffer, stream: "stdout" | "stderr") => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) void options.onLine?.(line, stream);
      }
    };

    child.stdout.on("data", (chunk: Buffer) => handle(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => handle(chunk, "stderr"));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
