const fs = require('fs')
const { Archiver } = require('archiver')

const appDir = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\app'
const zipPath = 'C:\\Users\\musad\\Downloads\\E-Qarza-Deploy.zip'

const output = fs.createWriteStream(zipPath)
const archive = new Archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`Zip created: ${Math.round(archive.pointer() / (1024*1024))} MB`)
})

archive.on('error', (err) => {
  console.error('Error:', err)
})

archive.pipe(output)
archive.directory(appDir, 'app')
archive.finalize()
