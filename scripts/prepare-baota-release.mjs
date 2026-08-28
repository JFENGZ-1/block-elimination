import { randomBytes } from 'node:crypto'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseRoot = join(projectRoot, 'release', 'baota')
const webRoot = join(releaseRoot, 'wwwroot')

if (!releaseRoot.startsWith(projectRoot)) throw new Error('发布目录超出项目范围')

await rm(releaseRoot, { recursive: true, force: true })
await mkdir(webRoot, { recursive: true })
await cp(join(projectRoot, 'dist'), webRoot, { recursive: true })
await cp(join(projectRoot, 'server', 'api'), join(webRoot, 'api'), { recursive: true })
await cp(join(projectRoot, 'server', 'schema.sql'), join(webRoot, 'api', 'schema.sql'))
await mkdir(join(releaseRoot, 'database'), { recursive: true })
await cp(join(projectRoot, 'server', 'schema.sql'), join(releaseRoot, 'database', 'schema.sql'))
await cp(join(projectRoot, 'server', 'nginx-baota-snippet.conf'), join(releaseRoot, 'nginx-baota-snippet.conf'))
await cp(join(projectRoot, 'server', 'nginx-demo.zjzoo.me.conf'), join(releaseRoot, 'nginx-demo.zjzoo.me.conf'))
await cp(join(projectRoot, 'server', 'BAOTA_DEPLOY.md'), join(releaseRoot, 'README.md'))

const setupKey = randomBytes(24).toString('hex')
await writeFile(join(webRoot, 'api', '.setup-key.php'), `<?php\ndeclare(strict_types=1);\nreturn '${setupKey}';\n`)
await writeFile(
  join(releaseRoot, 'SETUP_KEY.txt'),
  `坨坨方块一次性安装密钥\n\n${setupKey}\n\n上传 wwwroot 后访问：\nhttps://你的域名/api/setup.php?key=${setupKey}\n`,
)

console.log(`宝塔发布包已生成：${releaseRoot}`)
console.log(`一次性配置地址：https://你的域名/api/setup.php?key=${setupKey}`)
