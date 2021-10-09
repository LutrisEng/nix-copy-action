import * as core from '@actions/core'
import {readdir, open} from 'fs/promises'
import {isInteresting} from './interesting'

async function run(): Promise<void> {
  try {
    const files = await readdir('/nix/store')
    const interestingFiles = files
      .filter(isInteresting)
      .map(x => `/nix/store/${x}`)
    const list = await open('/tmp/store-path-pre-build', 'w')
    for (const file of interestingFiles) {
      await list.write(`${file}\n`)
    }
    await list.close()
  } catch (error) {
    core.setFailed((error as {message: string}).message)
  }
}

run()
