import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deployRoot = join(projectRoot, 'deploy')
const webRoot = join(deployRoot, 'wwwroot')

if (!deployRoot.startsWith(projectRoot)) throw new Error('生产发布目录超出项目范围')

const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))

await rm(deployRoot, { recursive: true, force: true })
await mkdir(webRoot, { recursive: true })
await cp(join(projectRoot, 'dist'), webRoot, { recursive: true })
await mkdir(join(webRoot, 'api'), { recursive: true })
for (const file of ['index.php', 'setup.php', 'config.example.php']) {
  await cp(join(projectRoot, 'server', 'api', file), join(webRoot, 'api', file))
}
await cp(join(projectRoot, 'server', 'schema.sql'), join(webRoot, 'api', 'schema.sql'))
await writeFile(join(deployRoot, 'VERSION'), `${packageJson.version}\n`)

console.log(`生产部署目录已生成：${webRoot}`)
console.log(`版本：${packageJson.version}（VITE_DEBUG_MODE=false）`)
