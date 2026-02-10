type ShareNavigator = Navigator & {
  share?: (data: { title?: string; files?: File[] }) => Promise<void>
  canShare?: (data: { files: File[] }) => boolean
}

function readTableText(el: HTMLElement) {
  const table = el.querySelector('table') as HTMLTableElement | null
  if (!table) throw new Error('No table found')

  const rows: string[][] = []
  const trs = Array.from(table.querySelectorAll('tr'))
  for (const tr of trs) {
    const cells = Array.from(tr.children).filter(n => n.nodeName === 'TD' || n.nodeName === 'TH') as HTMLElement[]
    const texts = cells.map(c => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim())
    rows.push(texts)
  }
  return rows
}

async function tableToPngBlob(el: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const rows = readTableText(el)
  if (rows.length === 0) throw new Error('Empty table')

  // Simple canvas table rendering (robust across Safari/Edge; avoids foreignObject).
  const paddingX = 12
  const paddingY = 8
  const rowHeight = 32
  const border = 1
  const font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial'

  const meas = document.createElement('canvas')
  const mctx = meas.getContext('2d')
  if (!mctx) throw new Error('Canvas unsupported')
  mctx.font = font

  const colCount = Math.max(...rows.map(r => r.length))
  const colWidths: number[] = new Array(colCount).fill(80)

  for (let c = 0; c < colCount; c++) {
    let w = 60
    for (let r = 0; r < rows.length; r++) {
      const txt = rows[r][c] ?? ''
      w = Math.max(w, Math.ceil(mctx.measureText(txt).width) + paddingX * 2)
    }
    colWidths[c] = Math.min(Math.max(w, 80), 420) // clamp to avoid absurd widths
  }

  const width = colWidths.reduce((a, b) => a + b, 0) + border
  const height = rows.length * rowHeight + border

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.scale(pixelRatio, pixelRatio)
  ctx.font = font
  ctx.textBaseline = 'middle'

  // background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // grid + text
  let y = border
  for (let r = 0; r < rows.length; r++) {
    let x = border
    const isHeader = r === 0

    // row background
    ctx.fillStyle = isHeader ? '#f3f4f6' : '#ffffff'
    ctx.fillRect(0, y, width, rowHeight)

    for (let c = 0; c < colCount; c++) {
      const w = colWidths[c]
      // cell border
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, w, rowHeight)

      // text
      const txt = rows[r][c] ?? ''
      ctx.fillStyle = '#111827'
      ctx.font = (isHeader ? '700 ' : '400 ') + font
      const tx = x + paddingX
      const ty = y + rowHeight / 2
      ctx.fillText(txt, tx, ty)
      x += w
    }
    y += rowHeight
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}

export async function shareElementAsPng(el: HTMLElement, filenameBase: string, shareTitle: string): Promise<boolean> {
  try {
    const blob = await tableToPngBlob(el)
    const file = new File([blob], `${filenameBase}.png`, { type: 'image/png' })

    const nav: ShareNavigator = navigator as any
    if (nav.share) {
      // Some browsers do not implement canShare, but still support share(files).
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ title: shareTitle, files: [file] })
        return true
      }
    }

    // Per spec: no fallback behaviour (no new tab / download). Just report failure.
    return false
  } catch {
    return false
  }
}
