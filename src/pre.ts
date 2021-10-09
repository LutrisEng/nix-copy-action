import * as core from '@actions/core'
import * as fs from 'fs'
import {promisify} from 'util'
import {isInteresting} from './interesting'

const readdir = promisify(fs.readdir)
const writeFile = promisify(fs.writeFile)

async function run(): Promise<void> {
  try {
    const files = await readdir('/nix/store')
    const interestingFiles = files
      .filter(isInteresting)
      .map(x => `/nix/store/${x}`)
    await writeFile('/tmp/store-path-pre-build', interestingFiles.join('\n'))
  } catch (error) {
    core.setFailed((error as {message: string}).message)
  }
}

run()
