const fs = require('fs')
const path = require('path')

const serverPath = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\app\\server.js'
let content = fs.readFileSync(serverPath, 'utf8')

// Fix outputFileTracingRoot to use relative path
content = content.replace(/outputFileTracingRoot:\s*"C:\\[^"]*"/, 'outputFileTracingRoot: "./.next"')

// Fix the comma issue - remove trailing comma from require if any
content = content.replace(/require\('server\.js',\s*\)/g, "require('server.js')")

fs.writeFileSync(serverPath, content)
console.log('server.js fixed')
console.log('Has comma:', content.includes("server.js,'"))
