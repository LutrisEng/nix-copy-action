import * as core from '@actions/core'
import {exec, getExecOutput} from '@actions/exec'
import fetch from 'node-fetch'

export async function cacheHasPath(
  cacheURL: string,
  path: string
): Promise<boolean> {
  const hashRegexResults = /^\/nix\/store\/([a-z0-9]{32})/.exec(path)
  if (!hashRegexResults) {
    throw new Error(
      `Store path ${path} must start with /nix/store/, then have a 32-character hash.`
    )
  }
  const hash = hashRegexResults[1]
  const url = `${cacheURL}/${hash}.narinfo`
  const res = await fetch(url, {
    method: 'HEAD'
  })
  if (res.status >= 400 && res.status <= 499) {
    return false
  } else if (res.status >= 200 && res.status <= 299) {
    return true
  } else {
    throw new Error(
      `${res.status} ${res.statusText} when checking if ${cacheURL} has ${path} (${url})`
    )
  }
}

export async function getPathDependencies(path: string): Promise<string[]> {
  const info = await getExecOutput('nix', ['path-info', '-r', path])
  const dependencies = info.stdout.split('\n')
  dependencies.pop()
  return dependencies
}

export async function copyPathsToCache(
  cacheURL: string,
  paths: string[]
): Promise<void> {
  core.debug(`Signing then copying ${JSON.stringify(paths)}`)
  await exec('nix', [
    'store',
    'sign',
    '--key-file',
    '/tmp/cache-priv-key.pem',
    ...paths
  ])
  await exec('nix', ['copy', '--to', cacheURL, ...paths])
}
