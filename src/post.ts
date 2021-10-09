import * as core from '@actions/core'
import {readdir, readFile, writeFile} from 'fs/promises'
import chunk from 'lodash/chunk'
import {cacheHasPath, copyPathsToCache} from './cache'
import {isInteresting} from './interesting'
import {difference} from './set'

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
    const newUncachedFiles = newFilesWithCacheStatus
      .filter(x => !x.cacheStatus)
      .map(x => x.path)

    core.info(`Copying ${newUncachedFiles.length} paths to the cache...`)
    const chunkedNewUncachedFiles = chunk(newUncachedFiles, 48)
    await Promise.all(
      chunkedNewUncachedFiles.map(
        async thisChunk => await copyPathsToCache(cacheURL, thisChunk)
      )
    )
  } catch (error) {
    core.setFailed((error as {message: string}).message)
  }
}

run()
