import * as core from '@actions/core'
import * as fs from 'fs'
import chunk from 'lodash/chunk'
import {promisify} from 'util'
import {cacheHasPath, copyPathsToCache, getPathDependencies} from './cache'
import {isInteresting} from './interesting'
import {difference} from './set'

const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

async function run(): Promise<void> {
  try {
    const cacheURL: string = core.getInput('cache_url')
    const cacheHTTPURL: string = core.getInput('cache_http_url')
    const caches = ['https://cache.nixos.org']
    if (cacheHTTPURL !== '') {
      caches.push(cacheHTTPURL)
    }
    const cachePrivKey: string = core.getInput('cache_priv_key')
    await writeFile('/tmp/cache-priv-key.pem', cachePrivKey)
    const awsAccessKeyId: string = core.getInput('aws_access_key_id')
    process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId
    const awsSecretAccessKey: string = core.getInput('aws_secret_access_key')
    process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey
    const files = await readdir('/nix/store')
    const interestingFiles = new Set(
      files.filter(isInteresting).map(x => `/nix/store/${x}`)
    )
    const existingFiles = new Set(
      (await readFile('/tmp/store-path-pre-build'))
        .toString('utf-8')
        .split('\n')
    )
    const newFiles = difference(interestingFiles, existingFiles)

    const newFilesWithCacheStatus = await Promise.all(
      Array.from(newFiles).map(async path => {
        const results = await Promise.all(
          caches.map(async cache => await cacheHasPath(cache, path))
        )
        const cacheStatus = results.reduce((a, b) => a || b, false)
        return {path, cacheStatus}
      })
    )

    const newFilesWithDependencies = await Promise.all(
      newFilesWithCacheStatus.map(async x => ({
        ...x,
        dependencyPaths: await getPathDependencies(x.path)
      }))
    )

    const fileMap = new Map()
    for (const file of newFilesWithDependencies) {
      fileMap.set(file.path, file)
    }
    const fileGraph = newFilesWithDependencies.map(x => ({
      ...x,
      dependencies: x.dependencyPaths
        .filter(path => fileMap.has(path))
        .map(path => fileMap.get(path))
    }))
    const noDependencies = fileGraph.filter(x => x.dependencies.length === 0)
    const copied = new Set()
    let remaining = noDependencies
    while (remaining.length > 0) {
      for (const file of remaining) {
        copied.add(file.path)
      }
      const chunked = chunk(remaining, 48)
      await Promise.all(
        chunked.map(
          async thisChunk =>
            await copyPathsToCache(
              cacheURL,
              thisChunk.map(file => file.path)
            )
        )
      )
      remaining = []
      for (const file of remaining) {
        for (const dependency of file.dependencies) {
          if (!copied.has(dependency.path)) {
            remaining.push(dependency)
          }
        }
      }
    }
  } catch (error) {
    core.setFailed((error as {message: string}).message)
  }
}

run()
