export function isInteresting(path: string): boolean {
  return !(
    path.endsWith('.drv') ||
    path.endsWith('.check') ||
    path.endsWith('.lock')
  )
}
