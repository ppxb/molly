/**
 * 计算文件 SHA-256，并通过回调返回“读文件阶段”的进度。
 *
 * 说明：
 * - WebCrypto 的 digest 本身不提供进度事件，因此这里分两步：
 *   1) 分块读取文件并上报读取进度
 *   2) 读取完成后统一做 digest
 */
export async function hashFileSHA256(file: File, onProgress?: (loaded: number, total: number) => void) {
  if (!file.stream) {
    const data = await file.arrayBuffer()
    onProgress?.(data.byteLength, file.size)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const bytes = Array.from(new Uint8Array(digest))
    return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
  }

  const reader = file.stream().getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    if (!value) {
      continue
    }

    chunks.push(value)
    loaded += value.byteLength
    onProgress?.(Math.min(file.size, loaded), file.size)
  }

  const merged = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  onProgress?.(file.size, file.size)
  const digest = await crypto.subtle.digest('SHA-256', merged)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}
