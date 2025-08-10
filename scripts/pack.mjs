import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd })
}

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function main() {
  // 1) 读取 package.json 基本信息
  const pkgPath = path.join(root, 'package.json')
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
  const name = pkg.name || 'app'
  const version = pkg.version || '0.0.0'
  const deps = pkg.dependencies || {}

  // 2) 确保构建完成
  const distDir = path.join(root, 'dist')
  if (!(await exists(distDir))) {
    console.log('未找到 dist 目录，正在执行构建...')
    run('npm run build', root)
  }
  if (!(await exists(distDir))) {
    throw new Error('构建后仍未找到 dist 目录，请检查构建配置')
  }

  // 3) 在 dist 目录写入运行时 package.json（仅保留生产依赖）
  const runtimePkg = {
    name,
    version,
    private: true,
    type: 'module',
    scripts: {
      start: 'node api/server.js'
    },
    dependencies: deps
  }
  await fs.writeFile(path.join(distDir, 'package.json'), JSON.stringify(runtimePkg, null, 2))

  // 4) 复制环境变量文件
  const envFiles = ['.env', '.env.production']
  for (const envFile of envFiles) {
    const envPath = path.join(root, envFile)
    if (await exists(envPath)) {
      await fs.cp(envPath, path.join(distDir, envFile))
      console.log(`已复制环境变量文件: ${envFile}`)
    }
  }

  // 5) 在 dist 目录安装生产依赖（强制使用 npm）
  const hasPkgLock = await exists(path.join(root, 'package-lock.json'))
  if (hasPkgLock) {
    await fs.cp(path.join(root, 'package-lock.json'), path.join(distDir, 'package-lock.json'))
    run('npm ci --omit=dev', distDir)
  } else {
    run('npm install --omit=dev', distDir)
  }

  console.log('\n构建和依赖安装完成，可运行目录：', distDir)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

